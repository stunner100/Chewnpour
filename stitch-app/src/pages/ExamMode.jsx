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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col md:flex-row">
            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-h-screen">
                {/* Header */}
                <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
                    <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link to={`/dashboard/topic/${topicId}`} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </Link>
                            <div>
                                <h1 className="text-base font-semibold text-slate-900 dark:text-white">Exam</h1>
                                <p className="text-xs text-slate-500 truncate max-w-[120px] sm:max-w-xs">{topic?.title}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                {currentQuestion + 1} <span className="text-slate-400">/ {questions.length}</span>
                            </span>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono font-semibold text-sm ${timeRemaining < 300 ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                <span className="material-symbols-outlined text-base">timer</span>
                                {formatTime(timeRemaining)}
                            </div>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 bg-slate-100 dark:bg-slate-800">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                </header>

                {/* Question Content */}
                <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-32">
                    {startExamError && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            {startExamError}
                        </div>
                    )}

                    {/* Question Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-8 mb-6">
                        <div className="mb-6">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium mb-3">
                                <span className="material-symbols-outlined text-sm">quiz</span>
                                <span>Question {currentQuestion + 1}</span>
                            </span>
                            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-relaxed">
                                {currentQ?.questionText}
                            </h2>
                        </div>

                        {/* Options */}
                        <div className="space-y-2">
                            {finalOptions.length === 0 ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    No options available for this question.
                                </div>
                            ) : (
                                finalOptions.map((option, index) => {
                                    const { label, value, text } = option;
                                    const isSelected = selectedAnswers[currentQ._id] === value;

                                    return (
                                        <button
                                            key={index}
                                            onClick={() => handleAnswerSelect(currentQ._id, value)}
                                            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${isSelected
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                        >
                                            <span className={`flex-shrink-0 w-8 h-8 rounded-lg font-bold text-sm flex items-center justify-center transition-all ${isSelected
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                                }`}>
                                                {label}
                                            </span>
                                            <span className={`flex-1 text-sm md:text-base ${isSelected ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-600 dark:text-slate-300'}`}>
                                                {text}
                                            </span>
                                            {isSelected && (
                                                <span className="material-symbols-outlined text-blue-500">check_circle</span>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Question Navigator - Mobile Only */}
                    <div className="md:hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-slate-500">Question Navigator</span>
                            <span className="text-xs text-slate-400">{Object.keys(selectedAnswers).length} of {questions.length} answered</span>
                        </div>
                        <div className="grid grid-cols-8 gap-1.5">
                            {questions.map((q, index) => {
                                const isAnswered = selectedAnswers[q._id];
                                const isCurrent = index === currentQuestion;
                                return (
                                    <button
                                        key={q._id}
                                        onClick={() => setCurrentQuestion(index)}
                                        className={`aspect-square rounded-lg font-bold text-xs flex items-center justify-center transition-all ${isCurrent
                                            ? 'bg-blue-500 text-white'
                                            : isAnswered
                                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                                : 'border border-slate-200 dark:border-slate-700 text-slate-400'
                                            }`}
                                    >
                                        {index + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Bottom Navigation */}
                <div className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 safe-area-bottom">
                    <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                        <button
                            onClick={handlePrevious}
                            disabled={currentQuestion === 0}
                            className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                            <span className="hidden sm:inline">Prev</span>
                        </button>

                        <div className="flex-1 text-center">
                            <span className="text-sm text-slate-500">
                                {Object.keys(selectedAnswers).length} <span className="text-slate-400">/ {questions.length}</span> answered
                            </span>
                        </div>

                        {currentQuestion === questions.length - 1 ? (
                            <button
                                onClick={handleSubmit}
                                disabled={!attemptId}
                                className="px-6 py-2.5 rounded-xl bg-green-500 text-white font-semibold shadow-md hover:bg-green-600 transition-all flex items-center gap-1 disabled:opacity-60"
                            >
                                <span>Submit</span>
                                <span className="material-symbols-outlined">check</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleNext}
                                className="px-6 py-2.5 rounded-xl bg-blue-500 text-white font-semibold shadow-md hover:bg-blue-600 transition-all flex items-center gap-1"
                            >
                                <span>Next</span>
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </button>
                        )}
                    </div>
                </div>
            </main>

            {/* Sidebar - Desktop Only */}
            <aside className="hidden md:flex w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex-col h-screen sticky top-0">
                <div className="p-6 flex-1 overflow-y-auto">
                    {/* Timer */}
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 text-center mb-6">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">Time Remaining</span>
                        <div className={`text-4xl font-mono font-bold tabular-nums ${timeRemaining < 300 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                            {formatTime(timeRemaining)}
                        </div>
                        {timeRemaining < 300 && (
                            <p className="text-xs text-red-500 mt-1">Less than 5 minutes!</p>
                        )}
                    </div>

                    {/* Progress */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Progress</span>
                            <span className="text-sm font-bold text-blue-500">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>

                    {/* Question Grid */}
                    <div className="mb-6">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 block mb-3">Questions</span>
                        <div className="grid grid-cols-5 gap-1.5">
                            {questions.map((q, index) => {
                                const isAnswered = selectedAnswers[q._id];
                                const isCurrent = index === currentQuestion;
                                return (
                                    <button
                                        key={q._id}
                                        onClick={() => setCurrentQuestion(index)}
                                        className={`aspect-square rounded-lg font-bold text-xs flex items-center justify-center transition-all ${isCurrent
                                            ? 'bg-blue-500 text-white shadow-md'
                                            : isAnswered
                                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                                : 'border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'
                                            }`}
                                    >
                                        {index + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={handleSubmit}
                        disabled={!attemptId}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                    >
                        Submit Exam
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default ExamMode;
