import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const EMPTY_LIST = [];
const FRESH_OBJECTIVE_QUIZ_DISPLAY_COUNT = 5;

const buildObjectiveExamRoute = (topicId) =>
    topicId ? `/dashboard/quiz/${topicId}?autostart=mcq` : '/dashboard/quiz';

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const formatDifficulty = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return '';
    return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)} difficulty`;
};

const formatCourseLabel = (course) => normalizeText(course?.title || 'Generated Course').toUpperCase();

const parseOptionJson = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
};

const coerceQuestionOptions = (rawOptions) => {
    if (!rawOptions) return EMPTY_LIST;

    let options = rawOptions;
    const parsedOptions = parseOptionJson(options);
    if (parsedOptions) options = parsedOptions;

    if (options && !Array.isArray(options) && typeof options === 'object') {
        if (Array.isArray(options.options)) {
            options = options.options;
        } else if (Array.isArray(options.choices)) {
            options = options.choices;
        } else {
            options = [options];
        }
    }

    if (!Array.isArray(options)) options = [options];

    return options.flatMap((option) => {
        const parsedOption = parseOptionJson(option);
        if (Array.isArray(parsedOption)) return parsedOption;
        return parsedOption ? [parsedOption] : [option];
    });
};

const normalizeQuestionOption = (option, index) => {
    if (option && typeof option === 'object') {
        const label = normalizeText(option.label ?? option.id) || String.fromCharCode(65 + index);
        const text = normalizeText(option.text ?? option.value ?? option.answer ?? option.choiceText);
        return text ? { label, value: String(label), text } : null;
    }

    let label = String.fromCharCode(65 + index);
    let text = normalizeText(option);
    const labelMatch = text.match(/^\s*([A-D])[).\-:\s]+(.+)$/i);
    if (labelMatch) {
        label = labelMatch[1].toUpperCase();
        text = normalizeText(labelMatch[2]);
    }
    return text
        ? { label, value: label, text }
        : null;
};

const resolveQuestionOptions = (question) => {
    const source = coerceQuestionOptions(question?.options);
    return source.flatMap((option, index) => {
        const normalized = normalizeQuestionOption(option, index);
        return normalized ? [normalized] : [];
    });
};

const isObjectiveQuestion = (question) =>
    question && String(question.questionType || '').toLowerCase() !== 'essay';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(Object(object), key);

const hasQuizReadinessMetadata = (course) =>
    hasOwn(course, 'quizzesReady') || hasOwn(course, 'firstQuizTopicId');

const hasQuizContent = (course) =>
    Boolean(course?.firstQuizTopicId) || Number(course?.quizzesReady || 0) > 0;

const shouldShowQuizCourse = (course) =>
    hasQuizContent(course) || !hasQuizReadinessMetadata(course);

const hasTopicQuizReadinessMetadata = (topic) =>
    hasOwn(topic, 'usableMcqCount') || hasOwn(topic, 'usableObjectiveCount');

const isQuizReadyTopic = (topic) => {
    if ((topic?.assessmentRoute || 'topic_quiz') !== 'topic_quiz') return false;
    if (!hasTopicQuizReadinessMetadata(topic)) return true;
    return Number(topic?.usableMcqCount || topic?.usableObjectiveCount || 0) > 0;
};

const resolveObjectiveAttemptQuestionCount = (topic, previewQuestions) => {
    const rawConfiguredTarget = Number(topic?.mcqTargetCount || topic?.totalObjectiveTargetCount || 0);
    const configuredTarget = Number.isFinite(rawConfiguredTarget) ? rawConfiguredTarget : 0;
    const availablePreviewCount = Array.isArray(previewQuestions) ? previewQuestions.length : 0;
    const target = Math.max(
        FRESH_OBJECTIVE_QUIZ_DISPLAY_COUNT,
        configuredTarget,
        availablePreviewCount,
    );
    return Math.max(1, Math.min(FRESH_OBJECTIVE_QUIZ_DISPLAY_COUNT, Math.round(target)));
};

const pickPreviewQuestion = (questions) => {
    const objectiveQuestions = Array.isArray(questions)
        ? questions.filter(isObjectiveQuestion)
        : EMPTY_LIST;
    return objectiveQuestions.find((question) => resolveQuestionOptions(question).length > 0)
        || objectiveQuestions[0]
        || null;
};

const StudyToolSkeleton = () => (
    <div className="flex-1 flex flex-col ml-0 h-[calc(100vh-64px)] overflow-hidden">
        <main className="flex-1 min-h-0 p-space-4 md:px-space-10 md:py-space-8 flex flex-col items-center justify-start overflow-y-auto">
            <div className="w-full max-w-5xl animate-pulse space-y-space-6">
                <div className="h-8 w-44 rounded-lg bg-surface-muted" />
                <div className="h-36 rounded-2xl bg-surface" />
                <div className="grid gap-space-4 md:grid-cols-2">
                    <div className="h-40 rounded-2xl bg-surface" />
                    <div className="h-40 rounded-2xl bg-surface" />
                </div>
            </div>
        </main>
    </div>
);

const EmptyStudyToolState = () => (
    <section className="w-full rounded-2xl border border-border-subtle bg-surface p-space-8 text-center shadow-sm">
        <div className="mx-auto mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <span className="material-symbols-outlined">quiz</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">
            Upload material to generate quizzes
        </h2>
        <p className="mx-auto mt-space-3 max-w-xl font-body-base text-body-base text-text-secondary">
            Quizzes are generated from your own course topics. Add a PDF, slide deck, document, or image to start practicing from real study material.
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

const CourseQuizCard = ({ course }) => {
    const targetTopicId = course.firstQuizTopicId;
    const quizzesReady = Number(course.quizzesReady || 0);
    const metadataKnown = hasQuizReadinessMetadata(course);
    if (metadataKnown && !targetTopicId && quizzesReady <= 0) return null;
    const targetHref = targetTopicId ? buildObjectiveExamRoute(targetTopicId) : `/dashboard/quiz?courseId=${course._id}`;
    const statusLabel = quizzesReady > 0
        ? `${quizzesReady} topic${quizzesReady === 1 ? '' : 's'} ready`
        : targetTopicId ? 'Quiz ready' : 'Open topics';

    return (
        <Link
            to={targetHref}
            className="group rounded-2xl border border-border-subtle bg-surface p-space-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
        >
            <div className="mb-space-5 flex items-start justify-between gap-space-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <span className="material-symbols-outlined">school</span>
                </div>
                <span className="inline-flex items-center rounded-full bg-surface-soft px-space-3 py-space-1 font-label-xs text-label-xs text-text-secondary">
                    {statusLabel}
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
                <span>{targetTopicId ? 'Start quiz' : 'Review topics'}</span>
                <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
                    arrow_forward
                </span>
            </div>
        </Link>
    );
};

const QuizMockupPanel = ({
    course,
    topic,
    previewQuestion,
    attemptQuestionCount,
    selectedAnswer,
    onSelectAnswer,
}) => {
    const options = resolveQuestionOptions(previewQuestion);
    const topicTitle = normalizeText(topic?.title || 'Generated Review');
    const startHref = buildObjectiveExamRoute(topic?._id);
    const difficultyLabel = formatDifficulty(previewQuestion?.difficulty);
    const topicHref = topic?._id ? `/dashboard/topic/${topic._id}` : '/dashboard/lessons';

    return (
        <section className="w-full rounded-[28px] border border-border-subtle bg-surface p-space-5 md:p-space-8 shadow-sm">
            <div className="flex flex-col gap-space-5">
                <div className="flex flex-col gap-space-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-text-secondary">
                            {formatCourseLabel(course)}
                        </p>
                        <h1 className="mt-space-1 max-w-2xl font-display-sm text-display-sm text-text-primary">
                            {topicTitle}
                        </h1>
                        <p className="mt-space-2 font-body-sm text-body-sm text-text-secondary">
                            Preview the first question, then start to begin a timed attempt.
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-space-2 md:items-end">
                        {difficultyLabel ? (
                            <span className="inline-flex items-center rounded-full bg-warning-soft px-space-3 py-space-1 font-label-xs text-label-xs text-warning">
                                {difficultyLabel}
                            </span>
                        ) : null}
                        <span className="font-label-sm text-label-sm text-text-secondary">
                            Fresh {attemptQuestionCount}-question quiz
                        </span>
                    </div>
                </div>

                <div className="grid gap-space-8 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div>
                        <span className="inline-flex items-center rounded-full bg-primary-subtle px-space-3 py-space-1 font-label-xs text-label-xs text-primary">
                            Sample question
                        </span>
                        <h2 className="mt-space-3 max-w-3xl font-display-sm text-display-sm text-text-primary leading-tight">
                            {previewQuestion?.questionText || 'Open a generated topic to start an objective quiz.'}
                        </h2>

                        <div
                            className="mt-space-8 flex flex-col gap-space-3"
                            role="radiogroup"
                            aria-label="Sample question options"
                        >
                            {options.length > 0 ? (
                                options.slice(0, 4).map((option) => {
                                    const isSelected = selectedAnswer === option.value;
                                    return (
                                        <button
                                            key={`${option.value}-${option.text}`}
                                            type="button"
                                            role="radio"
                                            aria-checked={isSelected}
                                            onClick={() => onSelectAnswer(option.value)}
                                            className={`w-full max-w-md rounded-2xl border px-space-4 py-space-4 text-left transition-all ${
                                                isSelected
                                                    ? 'border-primary bg-primary-subtle text-text-primary shadow-sm'
                                                    : 'border-border-subtle bg-surface-soft text-text-secondary hover:border-primary/50 hover:bg-primary-subtle'
                                            }`}
                                        >
                                            <span className="flex items-center gap-space-3">
                                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-label-md text-label-md ${
                                                    isSelected
                                                        ? 'bg-primary text-on-primary'
                                                        : 'bg-surface text-text-secondary'
                                                }`}>
                                                    {option.label}
                                                </span>
                                                <span className="font-label-md text-label-md">{option.text}</span>
                                            </span>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="max-w-md rounded-2xl border border-dashed border-border-strong bg-surface-soft p-space-5">
                                    <p className="font-body-sm text-body-sm text-text-secondary">
                                        This topic is still preparing objective options.
                                    </p>
                                </div>
                            )}
                        </div>
                        <p className="mt-space-3 max-w-md font-label-xs text-label-xs text-text-muted">
                            Answers are scored once you start the quiz.
                        </p>
                    </div>

                    <aside className="rounded-2xl border border-border-subtle bg-surface-soft p-space-5">
                        <p className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-text-muted">
                            Quiz mode
                        </p>
                        <p className="mt-space-2 font-headline-sm text-headline-sm text-text-primary">
                            Objective review
                        </p>
                        <p className="mt-space-2 font-body-sm text-body-sm text-text-secondary">
                            Starts a fresh {attemptQuestionCount}-question attempt from this topic.
                        </p>
                        <Link
                            to={startHref}
                            className="mt-space-5 inline-flex w-full items-center justify-center gap-space-2 rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
                        >
                            Start quiz
                            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                        </Link>
                        <Link
                            to={topicHref}
                            className="mt-space-3 inline-flex w-full items-center justify-center rounded-xl border border-border-default bg-surface px-space-5 py-space-3 font-label-md text-label-md text-text-primary transition-colors hover:bg-surface-soft"
                        >
                            Review lesson first
                        </Link>
                    </aside>
                </div>
            </div>
        </section>
    );
};

const ActiveQuizSession = () => {
    const { quizId } = useParams();
    const [searchParams] = useSearchParams();
    const routeTopicId = typeof quizId === 'string' ? quizId.trim() : '';
    const requestedCourseId = searchParams.get('courseId') || '';
    const { isAuthenticated } = useConvexAuth();
    const [selectedAnswer, setSelectedAnswer] = useState({ questionId: '', value: '' });
    const courses = useQuery(api.courses.getUserCourses, isAuthenticated ? {} : 'skip');
    const resumeTarget = useQuery(api.topics.getResumeTarget, isAuthenticated ? {} : 'skip');
    const courseList = Array.isArray(courses) ? courses : EMPTY_LIST;
    const quizReadyCourses = useMemo(() => courseList.filter(hasQuizContent), [courseList]);
    const visibleQuizCourses = useMemo(() => courseList.filter(shouldShowQuizCourse), [courseList]);
    const selectionCourseList = quizReadyCourses.length > 0 ? quizReadyCourses : visibleQuizCourses;
    const requestedCourse = selectionCourseList.find((course) => String(course._id) === String(requestedCourseId));
    const resumeCourse = resumeTarget?.courseId
        ? selectionCourseList.find((course) => String(course._id) === String(resumeTarget.courseId))
        : null;
    const selectedCourseId = routeTopicId ? '' : requestedCourse?._id || resumeCourse?._id || selectionCourseList[0]?._id || courseList[0]?._id || '';
    const courseWithTopics = useQuery(
        api.courses.getCourseWithTopics,
        isAuthenticated && selectedCourseId ? { courseId: selectedCourseId } : 'skip',
    );
    const topicList = Array.isArray(courseWithTopics?.topics) ? courseWithTopics.topics : EMPTY_LIST;
    const quizReadyTopicList = useMemo(() => topicList.filter(isQuizReadyTopic), [topicList]);
    const selectedTopicId = (() => {
        if (routeTopicId) return routeTopicId;
        if (resumeTarget?.topicId && quizReadyTopicList.some((topic) => String(topic._id) === String(resumeTarget.topicId))) {
            return resumeTarget.topicId;
        }
        return requestedCourse?.firstQuizTopicId || resumeCourse?.firstQuizTopicId || quizReadyCourses[0]?.firstQuizTopicId || quizReadyTopicList[0]?._id || '';
    })();
    const topicPreview = useQuery(
        api.topics.getTopicWithQuestions,
        isAuthenticated && selectedTopicId ? { topicId: String(selectedTopicId) } : 'skip',
    );
    const selectedCourse = useMemo(() => {
        const topicCourseId = topicPreview?.courseId;
        return selectionCourseList.find((course) => String(course._id) === String(topicCourseId))
            || selectionCourseList.find((course) => String(course._id) === String(selectedCourseId))
            || courseList.find((course) => String(course._id) === String(topicCourseId))
            || selectionCourseList[0]
            || null;
    }, [courseList, selectionCourseList, selectedCourseId, topicPreview?.courseId]);
    const previewQuestions = Array.isArray(topicPreview?.questions)
        ? topicPreview.questions.filter(isObjectiveQuestion)
        : EMPTY_LIST;
    const attemptQuestionCount = resolveObjectiveAttemptQuestionCount(topicPreview, previewQuestions);
    const previewQuestion = useMemo(() => pickPreviewQuestion(previewQuestions), [previewQuestions]);
    const previewQuestionId = String(previewQuestion?._id || '');
    const previewSelectedAnswer = selectedAnswer.questionId === previewQuestionId
        ? selectedAnswer.value
        : '';

    if (
        !isAuthenticated
        || courses === undefined
        || resumeTarget === undefined
        || (!routeTopicId && selectedCourseId && courseWithTopics === undefined)
        || (selectedTopicId && topicPreview === undefined)
    ) {
        return <StudyToolSkeleton />;
    }

    if (
        (!routeTopicId && (visibleQuizCourses.length === 0 || quizReadyTopicList.length === 0))
        || !topicPreview
        || !previewQuestion
    ) {
        return (
            <div className="flex-1 flex flex-col ml-0 h-[calc(100vh-64px)] overflow-hidden">
                <main className="flex-1 min-h-0 p-space-4 md:px-space-10 md:py-space-8 flex flex-col items-center justify-start overflow-y-auto">
                    <div className="w-full max-w-5xl">
                        <EmptyStudyToolState />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col ml-0 h-[calc(100vh-64px)] overflow-hidden">
            <main className="flex-1 min-h-0 p-space-4 md:px-space-10 md:py-space-8 flex flex-col items-center justify-start overflow-y-auto">
                <div className="w-full max-w-5xl">
                    <QuizMockupPanel
                        course={selectedCourse}
                        topic={topicPreview}
                        previewQuestion={previewQuestion}
                        attemptQuestionCount={attemptQuestionCount}
                        selectedAnswer={previewSelectedAnswer}
                        onSelectAnswer={(value) => setSelectedAnswer({ questionId: previewQuestionId, value })}
                    />

                    {visibleQuizCourses.length > 1 && (
                        <section className="mt-space-8">
                            <div className="mb-space-4 flex items-end justify-between gap-space-3">
                                <div>
                                    <h2 className="font-headline-sm text-headline-sm text-text-primary">More quizzes</h2>
                                    <p className="mt-space-1 font-body-sm text-body-sm text-text-secondary">
                                        Pick another course to practice from.
                                    </p>
                                </div>
                            </div>
                            <div className="grid gap-space-4 md:grid-cols-2">
                                {visibleQuizCourses.slice(0, 4).map((course) => (
                                    <CourseQuizCard key={course._id} course={course} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ActiveQuizSession;
