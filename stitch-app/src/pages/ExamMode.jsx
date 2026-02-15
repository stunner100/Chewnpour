import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { addSentryBreadcrumb, captureSentryException, captureSentryMessage } from '../lib/sentry';

const ExamMode = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [timeRemaining, setTimeRemaining] = useState(30 * 60); // 30 minutes
    const [examStarted, setExamStarted] = useState(false);
    const [attemptId, setAttemptId] = useState(null);
    const [attemptQuestions, setAttemptQuestions] = useState(null);
    const [startingExamAttempt, setStartingExamAttempt] = useState(false);
    const [startExamError, setStartExamError] = useState('');
    const [generatingQuestions, setGeneratingQuestions] = useState(false);
    const [generateQuestionsError, setGenerateQuestionsError] = useState('');
    const [regeneratingQuestions, setRegeneratingQuestions] = useState(false);
    const [regenerateQuestionsError, setRegenerateQuestionsError] = useState('');

    // Get userId from Better Auth session
    const userId = user?.id;

    // Convex queries and mutations
    const topicData = useQuery(
        api.topics.getTopicWithQuestions,
        topicId ? { topicId } : 'skip'
    );
    const startExam = useMutation(api.exams.startExamAttempt);
    const submitExam = useMutation(api.exams.submitExamAttempt);
    const generateQuestions = useAction(api.ai.generateQuestionsForTopic);
    const regenerateQuestions = useAction(api.ai.regenerateQuestionsForTopic);

    const MIN_EXAM_QUESTIONS = 5;
    const START_EXAM_ATTEMPT_TIMEOUT_MS = 45_000;
    const EXAM_LOADING_STALL_TIMEOUT_MS = 90_000;

    const topicQuestions = topicData?.questions || [];
    const hasAttemptQuestions = Array.isArray(attemptQuestions) && attemptQuestions.length > 0;
    const questions = hasAttemptQuestions ? attemptQuestions : [];
    const topic = topicData;
    const examFlowStartTimeRef = useRef(Date.now());
    const attemptStartTimeRef = useRef(null);
    const loadingStallReportedRef = useRef(false);

    useEffect(() => {
        examFlowStartTimeRef.current = Date.now();
        loadingStallReportedRef.current = false;
    }, [topicId]);

    const beginExamAttempt = useCallback(async () => {
        if (!topicId || topicQuestions.length === 0) return;

        setStartExamError('');
        setStartingExamAttempt(true);
        attemptStartTimeRef.current = Date.now();
        addSentryBreadcrumb({
            category: 'exam',
            message: 'Starting exam attempt',
            data: {
                topicId,
                topicQuestionCount: topicQuestions.length,
                hasUserId: Boolean(userId),
            },
        });
        let timeoutHandle = null;
        try {
            const startPromise = startExam(userId ? { userId, topicId } : { topicId });
            const timeoutPromise = new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new Error('Exam attempt initialization timed out.'));
                }, START_EXAM_ATTEMPT_TIMEOUT_MS);
            });
            const result = await Promise.race([startPromise, timeoutPromise]);
            const selectedQuestions = Array.isArray(result?.questions) ? result.questions : [];
            if (selectedQuestions.length === 0) {
                throw new Error('No questions available for this exam attempt.');
            }

            setAttemptId(result.attemptId);
            setAttemptQuestions(selectedQuestions);
            setCurrentQuestion(0);
            setSelectedAnswers({});
            setTimeRemaining(30 * 60);
            setExamStarted(true);
            const elapsedMs = Date.now() - attemptStartTimeRef.current;
            addSentryBreadcrumb({
                category: 'exam',
                message: 'Exam attempt started successfully',
                data: {
                    topicId,
                    attemptId: result?.attemptId,
                    selectedQuestionCount: selectedQuestions.length,
                    elapsedMs,
                },
            });
        } catch (error) {
            console.error('Failed to start exam attempt:', error);
            const message = String(error?.message || '');
            const elapsedMs = attemptStartTimeRef.current
                ? Date.now() - attemptStartTimeRef.current
                : null;
            if (/timed out/i.test(message)) {
                setStartExamError('Exam setup is taking longer than expected. Tap Retry.');
            } else {
                setStartExamError('Unable to start the exam. Please try again.');
            }
            captureSentryException(error, {
                level: /timed out/i.test(message) ? 'warning' : 'error',
                tags: {
                    area: 'exam',
                    operation: 'start_exam_attempt',
                    timedOut: /timed out/i.test(message),
                },
                extras: {
                    topicId,
                    userId,
                    topicQuestionCount: topicQuestions.length,
                    elapsedMs,
                    timeoutMs: START_EXAM_ATTEMPT_TIMEOUT_MS,
                },
            });
            setAttemptId(null);
            setAttemptQuestions(null);
            setExamStarted(false);
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
            attemptStartTimeRef.current = null;
            setStartingExamAttempt(false);
        }
    }, [topicId, userId, topicQuestions.length, startExam, START_EXAM_ATTEMPT_TIMEOUT_MS]);

    useEffect(() => {
        const waitingForQuestions = topicData !== null && topicData !== undefined && topicQuestions.length < MIN_EXAM_QUESTIONS;
        const waitingForAttemptStart = topicQuestions.length >= MIN_EXAM_QUESTIONS && !examStarted && (!attemptId || questions.length === 0);
        const shouldMonitorStall = !examStarted && (startingExamAttempt || waitingForQuestions || waitingForAttemptStart);

        if (!shouldMonitorStall || loadingStallReportedRef.current) {
            return;
        }

        const timer = setTimeout(() => {
            if (loadingStallReportedRef.current || examStarted) {
                return;
            }
            loadingStallReportedRef.current = true;
            const elapsedMs = Date.now() - examFlowStartTimeRef.current;
            captureSentryMessage('Exam flow stalled in loading state', {
                level: 'warning',
                tags: {
                    area: 'exam',
                    operation: 'loading_stall',
                },
                extras: {
                    topicId,
                    userId,
                    elapsedMs,
                    topicDataState: topicData === undefined ? 'loading' : topicData === null ? 'missing' : 'ready',
                    topicQuestionCount: topicQuestions.length,
                    hasAttemptQuestions,
                    attemptId,
                    startingExamAttempt,
                    startExamError,
                    generateQuestionsError,
                },
            });
        }, EXAM_LOADING_STALL_TIMEOUT_MS);

        return () => clearTimeout(timer);
    }, [
        attemptId,
        examStarted,
        generateQuestionsError,
        hasAttemptQuestions,
        questions.length,
        startExamError,
        startingExamAttempt,
        topicData,
        topicId,
        topicQuestions.length,
        userId,
    ]);

    // Auto-generate questions if too few exist (safety net for race condition)
    useEffect(() => {
        if (
            topicId &&
            topicData !== undefined &&
            topicData !== null &&
            !generatingQuestions &&
            !examStarted &&
            !hasAttemptQuestions &&
            topicQuestions.length > 0 &&
            topicQuestions.length < MIN_EXAM_QUESTIONS
        ) {
            let cancelled = false;
            setGeneratingQuestions(true);
            setGenerateQuestionsError('');
            generateQuestions({ topicId })
                .then((result) => {
                    if (cancelled) return;
                    const count = result?.count ?? 0;
                    if (!result?.success || count === 0) {
                        setGenerateQuestionsError('Unable to generate enough questions. Please try again.');
                    }
                })
                .catch((error) => {
                    if (cancelled) return;
                    console.error('Auto question generation failed:', error);
                    setGenerateQuestionsError('Failed to generate questions. Please try again.');
                    captureSentryException(error, {
                        level: 'warning',
                        tags: {
                            area: 'exam',
                            operation: 'auto_generate_questions',
                        },
                        extras: {
                            topicId,
                            topicQuestionCount: topicQuestions.length,
                        },
                    });
                })
                .finally(() => {
                    if (!cancelled) setGeneratingQuestions(false);
                });
            return () => { cancelled = true; };
        }
    }, [topicId, topicData, topicQuestions.length, generatingQuestions, examStarted, hasAttemptQuestions, generateQuestions]);

    // Start exam once enough questions exist. Keep generation in background.
    useEffect(() => {
        if (
            topicId &&
            !examStarted &&
            !startingExamAttempt &&
            !hasAttemptQuestions &&
            !startExamError &&
            topicQuestions.length >= MIN_EXAM_QUESTIONS
        ) {
            beginExamAttempt();
        }
    }, [
        topicId,
        examStarted,
        startingExamAttempt,
        hasAttemptQuestions,
        startExamError,
        topicQuestions.length,
        beginExamAttempt,
    ]);

    // Timer
    useEffect(() => {
        if (!examStarted) return;

        const timer = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 0) {
                    clearInterval(timer);
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [examStarted]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAnswerSelect = (questionId, answer) => {
        setSelectedAnswers((prev) => ({
            ...prev,
            [questionId]: answer,
        }));
    };

    const handleNext = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        }
    };

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1);
        }
    };

    const handleSubmit = async () => {
        if (!attemptId) return;

        const answers = Object.entries(selectedAnswers).map(([questionId, selectedAnswer]) => ({
            questionId,
            selectedAnswer,
        }));

        const timeTaken = 30 * 60 - timeRemaining;

        try {
            await submitExam({
                attemptId,
                answers,
                timeTakenSeconds: timeTaken,
            });
            navigate(`/dashboard/results/${attemptId}`);
        } catch (error) {
            console.error('Failed to submit exam:', error);
            captureSentryException(error, {
                tags: {
                    area: 'exam',
                    operation: 'submit_exam_attempt',
                },
                extras: {
                    topicId,
                    attemptId,
                    answerCount: answers.length,
                    timeTakenSeconds: timeTaken,
                },
            });
        }
    };

    const handleGenerateQuestions = async () => {
        if (!topicId) return;
        setGenerateQuestionsError('');
        setGeneratingQuestions(true);
        addSentryBreadcrumb({
            category: 'exam',
            message: 'Manual question generation requested',
            data: {
                topicId,
                topicQuestionCount: topicQuestions.length,
            },
        });
        try {
            const result = await generateQuestions({ topicId });
            const generatedCount = result?.count ?? 0;
            if (!result?.success || generatedCount === 0) {
                setGenerateQuestionsError('Unable to generate questions yet. Please try again.');
            }
        } catch (error) {
            setGenerateQuestionsError('Failed to generate questions. Please try again.');
            captureSentryException(error, {
                level: 'warning',
                tags: {
                    area: 'exam',
                    operation: 'manual_generate_questions',
                },
                extras: {
                    topicId,
                    topicQuestionCount: topicQuestions.length,
                },
            });
        } finally {
            setGeneratingQuestions(false);
        }
    };

    if (!topicId) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Select a topic to start an exam</h2>
                    <p className="text-slate-500 font-medium mb-6">Go back to your dashboard and choose a topic to begin.</p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    // Loading state
    if (topicData === undefined) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Preparing your exam environment...</p>
                </div>
            </div>
        );
    }

    if (topicData === null) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Topic not found</h2>
                    <p className="text-slate-500 font-medium mb-6">We couldn’t find this topic. Please return to your dashboard.</p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (topicQuestions.length === 0) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-lg px-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No questions yet</h2>
                    <p className="text-slate-500 font-medium mb-6">Generate questions for this topic to start the exam.</p>
                    {generateQuestionsError && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                            {generateQuestionsError}
                        </div>
                    )}
                    <button
                        onClick={handleGenerateQuestions}
                        disabled={generatingQuestions}
                        className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-60"
                    >
                        {generatingQuestions ? 'Generating...' : 'Generate Questions'}
                    </button>
                </div>
            </div>
        );
    }

    if (
        !examStarted &&
        !startingExamAttempt &&
        !hasAttemptQuestions &&
        topicQuestions.length < MIN_EXAM_QUESTIONS
    ) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-lg px-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Preparing question bank</h2>
                    <p className="text-slate-500 font-medium mb-6">
                        {`We currently have ${topicQuestions.length} of ${MIN_EXAM_QUESTIONS} questions needed to start.`}
                    </p>
                    {generateQuestionsError && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                            {generateQuestionsError}
                        </div>
                    )}
                    <button
                        onClick={handleGenerateQuestions}
                        disabled={generatingQuestions}
                        className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-60"
                    >
                        {generatingQuestions ? 'Generating...' : 'Generate Questions'}
                    </button>
                </div>
            </div>
        );
    }

    if (startingExamAttempt || !examStarted || !attemptId || questions.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {!startExamError ? (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
                            <div className="relative w-24 h-24 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
                                    <span className="material-symbols-outlined text-3xl">quiz</span>
                                </div>
                            </div>
                            
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                Preparing Your Exam
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6">
                                We're building a personalized 25-question test based on your topic.
                            </p>
                            
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                    <span className="material-symbols-outlined text-green-500">check_circle</span>
                                    <span>Analyzing topic content</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                    <span className="material-symbols-outlined text-green-500">check_circle</span>
                                    <span>Generating questions</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                    <span className="material-symbols-outlined text-blue-500 animate-pulse">hourglass_empty</span>
                                    <span>Finalizing exam set</span>
                                </div>
                            </div>
                            
                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                                <p className="text-xs text-slate-400">
                                    This usually takes 10-20 seconds
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
                            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-3xl text-amber-500">warning</span>
                            </div>
                            
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                Taking Longer Than Expected
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6">
                                {startExamError}
                            </p>
                            
                            <div className="flex gap-3">
                                <button
                                    onClick={beginExamAttempt}
                                    disabled={startingExamAttempt}
                                    className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">refresh</span>
                                    <span>Try Again</span>
                                </button>
                                <Link
                                    to={`/dashboard/topic/${topicId}`}
                                    className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center"
                                >
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const currentQ = questions[currentQuestion];
    const progress = ((currentQuestion + 1) / questions.length) * 100;

    const safeJsonParse = (value) => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
            return null;
        }
        try {
            return JSON.parse(trimmed);
        } catch (error) {
            return null;
        }
    };

    const normalizeOptionString = (value) => {
        if (typeof value !== 'string') return value;
        return value
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/^"+|"+$/g, '')
            .trim();
    };

    const cleanOptionText = (value) => {
        if (value === null || value === undefined) return '';
        let text = typeof value === 'string' ? normalizeOptionString(value) : String(value);
        if (!text) return '';

        const parsed = safeJsonParse(text);
        if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed)) {
                return '';
            }
            if (typeof parsed.text === 'string') {
                return normalizeOptionString(parsed.text);
            }
            return '';
        }

        const textMatch = text.match(/"text"\s*:\s*"([^"]+)"/);
        if (textMatch) {
            return textMatch[1];
        }

        if (/\"label\"\s*:\s*\"/.test(text) || /\"isCorrect\"\s*:/.test(text)) {
            return '';
        }

        return text;
    };

    const extractOptionsFromText = (text) => {
        if (typeof text !== 'string') return null;
        const cleaned = normalizeOptionString(text);
        const labelMatches = [...cleaned.matchAll(/"label"\s*:\s*"([^"]+)"/g)];
        const textMatches = [...cleaned.matchAll(/"text"\s*:\s*"([^"]+)"/g)];
        if (textMatches.length === 0) return null;
        return textMatches.map((match, index) => ({
            label: labelMatches[index]?.[1] ?? String.fromCharCode(65 + index),
            text: match[1],
        }));
    };

    const tryReconstructOptions = (stringOptions) => {
        if (!Array.isArray(stringOptions) || stringOptions.length === 0) return null;
        const joined = stringOptions.map(normalizeOptionString).join(',');
        const cleanedCandidates = [
            joined,
            normalizeOptionString(joined),
        ];

        for (const candidate of cleanedCandidates) {
            const parsed = safeJsonParse(candidate);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && Array.isArray(parsed.options)) return parsed.options;
        }

        for (const candidate of cleanedCandidates) {
            const wrapped = candidate.trim().startsWith('[') ? candidate : `[${candidate}]`;
            const parsed = safeJsonParse(wrapped);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && Array.isArray(parsed.options)) return parsed.options;
        }

        const extracted = extractOptionsFromText(joined);
        if (extracted) return extracted;

        return null;
    };

    const reconstructFromFragments = (stringOptions) => {
        if (!Array.isArray(stringOptions) || stringOptions.length === 0) return null;

        const reconstructed = [];
        let current = null;

        for (const fragment of stringOptions) {
            const cleaned = normalizeOptionString(fragment);
            const labelMatch = cleaned.match(/"label"\s*:\s*"([^"]+)"/);
            const textMatch = cleaned.match(/"text"\s*:\s*"([^"]+)"/);
            const correctMatch = cleaned.match(/"isCorrect"\s*:\s*(true|false)/);

            if (labelMatch) {
                if (current && current.text) {
                    reconstructed.push(current);
                }
                current = { label: labelMatch[1] };
            }

            if (textMatch) {
                if (!current) current = { label: String.fromCharCode(65 + reconstructed.length) };
                current.text = textMatch[1];
            }

            if (correctMatch) {
                if (!current) current = { label: String.fromCharCode(65 + reconstructed.length) };
                current.isCorrect = correctMatch[1] === 'true';
            }

            if (current && current.label && current.text && correctMatch) {
                reconstructed.push(current);
                current = null;
            }
        }

        if (current && current.text) {
            reconstructed.push(current);
        }

        return reconstructed.length > 0 ? reconstructed : null;
    };

    const coerceOptions = (rawOptions) => {
        if (!rawOptions) return [];

        let options = rawOptions;
        if (typeof options === 'string') {
            const parsed = safeJsonParse(options);
            options = parsed ?? options;
        }

        if (options && !Array.isArray(options) && typeof options === 'object') {
            if (Array.isArray(options.options)) {
                options = options.options;
            }
        }

        if (!Array.isArray(options)) {
            options = [options];
        }

        const flattened = [];
        for (const option of options) {
            if (typeof option === 'string') {
                const parsed = safeJsonParse(option);
                if (Array.isArray(parsed)) {
                    flattened.push(...parsed);
                    continue;
                }
                if (parsed) {
                    flattened.push(parsed);
                    continue;
                }
            }
            flattened.push(option);
        }

        const cleaned = flattened.filter((option) => option !== null && option !== undefined);
        if (cleaned.length > 0 && cleaned.every((option) => typeof option === 'string')) {
            const reconstructedFromFragments = reconstructFromFragments(cleaned);
            if (reconstructedFromFragments && reconstructedFromFragments.length > 0) {
                return reconstructedFromFragments;
            }
            const reconstructed = tryReconstructOptions(cleaned);
            if (reconstructed && reconstructed.length > 0) {
                return reconstructed;
            }
            const extracted = extractOptionsFromText(cleaned.join(','));
            if (extracted && extracted.length > 0) {
                return extracted;
            }
        }

        return cleaned;
    };

    const options = coerceOptions(currentQ?.options);
    const normalizedOptions = options;
    const normalizeOption = (option, index) => {
        if (option && typeof option === 'object') {
            const label = option.label ?? String.fromCharCode(65 + index);
            const text = cleanOptionText(option.text ?? option.value ?? '');
            if (!text) return null;
            const value = String(label);
            return { label, value, text };
        }
        let label = String.fromCharCode(65 + index);
        let text = cleanOptionText(option ?? '');
        const labelMatch = typeof text === 'string' ? text.match(/"label"\s*:\s*"([^"]+)"/) : null;
        const textMatch = typeof text === 'string' ? text.match(/"text"\s*:\s*"([^"]+)"/) : null;
        if (labelMatch) {
            label = labelMatch[1];
        }
        if (textMatch) {
            text = textMatch[1];
        } else if (labelMatch) {
            text = '';
        } else if (typeof text === 'string' && /"isCorrect"\s*:/.test(text)) {
            text = '';
        }
        const value = label;
        if (!text) return null;
        return { label, value, text };
    };

    const renderOptions = normalizedOptions
        .map((option, index) => normalizeOption(option, index))
        .filter(Boolean);

    const buildFallbackOptionsFromRaw = () => {
        try {
            const rawString = typeof currentQ?.options === 'string'
                ? currentQ.options
                : JSON.stringify(currentQ?.options ?? '');
            const cleaned = normalizeOptionString(rawString);
            const matches = [...cleaned.matchAll(/"text"\s*:\s*"([^"]+)"/g)];
            if (matches.length === 0) return [];
            return matches.map((match, index) => ({
                label: String.fromCharCode(65 + index),
                value: String.fromCharCode(65 + index),
                text: match[1],
            }));
        } catch (error) {
            return [];
        }
    };

    const hasRawArtifacts = renderOptions.some((option) => typeof option.text === 'string' && /"label"|{"label"|\"label\"|\"isCorrect\"/i.test(option.text));
    const fallbackOptions = buildFallbackOptionsFromRaw();
    const finalOptions = renderOptions.length === 0 || hasRawArtifacts
        ? (fallbackOptions.length > 0 ? fallbackOptions : renderOptions)
        : renderOptions;

    return (
        <div className="bg-background-light dark:bg-background-dark font-display antialiased text-slate-900 dark:text-white h-screen w-full overflow-hidden flex flex-col md:flex-row transition-colors duration-300">
            {/* Main Content Area */}
            <main className="flex-1 h-full overflow-y-auto no-scrollbar relative flex flex-col">
                {/* Mobile Header */}
                <div className="md:hidden p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 z-30">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-primary text-lg">Q{currentQuestion + 1}</span>
                        <span className="text-slate-400 text-sm font-medium">of {questions.length}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                        <span className="material-symbols-outlined text-lg text-slate-500">timer</span>
                        <span className="font-mono font-bold text-sm tabular-nums">{formatTime(timeRemaining)}</span>
                    </div>
                </div>

                <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-10 lg:p-16 flex flex-col min-h-[calc(100vh-80px)] py-10">
                    {startExamError && (
                        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                            {startExamError}
                        </div>
                    )}
                    <div className="bg-white dark:bg-surface-dark rounded-[3rem] p-8 md:p-16 md:pb-24 shadow-soft border border-slate-200/50 dark:border-slate-800/50 relative animate-slide-up my-auto">
                        {/* Decorative background blob */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-10">
                                <span className="inline-flex items-center gap-2 text-slate-500 font-bold text-sm tracking-wide bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <span className="w-2 h-2 rounded-full bg-primary/50 animate-pulse"></span>
                                    {topic?.title || 'Exam Session'}
                                </span>
                                <div className="hidden sm:block">
                                    <span className="text-slate-400 text-sm font-medium">Question ID: #{currentQ?._id?.slice(-8)}</span>
                                </div>
                            </div>
                            <div className="mb-6 flex flex-wrap items-center gap-3">
                                <button
                                    onClick={async () => {
                                        if (!topicId) return;
                                        setRegenerateQuestionsError('');
                                        setRegeneratingQuestions(true);
                                        addSentryBreadcrumb({
                                            category: 'exam',
                                            message: 'Regenerate questions requested',
                                            data: {
                                                topicId,
                                                currentAttemptId: attemptId,
                                            },
                                        });
                                        try {
                                            await regenerateQuestions({ topicId });
                                            setAttemptId(null);
                                            setAttemptQuestions(null);
                                            setExamStarted(false);
                                            setSelectedAnswers({});
                                            setCurrentQuestion(0);
                                            await beginExamAttempt();
                                        } catch (error) {
                                            const message = error?.message || 'Failed to regenerate questions. Please try again.';
                                            setRegenerateQuestionsError(message);
                                            console.error('Regenerate questions failed:', error);
                                            captureSentryException(error, {
                                                level: 'warning',
                                                tags: {
                                                    area: 'exam',
                                                    operation: 'regenerate_questions',
                                                },
                                                extras: {
                                                    topicId,
                                                    currentAttemptId: attemptId,
                                                },
                                            });
                                        } finally {
                                            setRegeneratingQuestions(false);
                                        }
                                    }}
                                    disabled={regeneratingQuestions}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-60"
                                >
                                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                                    {regeneratingQuestions ? 'Regenerating...' : 'Regenerate Questions'}
                                </button>
                                {regenerateQuestionsError && (
                                    <span className="text-sm font-medium text-amber-700">
                                        {regenerateQuestionsError}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-lg md:text-xl lg:text-2xl font-display font-bold leading-tight mb-8 text-slate-900 dark:text-white">
                                {currentQ?.questionText}
                            </h1>

                            <div className="space-y-3 max-w-3xl">
                                {finalOptions.length === 0 ? (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                                        No options available for this question yet. Try regenerating questions from the topic page.
                                    </div>
                                ) : (
                                    finalOptions.map((option, index) => {
                                        const { label, value, text } = option;
                                        const isSelected = selectedAnswers[currentQ._id] === value;

                                        return (
                                            <button
                                                key={index}
                                                onClick={() => handleAnswerSelect(currentQ._id, value)}
                                                className={`w-full text-left p-4 md:p-5 rounded-2xl border-2 transition-all duration-200 flex items-start gap-4 group ${isSelected
                                                    ? 'border-primary bg-primary/5 shadow-inner'
                                                    : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-primary/30 hover:bg-white dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                <span className={`flex-shrink-0 w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${isSelected
                                                    ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110'
                                                    : 'bg-white dark:bg-slate-700 text-slate-500 border border-slate-200 dark:border-slate-600 group-hover:border-primary/50 group-hover:text-primary'
                                                    }`}>
                                                    {label}
                                                </span>
                                                <span className={`text-sm md:text-base pt-0.5 leading-relaxed font-medium ${isSelected
                                                    ? 'text-slate-900 dark:text-white'
                                                    : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'
                                                    }`}>
                                                    {text}
                                                </span>
                                                {isSelected && (
                                                    <span className="material-symbols-outlined text-primary ml-auto animate-fade-in">check_circle</span>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="mt-12 pt-10 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between relative z-20">
                            <button
                                onClick={handlePrevious}
                                disabled={currentQuestion === 0}
                                className="px-6 py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">arrow_back</span>
                                Previous
                            </button>

                            {currentQuestion === questions.length - 1 ? (
                                <button
                                    onClick={handleSubmit}
                                    disabled={!attemptId}
                                    className="px-8 py-4 rounded-xl bg-green-600 text-white font-bold shadow-lg shadow-green-600/20 hover:bg-green-700 hover:shadow-green-600/30 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                >
                                    Submit Exam
                                    <span className="material-symbols-outlined">check</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleNext}
                                    className="px-8 py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center gap-2 group"
                                >
                                    Next Question
                                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Sidebar */}
            <aside className="hidden md:flex w-80 lg:w-96 bg-surface-light dark:bg-surface-dark border-l border-slate-200/60 dark:border-slate-800 flex-col h-screen sticky top-0 overflow-y-auto z-20 shadow-[-10px_0_40px_-10px_rgba(0,0,0,0.05)]">
                <div className="p-8">
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] p-8 text-center border border-slate-100 dark:border-slate-800 relative overflow-hidden mb-8">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Time Remaining</span>
                        <div className={`text-5xl font-mono font-bold tracking-tighter tabular-nums ${timeRemaining < 300 ? 'text-red-500 animate-pulse' : 'text-slate-900 dark:text-white'
                            }`}>
                            {formatTime(timeRemaining)}
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className="flex justify-between items-end mb-3 px-1">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Exam Progress</span>
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div className="bg-primary h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                        {questions.map((q, index) => {
                            const isAnswered = selectedAnswers[q._id];
                            const isCurrent = index === currentQuestion;

                            return (
                                <button
                                    key={q._id}
                                    onClick={() => setCurrentQuestion(index)}
                                    className={`aspect-square rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center ${isCurrent
                                        ? 'bg-primary text-white shadow-lg shadow-primary/30 ring-2 ring-primary/20 scale-110 z-10'
                                        : isAnswered
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            : 'border border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 hover:border-slate-300 hover:text-slate-400'
                                        }`}
                                >
                                    {index + 1}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-auto p-8 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-800">
                    <button className="w-full py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 font-bold hover:border-amber-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all flex items-center justify-center gap-2 mb-4 group">
                        <span className="material-symbols-outlined group-hover:fill-1 transition-colors text-[20px]">flag</span>
                        Flag Question
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!attemptId}
                        className="w-full py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        Submit Early
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default ExamMode;
