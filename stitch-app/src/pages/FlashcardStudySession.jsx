import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const EMPTY_LIST = [];

const buildFlashcardRoute = (topicId) =>
    topicId ? `/dashboard/flashcards/${topicId}` : '/dashboard/flashcards';

const normalizeTerm = (value) => String(value || '').replace(/\*\*/g, '').trim();

const normalizeDefinition = (value) => String(value || '').replace(/\*\*/g, '').trim();

const dedupeTerms = (terms) => {
    const seen = new Set();
    const deduped = [];
    for (const item of terms) {
        const term = normalizeTerm(item?.term);
        const definition = normalizeDefinition(item?.definition ?? item?.meaning);
        if (!term || !definition) continue;
        const key = term.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push({
            term,
            definition,
            key: item?.key || key,
        });
    }
    return deduped.slice(0, 40);
};

const parseMarkdownWordBank = (content) => {
    const lines = String(content || '').split('\n');
    const terms = [];
    let inWordBank = false;

    for (const line of lines) {
        const raw = line.trim();
        if (!raw) continue;

        const headingText = raw.replace(/^#{1,6}\s*/, '').replace(/[:-]+$/, '').trim();
        if (/^(word bank|glossary|quick glossary)$/i.test(headingText)) {
            inWordBank = true;
            continue;
        }

        if (inWordBank && /^#{1,6}\s+/.test(raw)) {
            break;
        }

        if (!inWordBank) continue;

        const bullet = raw.replace(/^[-*•]\s*/, '');
        const match = bullet.match(/^(.+?)\s+[—–-]\s+(.+)$/);
        if (!match) continue;

        terms.push({
            term: match[1],
            definition: match[2],
            key: `md-${terms.length}`,
        });
    }

    return dedupeTerms(terms);
};

const getTopicTerms = (topic) => {
    const dbDefinitions = topic?.structuredDefinitions ?? topic?.contentGraph?.definitions;
    if (Array.isArray(dbDefinitions) && dbDefinitions.length > 0) {
        return dedupeTerms(
            dbDefinitions.map((definition, index) => ({
                term: definition.term,
                definition: definition.meaning,
                key: `db-${index}`,
            })),
        );
    }

    return parseMarkdownWordBank(topic?.content);
};

const StudyToolSkeleton = () => (
    <div className="flex-1 flex flex-col md:ml-0 h-[calc(100vh-64px)] overflow-hidden">
        <main className="flex-1 min-h-0 flex flex-col items-center justify-start px-space-8 pt-space-8 pb-space-8 overflow-y-auto">
            <div className="w-full max-w-4xl animate-pulse space-y-space-8">
                <div className="flex items-center justify-between px-space-4">
                    <div className="h-7 w-56 rounded-lg bg-surface-muted" />
                    <div className="h-9 w-40 rounded-full bg-surface-muted" />
                </div>
                <div className="h-[420px] rounded-[24px] bg-surface" />
                <div className="grid grid-cols-4 gap-space-4">
                    <div className="h-16 rounded-xl bg-surface" />
                    <div className="h-16 rounded-xl bg-surface" />
                    <div className="h-16 rounded-xl bg-surface" />
                    <div className="h-16 rounded-xl bg-surface" />
                </div>
            </div>
        </main>
    </div>
);

const EmptyFlashcardState = ({ title = 'Upload material to generate flashcards', description }) => (
    <section className="w-full rounded-2xl border border-border-subtle bg-surface p-space-8 text-center shadow-sm">
        <div className="mx-auto mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <span className="material-symbols-outlined">style</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">
            {title}
        </h2>
        <p className="mx-auto mt-space-3 max-w-xl font-body-base text-body-base text-text-secondary">
            {description || 'Flashcards are created from each topic Word Bank. Upload material or regenerate missing topic content to create a real term-definition deck.'}
        </p>
        <Link
            to="/dashboard/upload"
            className="mt-space-6 inline-flex items-center justify-center gap-space-2 rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
        >
            <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
            Upload Material
        </Link>
    </section>
);

const ResumeFlashcardsCard = ({ resumeTarget }) => {
    if (!resumeTarget?.topicId) return null;

    return (
        <Link
            to={buildFlashcardRoute(resumeTarget.topicId)}
            className="group block rounded-2xl border border-primary/20 bg-primary-soft p-space-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
        >
            <div className="flex flex-col gap-space-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">
                        Latest topic
                    </p>
                    <h2 className="mt-space-2 font-display-sm text-display-sm text-text-primary">
                        {resumeTarget.topicTitle || 'Your latest topic'}
                    </h2>
                    <p className="mt-space-2 font-body-base text-body-base text-text-secondary">
                        Continue the flashcard deck generated from this lesson.
                    </p>
                </div>
                <span className="inline-flex shrink-0 items-center justify-center gap-space-2 rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-label-md text-on-primary shadow-sm transition-colors group-hover:bg-primary-hover">
                    Study Deck
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </span>
            </div>
        </Link>
    );
};

const ConceptReviewCard = ({ item }) => (
    <Link
        to={buildFlashcardRoute(item.topicId)}
        className="group rounded-2xl border border-warning/20 bg-warning-soft/40 p-space-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-warning/40 hover:shadow-md"
    >
        <div className="mb-space-4 flex h-11 w-11 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <span className="material-symbols-outlined">psychology</span>
        </div>
        <h3 className="font-headline-sm text-headline-sm text-text-primary">
            {item.topicTitle || 'Review topic'}
        </h3>
        <p className="mt-space-2 font-body-sm text-body-sm text-text-secondary">
            {Number(item.dueCount || 0)} terms due, {Number(item.weakCount || 0)} need reinforcement.
        </p>
        <div className="mt-space-5 flex items-center justify-between border-t border-border-subtle pt-space-4 font-label-md text-label-md text-primary">
            <span>Study deck</span>
            <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
                arrow_forward
            </span>
        </div>
    </Link>
);

const CourseFlashcardsCard = ({ course }) => (
    <Link
        to={course.firstTopicId ? buildFlashcardRoute(course.firstTopicId) : `/dashboard/lessons?courseId=${course._id}`}
        className="group rounded-2xl border border-border-subtle bg-surface p-space-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
        <div className="mb-space-5 flex items-start justify-between gap-space-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <span className="material-symbols-outlined">folder</span>
            </div>
            <span className="inline-flex items-center rounded-full bg-surface-soft px-space-3 py-space-1 font-label-xs text-label-xs text-text-secondary">
                {Number(course.progress || 0)}% complete
            </span>
        </div>
        <h3 className="font-headline-sm text-headline-sm text-text-primary">
            {course.title || 'Untitled course'}
        </h3>
        {course.description && (
            <p className="mt-space-2 line-clamp-2 font-body-sm text-body-sm text-text-secondary">
                {course.description}
            </p>
        )}
        <div className="mt-space-5 flex items-center justify-between border-t border-border-subtle pt-space-4 font-label-md text-label-md text-primary">
            <span>{course.firstTopicId ? 'Study first topic' : 'Choose topic'}</span>
            <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
                arrow_forward
            </span>
        </div>
    </Link>
);

const FlashcardStudyDeck = ({ topic, terms, starredTerms, onTermsStarred, onCardReviewed }) => {
    const [index, setIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [masteredCount, setMasteredCount] = useState(0);
    const starred = useMemo(() => new Set(starredTerms || []), [starredTerms]);
    const safeIndex = Math.min(index, terms.length - 1);
    const current = terms[safeIndex];
    const progress = terms.length > 0 ? ((safeIndex + 1) / terms.length) * 100 : 0;
    const isStarred = current ? starred.has(current.term) : false;

    const goTo = useCallback((nextIndex) => {
        setIndex(nextIndex);
        setFlipped(false);
    }, []);

    const nextCard = useCallback(() => {
        if (terms.length <= 1) {
            setFlipped(false);
            return;
        }
        goTo((safeIndex + 1) % terms.length);
    }, [goTo, safeIndex, terms.length]);

    const previousCard = useCallback(() => {
        if (terms.length <= 1) {
            setFlipped(false);
            return;
        }
        goTo((safeIndex - 1 + terms.length) % terms.length);
    }, [goTo, safeIndex, terms.length]);

    const markDifficulty = useCallback((rating, mastered) => {
        if (current && onCardReviewed) {
            onCardReviewed({
                term: current.term,
                rating,
                mastered,
            });
        }
        if (mastered) {
            setMasteredCount((value) => Math.min(value + 1, terms.length));
        }
        nextCard();
    }, [current, nextCard, onCardReviewed, terms.length]);

    const toggleStar = useCallback(() => {
        if (!current) return;
        const next = new Set(starred);
        if (next.has(current.term)) next.delete(current.term);
        else next.add(current.term);
        onTermsStarred([...next]);
    }, [current, onTermsStarred, starred]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            const tagName = event.target?.tagName;
            if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                previousCard();
            }
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                nextCard();
            }
            if (event.key === ' ') {
                event.preventDefault();
                setFlipped((value) => !value);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nextCard, previousCard]);

    if (!current) {
        return (
            <EmptyFlashcardState
                title="No Word Bank terms yet"
                description="This topic is missing its generated Word Bank. Regenerate the topic so ChewnPour can create term-definition flashcards."
            />
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="w-full flex flex-col gap-space-4 sm:flex-row sm:items-center sm:justify-between mb-space-8 px-space-4">
                <div>
                    <Link
                        to="/dashboard/flashcards"
                        className="mb-space-3 inline-flex items-center gap-space-1 font-label-xs text-label-xs text-text-muted transition-colors hover:text-primary"
                    >
                        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                        All flashcards
                    </Link>
                    <h2 className="font-headline-sm text-headline-sm text-text-primary flex items-center gap-2">
                        <span className="material-symbols-outlined text-text-muted">folder</span>
                        {topic?.title || 'Generated flashcards'}
                    </h2>
                </div>
                <div className="flex items-center gap-3 bg-surface-soft px-4 py-2 rounded-full border border-border-subtle">
                    <div className="w-28 h-1.5 bg-border-subtle rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span className="font-label-md text-label-md text-text-secondary whitespace-nowrap">
                        {safeIndex + 1}/{terms.length} cards
                    </span>
                </div>
            </div>

            <div className="relative w-full max-w-3xl mx-auto mb-space-10">
                <button
                    type="button"
                    onClick={() => setFlipped((value) => !value)}
                    className="w-full aspect-[3/2] bg-surface rounded-[24px] shadow-sm hover:shadow-md transition-shadow border border-border-subtle flex flex-col items-center justify-center relative cursor-pointer group overflow-hidden"
                    aria-label={flipped ? 'Definition visible, click to show term' : 'Term visible, click to reveal definition'}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-soft/30 rounded-[24px] pointer-events-none" />
                    <div className="absolute top-space-5 left-space-5 flex items-center gap-space-2">
                        <span className="rounded-full bg-surface-soft px-space-3 py-space-1 font-label-xs text-label-xs uppercase tracking-wider text-text-muted">
                            {flipped ? 'Definition' : 'Term'}
                        </span>
                    </div>
                    <div className="relative z-10 px-space-8 sm:px-space-12 text-center max-h-[78%] overflow-y-auto">
                        {flipped ? (
                            <p className="font-body-lg text-body-lg sm:text-headline-sm text-text-secondary leading-relaxed [overflow-wrap:anywhere]">
                                {current.definition}
                            </p>
                        ) : (
                            <h3 className="font-display-xl text-display-lg sm:text-display-xl text-text-primary leading-tight tracking-tight [overflow-wrap:anywhere]">
                                {current.term}
                            </h3>
                        )}
                    </div>
                    <div className="absolute bottom-space-6 flex items-center gap-2 text-text-muted font-label-xs text-label-xs opacity-70 group-hover:opacity-100 transition-opacity bg-surface-soft px-4 py-1.5 rounded-full">
                        <span className="material-symbols-outlined text-[16px]">flip</span>
                        <span>Click or press Space to flip</span>
                    </div>
                </button>
                <button
                    type="button"
                    onClick={toggleStar}
                    className={`absolute top-space-4 right-space-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                        isStarred
                            ? 'border-warning/30 bg-warning-soft text-warning'
                            : 'border-border-subtle bg-surface-soft text-text-muted hover:text-warning'
                    }`}
                    aria-label={isStarred ? 'Unstar this card' : 'Star this card'}
                >
                    <span
                        className="material-symbols-outlined text-[20px]"
                        style={isStarred ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                        star
                    </span>
                </button>
            </div>

            <div className="flex items-center justify-center gap-space-3 mb-space-6">
                <button
                    type="button"
                    onClick={previousCard}
                    className="btn-icon size-10"
                    aria-label="Previous card"
                >
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
                <p className="font-label-sm text-label-sm text-text-muted">
                    {masteredCount} mastered this session
                </p>
                <button
                    type="button"
                    onClick={nextCard}
                    className="btn-icon size-10"
                    aria-label="Next card"
                >
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
            </div>

            <div className="flex flex-wrap gap-space-4 justify-center w-full max-w-2xl mx-auto">
                <button
                    type="button"
                    onClick={() => markDifficulty('again', false)}
                    className="min-w-[7rem] flex-1 flex items-center justify-center gap-2 bg-surface hover:bg-error-soft border border-border-subtle hover:border-error-soft py-space-3 rounded-xl transition-all shadow-sm group"
                >
                    <span className="font-label-md text-label-md text-text-primary group-hover:text-error transition-colors">Again</span>
                </button>
                <button
                    type="button"
                    onClick={() => markDifficulty('hard', false)}
                    className="min-w-[7rem] flex-1 flex items-center justify-center gap-2 bg-surface hover:bg-warning-soft border border-border-subtle hover:border-warning-soft py-space-3 rounded-xl transition-all shadow-sm group"
                >
                    <span className="font-label-md text-label-md text-text-primary group-hover:text-warning transition-colors">Hard</span>
                </button>
                <button
                    type="button"
                    onClick={() => markDifficulty('good', true)}
                    className="min-w-[7rem] flex-1 flex items-center justify-center gap-2 bg-surface hover:bg-primary-soft border border-border-subtle hover:border-primary-soft py-space-3 rounded-xl transition-all shadow-sm group"
                >
                    <span className="font-label-md text-label-md text-text-primary group-hover:text-primary-hover transition-colors">Good</span>
                </button>
                <button
                    type="button"
                    onClick={() => markDifficulty('easy', true)}
                    className="min-w-[7rem] flex-1 flex items-center justify-center gap-2 bg-surface hover:bg-success-soft border border-border-subtle hover:border-success-soft py-space-3 rounded-xl transition-all shadow-sm group"
                >
                    <span className="font-label-md text-label-md text-text-primary group-hover:text-success transition-colors">Easy</span>
                </button>
            </div>
        </div>
    );
};

const FlashcardsIndex = ({ resumeTarget, reviewItems, courseList }) => (
    <div className="w-full max-w-5xl">
        <div className="mb-space-6 flex flex-col gap-space-2">
            <p className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">
                Flashcards
            </p>
            <h1 className="font-display-sm text-display-sm text-text-primary">
                Review terms from your lessons
            </h1>
            <p className="max-w-2xl font-body-base text-body-base text-text-secondary">
                Flashcards are built from generated topic Word Banks and definitions tied to your account.
            </p>
        </div>

        <div className="space-y-space-5">
            <ResumeFlashcardsCard resumeTarget={resumeTarget} />

            {reviewItems.length > 0 && (
                <section>
                    <h2 className="mb-space-3 font-headline-xs text-headline-xs text-text-primary">
                        Due for review
                    </h2>
                    <div className="grid gap-space-4 md:grid-cols-2">
                        {reviewItems.map((item) => (
                            <ConceptReviewCard key={item.topicId} item={item} />
                        ))}
                    </div>
                </section>
            )}

            {courseList.length > 0 ? (
                <section>
                    <h2 className="mb-space-3 font-headline-xs text-headline-xs text-text-primary">
                        Courses
                    </h2>
                    <div className="grid gap-space-4 md:grid-cols-2">
                        {courseList.map((course) => (
                            <CourseFlashcardsCard key={course._id} course={course} />
                        ))}
                    </div>
                </section>
            ) : !resumeTarget?.topicId && reviewItems.length === 0 ? (
                <EmptyFlashcardState />
            ) : null}
        </div>
    </div>
);

const FlashcardStudySession = () => {
    const { deckId } = useParams();
    const { isAuthenticated } = useConvexAuth();
    const courses = useQuery(api.courses.getUserCourses, isAuthenticated ? {} : 'skip');
    const resumeTarget = useQuery(api.topics.getResumeTarget, isAuthenticated ? {} : 'skip');
    const reviewQueue = useQuery(
        api.concepts.getConceptReviewQueue,
        isAuthenticated ? { limit: 12 } : 'skip',
    );
    const activeTopicId = deckId ? String(deckId) : '';
    const topic = useQuery(
        api.topics.getTopicWithQuestions,
        isAuthenticated && activeTopicId ? { topicId: String(activeTopicId) } : 'skip',
    );
    const topicProgress = useQuery(
        api.topics.getUserTopicProgress,
        isAuthenticated && activeTopicId ? { topicId: String(activeTopicId) } : 'skip',
    );
    const upsertProgress = useMutation(api.topics.upsertTopicProgress);
    const recordConceptReview = useMutation(api.concepts.createConceptSessionAttempt);

    const handleTermsStarred = useCallback((starred) => {
        if (!activeTopicId) return;
        upsertProgress({
            topicId: String(activeTopicId),
            termsStarred: starred,
            lastStudiedAt: Date.now(),
        }).catch(() => {});
    }, [activeTopicId, upsertProgress]);

    const reviewItems = Array.isArray(reviewQueue?.items) ? reviewQueue.items : EMPTY_LIST;
    const terms = useMemo(() => getTopicTerms(topic), [topic]);

    const handleCardReviewed = useCallback(({ term, rating, mastered }) => {
        if (!activeTopicId || !term) return;
        const reviewedAt = Date.now();
        recordConceptReview({
            topicId: String(activeTopicId),
            score: mastered ? 1 : 0,
            totalQuestions: 1,
            timeTakenSeconds: 0,
            questionText: `Flashcard review: ${term}`,
            answers: {
                source: 'flashcards',
                rating,
                correctAnswers: [term],
                userAnswers: [mastered ? term : `${term} (${rating})`],
            },
        }).catch(() => {});
        upsertProgress({
            topicId: String(activeTopicId),
            lastStudiedAt: reviewedAt,
        }).catch(() => {});
    }, [activeTopicId, recordConceptReview, upsertProgress]);

    if (
        !isAuthenticated
        || courses === undefined
        || resumeTarget === undefined
        || reviewQueue === undefined
        || (activeTopicId && (topic === undefined || topicProgress === undefined))
    ) {
        return <StudyToolSkeleton />;
    }

    const courseList = Array.isArray(courses) ? courses : EMPTY_LIST;

    return (
        <div className="flex-1 flex flex-col md:ml-0 h-[calc(100vh-64px)] overflow-hidden">
            <main className="flex-1 min-h-0 flex flex-col items-center justify-start px-space-8 pt-space-8 pb-space-8 overflow-y-auto">
                {activeTopicId ? (
                    <FlashcardStudyDeck
                        key={String(activeTopicId)}
                        topic={topic}
                        terms={terms}
                        starredTerms={topicProgress?.termsStarred}
                        onTermsStarred={handleTermsStarred}
                        onCardReviewed={handleCardReviewed}
                    />
                ) : (
                    <FlashcardsIndex
                        resumeTarget={resumeTarget}
                        reviewItems={reviewItems}
                        courseList={courseList}
                    />
                )}
            </main>
        </div>
    );
};

export default FlashcardStudySession;
