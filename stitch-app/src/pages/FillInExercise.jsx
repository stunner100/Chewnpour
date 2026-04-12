import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { useRouteResolvedTopic } from '../hooks/useRouteResolvedTopic';
import ExamPreparationLoader from '../components/ExamPreparationLoader';

const normalize = (text) =>
    String(text || '')
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const FillInExercise = () => {
    const { topicId: topicIdParam } = useParams();
    const routeTopicId = typeof topicIdParam === 'string' ? topicIdParam.trim() : '';
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id;

    const reloadDashboard = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.location.assign('/dashboard');
            return;
        }
        navigate('/dashboard', { replace: true });
    }, [navigate]);

    const topicQueryResult = useQuery(
        api.topics.getTopicWithQuestions,
        routeTopicId ? { topicId: routeTopicId } : 'skip'
    );
    const {
        topic,
        topicId,
        isLoadingRouteTopic,
        isMissingRouteTopic,
    } = useRouteResolvedTopic(routeTopicId, topicQueryResult);

    const generateFillInBatch = useAction(api.ai.generateFillInBatch);
    const createConceptAttempt = useMutation(api.concepts.createConceptAttempt);

    const [questions, setQuestions] = useState(null); // array of { sentence, blanks }
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [answers, setAnswers] = useState({}); // { "q0-b0": "typed text", ... }
    const [submitted, setSubmitted] = useState(false);
    const [results, setResults] = useState(null); // { score, total, details[] }
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [startedAt, setStartedAt] = useState(null);
    const [currentIdx, setCurrentIdx] = useState(0);
    const inputRefs = useRef({});

    const topicTitle = topic?.title || 'Fill-ins';

    const previousQuestionsRef = useRef(null);

    const loadExercise = useCallback(async () => {
        if (!topicId || !userId) return;
        const fallbackQuestions = previousQuestionsRef.current;
        setLoading(true);
        setLoadError('');
        setSaveError('');
        setSubmitted(false);
        setResults(null);
        setAnswers({});
        setCurrentIdx(0);
        try {
            const response = await generateFillInBatch({ topicId });
            const qs = Array.isArray(response?.questions) ? response.questions : [];
            if (qs.length === 0) throw new Error('No questions generated.');
            previousQuestionsRef.current = qs;
            setQuestions(qs);
            setStartedAt(Date.now());
        } catch (error) {
            console.error('Fill-in generation failed:', error);
            // If we have previous questions, recycle them in shuffled order
            if (fallbackQuestions && fallbackQuestions.length > 0) {
                const shuffled = [...fallbackQuestions].sort(() => Math.random() - 0.5);
                setQuestions(shuffled);
                setStartedAt(Date.now());
            } else {
                setLoadError(
                    String(error?.message || '').includes('INSUFFICIENT_EVIDENCE')
                        ? 'Not enough content to generate fill-ins. Try a topic with more material.'
                        : 'Failed to generate fill-in exercises. Please try again.'
                );
                setQuestions(null);
            }
        } finally {
            setLoading(false);
        }
    }, [generateFillInBatch, topicId, userId]);

    useEffect(() => {
        if (topicId && userId && !questions && !loading && !loadError) {
            loadExercise();
        }
    }, [topicId, userId, questions, loading, loadError, loadExercise]);

    // Total blanks for progress
    const totalBlanks = useMemo(() => {
        if (!questions) return 0;
        return questions.reduce((sum, q) => sum + (q.blanks?.length || 0), 0);
    }, [questions]);

    const filledBlanks = useMemo(() => {
        return Object.values(answers).filter((v) => String(v || '').trim().length > 0).length;
    }, [answers]);

    const allFilled = totalBlanks > 0 && filledBlanks === totalBlanks;
    const progressPercent = totalBlanks > 0 ? Math.round((filledBlanks / totalBlanks) * 100) : 0;

    const handleAnswerChange = useCallback((questionIdx, blankIdx, value) => {
        const key = `q${questionIdx}-b${blankIdx}`;
        setAnswers((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!questions || !topicId || !userId || !allFilled) return;
        setSaving(true);
        setSaveError('');
        try {
            let correctCount = 0;
            const details = questions.map((q, qIdx) => {
                const blankResults = q.blanks.map((blank, bIdx) => {
                    const userAnswer = String(answers[`q${qIdx}-b${bIdx}`] || '').trim();
                    const isCorrect = normalize(userAnswer) === normalize(blank.answer);
                    if (isCorrect) correctCount += 1;
                    return { userAnswer, correctAnswer: blank.answer, isCorrect };
                });
                return { sentence: q.sentence, blankResults };
            });

            const timeTakenSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined;

            await createConceptAttempt({
                topicId,
                score: correctCount,
                totalQuestions: totalBlanks,
                timeTakenSeconds,
                answers: {
                    userAnswers: Object.entries(answers).map(([k, v]) => ({ key: k, value: v })),
                    details,
                },
                questionText: `Fill-ins: ${questions.length} questions, ${totalBlanks} blanks`,
            });

            setResults({ score: correctCount, total: totalBlanks, details });
            setSubmitted(true);
        } catch (error) {
            console.error('Failed to save fill-in attempt:', error);
            setSaveError('Failed to save your result. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [questions, answers, topicId, userId, allFilled, totalBlanks, startedAt, createConceptAttempt]);

    // Focus first input of current question
    useEffect(() => {
        if (!questions || submitted) return;
        const firstKey = `q${currentIdx}-b0`;
        const el = inputRefs.current[firstKey];
        if (el) setTimeout(() => el.focus(), 100);
    }, [currentIdx, questions, submitted]);

    /* ── guard states ──────────────────────────────────────────── */
    if (!routeTopicId) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-primary text-[24px]">edit_note</span>
                    </div>
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Select a Topic</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">Choose a topic from your dashboard to start fill-in practice.</p>
                    <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-body-sm">Go to Dashboard</Link>
                </div>
            </div>
        );
    }

    if (isMissingRouteTopic) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-red-500 text-[24px]">error</span>
                    </div>
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">This link is stale</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">Reload the dashboard and try again.</p>
                    <button type="button" onClick={reloadDashboard} className="btn-secondary inline-flex items-center gap-2 px-6 py-2.5 text-body-sm">Reload Dashboard</button>
                </div>
            </div>
        );
    }

    if (isLoadingRouteTopic || (loading && !questions)) {
        return (
            <ExamPreparationLoader
                mode="fill_in"
                failed={Boolean(loadError)}
                errorMsg={loadError}
                onRetry={loadExercise}
                onBack={() => navigate(topicId ? `/dashboard/topic/${topicId}` : '/dashboard')}
            />
        );
    }

    if (loadError) {
        return (
            <ExamPreparationLoader
                mode="fill_in"
                failed
                errorMsg={loadError}
                onRetry={loadExercise}
                onBack={() => navigate(topicId ? `/dashboard/topic/${topicId}` : '/dashboard')}
            />
        );
    }

    if (!questions || questions.length === 0) return null;

    const currentQ = questions[currentIdx];
    const isLast = currentIdx === questions.length - 1;
    const isFirst = currentIdx === 0;

    /* ── render sentence with inline inputs ────────────────────── */
    const renderSentence = (question, qIdx, isReview) => {
        const parts = question.sentence.split('___');
        const elements = [];

        for (let i = 0; i < parts.length; i++) {
            if (parts[i]) {
                elements.push(
                    <span key={`text-${qIdx}-${i}`} className="text-text-sub-light dark:text-text-sub-dark">
                        {parts[i]}
                    </span>
                );
            }
            if (i < question.blanks.length) {
                const bIdx = i;
                const key = `q${qIdx}-b${bIdx}`;
                const userAnswer = String(answers[key] || '');
                const blank = question.blanks[bIdx];

                if (isReview && results) {
                    const detail = results.details[qIdx]?.blankResults[bIdx];
                    const isCorrect = detail?.isCorrect;
                    elements.push(
                        <span
                            key={`blank-${key}`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 mx-1 rounded-lg font-semibold text-body-sm ${
                                isCorrect
                                    ? 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30'
                                    : 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800'
                            }`}
                        >
                            {userAnswer || '—'}
                            {!isCorrect && (
                                <span className="text-caption text-text-faint-light dark:text-text-faint-dark ml-1">
                                    → {blank.answer}
                                </span>
                            )}
                        </span>
                    );
                } else {
                    elements.push(
                        <input
                            key={`input-${key}`}
                            ref={(el) => { inputRefs.current[key] = el; }}
                            type="text"
                            value={userAnswer}
                            onChange={(e) => handleAnswerChange(qIdx, bIdx, e.target.value)}
                            disabled={submitted}
                            placeholder="type answer"
                            autoComplete="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            className="inline-block w-32 sm:w-40 mx-1 px-3 py-1.5 rounded-lg border-2 border-dashed border-border-light dark:border-border-dark bg-surface-hover-light dark:bg-surface-hover-dark text-body-sm text-text-main-light dark:text-text-main-dark font-semibold text-center placeholder:text-text-faint-light dark:placeholder:text-text-faint-dark placeholder:font-normal focus:border-primary focus:border-solid focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all disabled:opacity-50"
                        />
                    );
                }
            }
        }
        return elements;
    };

    /* ── main render ───────────────────────────────────────────── */
    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to={topicId ? `/dashboard/topic/${topicId}` : '/dashboard'} className="btn-icon w-10 h-10">
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </Link>
                        <div>
                            <h1 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">Fill-ins</h1>
                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark truncate max-w-[150px] sm:max-w-xs">{topicTitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-caption font-semibold text-text-sub-light dark:text-text-sub-dark">
                            {currentIdx + 1}/{questions.length}
                        </div>
                        <div className="text-caption font-semibold px-2.5 py-1 rounded-full bg-primary/8 text-primary">
                            {filledBlanks}/{totalBlanks}
                        </div>
                    </div>
                </div>
                <div className="h-1 bg-surface-hover-light dark:bg-surface-hover-dark">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-4 py-6 pb-44 md:pb-32">
                {!submitted ? (
                    <>
                        <div className="mb-6">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 text-primary text-caption font-semibold mb-3">
                                <span className="material-symbols-outlined text-[14px]">edit_note</span>
                                <span>Question {currentIdx + 1} of {questions.length}</span>
                            </div>
                        </div>

                        <div className="card-base p-6 md:p-8 mb-4">
                            <div className="flex flex-wrap items-baseline gap-1 text-body-lg md:text-display-sm leading-relaxed">
                                {renderSentence(currentQ, currentIdx, false)}
                            </div>
                        </div>

                        {/* Question dots */}
                        <div className="flex items-center justify-center gap-2 my-6">
                            {questions.map((_, idx) => {
                                const qBlanks = questions[idx].blanks || [];
                                const allQFilled = qBlanks.every((_, bIdx) => {
                                    const v = answers[`q${idx}-b${bIdx}`];
                                    return String(v || '').trim().length > 0;
                                });
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setCurrentIdx(idx)}
                                        className={`w-3 h-3 rounded-full transition-all ${
                                            idx === currentIdx
                                                ? 'bg-primary scale-125'
                                                : allQFilled
                                                    ? 'bg-accent-emerald'
                                                    : 'bg-border-light dark:bg-border-dark hover:bg-primary/30'
                                        }`}
                                        aria-label={`Go to question ${idx + 1}`}
                                    />
                                );
                            })}
                        </div>
                    </>
                ) : (
                    /* ── results view ─────────────────────────────────── */
                    <>
                        <div className="card-base p-6 md:p-8 mb-6 text-center">
                            <div className={`text-display-lg font-bold mb-2 ${
                                results.score === results.total ? 'text-accent-emerald' : results.score >= results.total * 0.7 ? 'text-primary' : 'text-accent-amber'
                            }`}>
                                {results.score}/{results.total}
                            </div>
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                {results.score === results.total
                                    ? 'Perfect score! You nailed every blank.'
                                    : results.score >= results.total * 0.7
                                        ? 'Great job! Review the ones you missed below.'
                                        : 'Keep practicing — review the corrections below.'}
                            </p>
                            <div className="mt-4 w-full h-2 bg-border-light dark:bg-border-dark rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${results.score === results.total ? 'bg-accent-emerald' : 'bg-primary'}`}
                                    style={{ width: `${(results.score / results.total) * 100}%` }}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {questions.map((q, qIdx) => (
                                <div key={qIdx} className="card-base p-5">
                                    <p className="text-caption font-semibold text-text-faint-light dark:text-text-faint-dark mb-3">
                                        Question {qIdx + 1}
                                    </p>
                                    <div className="flex flex-wrap items-baseline gap-1 text-body-base leading-relaxed">
                                        {renderSentence(q, qIdx, true)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {saveError && (
                    <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-body-sm text-red-700 dark:text-red-300">
                        {saveError}
                    </div>
                )}
            </main>

            {/* Bottom bar */}
            <div className="fixed bottom-16 md:bottom-0 inset-x-0 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
                <div className="max-w-4xl mx-auto flex gap-3">
                    {submitted ? (
                        <>
                            <button
                                onClick={() => {
                                    setAnswers({});
                                    setSubmitted(false);
                                    setResults(null);
                                    setSaveError('');
                                    setCurrentIdx(0);
                                    setStartedAt(Date.now());
                                }}
                                className="btn-secondary flex-1 py-3 text-body-sm flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">replay</span>
                                <span>Retake</span>
                            </button>
                            <button
                                onClick={() => {
                                    setQuestions(null);
                                    setAnswers({});
                                    setSubmitted(false);
                                    setResults(null);
                                    setLoadError('');
                                    loadExercise();
                                }}
                                className="btn-primary flex-1 py-3 text-body-sm flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                                <span>New Set</span>
                            </button>
                            <Link
                                to={topicId ? `/dashboard/topic/${topicId}` : '/dashboard'}
                                className="btn-secondary px-4 py-3 flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                            </Link>
                        </>
                    ) : (
                        <>
                            {!isFirst && (
                                <button
                                    onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                                    className="btn-secondary px-4 py-3 flex items-center justify-center"
                                >
                                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                                </button>
                            )}
                            {isLast ? (
                                <button
                                    onClick={handleSubmit}
                                    disabled={!allFilled || saving}
                                    className="btn-primary flex-1 py-3 text-body-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span>{saving ? 'Saving...' : 'Submit All'}</span>
                                    {!saving && <span className="material-symbols-outlined text-[18px]">check</span>}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                                    className="btn-primary flex-1 py-3 text-body-sm flex items-center justify-center gap-2"
                                >
                                    <span>Next</span>
                                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FillInExercise;
