import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const EMPTY_LIST = [];

const buildObjectiveExamRoute = (topicId) =>
    topicId ? `/dashboard/quiz/${topicId}` : '/dashboard/quiz';

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const formatDifficulty = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return 'Mixed Difficulty';
    return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)} Difficulty`;
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
    const targetTopicId = course.firstQuizTopicId || course.firstTopicId;
    const quizHref = targetTopicId
        ? buildObjectiveExamRoute(targetTopicId)
        : `/dashboard/lessons?courseId=${course._id}`;
    const quizzesReady = Number(course.quizzesReady || 0);

    return (
        <Link
            to={quizHref}
            className="group rounded-2xl border border-border-subtle bg-surface p-space-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
        >
            <div className="mb-space-5 flex items-start justify-between gap-space-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <span className="material-symbols-outlined">school</span>
                </div>
                <span className="inline-flex items-center rounded-full bg-surface-soft px-space-3 py-space-1 font-label-xs text-label-xs text-text-secondary">
                    {quizzesReady} quiz{quizzesReady === 1 ? '' : 'zes'} ready
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
                <span>{targetTopicId ? 'Start quiz' : 'Open lessons'}</span>
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
    previewQuestionIndex,
    totalQuestions,
    selectedAnswer,
    onSelectAnswer,
}) => {
    const options = resolveQuestionOptions(previewQuestion);
    const progress = totalQuestions > 0
        ? Math.round(((previewQuestionIndex + 1) / totalQuestions) * 100)
        : 0;
    const topicTitle = normalizeText(topic?.title || 'Generated Review');
    const startHref = buildObjectiveExamRoute(topic?._id);

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
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-space-2 md:items-end">
                        <span className="inline-flex items-center rounded-full bg-warning-soft px-space-3 py-space-1 font-label-xs text-label-xs text-warning">
                            {formatDifficulty(previewQuestion?.difficulty)}
                        </span>
                        <span className="font-label-sm text-label-sm text-text-secondary">
                            Question {previewQuestionIndex + 1} of {Math.max(totalQuestions, 1)}
                        </span>
                    </div>
                </div>

                <div className="h-2 w-full rounded-full bg-surface-soft">
                    <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${Math.max(8, progress)}%` }}
                    />
                </div>

                <div className="grid gap-space-8 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div>
                        <h2 className="max-w-3xl font-display-sm text-display-sm text-text-primary leading-tight">
                            {previewQuestion?.questionText || 'Open a generated topic to start an objective quiz.'}
                        </h2>

                        <div className="mt-space-8 flex flex-col gap-space-3">
                            {options.length > 0 ? (
                                options.slice(0, 4).map((option) => {
                                    const isSelected = selectedAnswer === option.value;
                                    return (
                                        <button
                                            key={`${option.value}-${option.text}`}
                                            type="button"
                                            onClick={() => onSelectAnswer(option.value)}
                                            className={`w-full max-w-md rounded-2xl border px-space-4 py-space-4 text-left transition-all ${
                                                isSelected
                                                    ? 'border-success bg-success-soft text-text-primary shadow-sm'
                                                    : 'border-border-subtle bg-surface-soft text-text-secondary hover:border-primary/50 hover:bg-primary-soft/50'
                                            }`}
                                        >
                                            <span className="flex items-center gap-space-3">
                                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-label-md text-label-md ${
                                                    isSelected
                                                        ? 'bg-success text-on-primary'
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
                    </div>

                    <aside className="rounded-2xl border border-border-subtle bg-background-light p-space-5">
                        <p className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-text-muted">
                            Quiz Mode
                        </p>
                        <p className="mt-space-2 font-headline-sm text-headline-sm text-text-primary">
                            Objective Review
                        </p>
                        <p className="mt-space-2 font-body-sm text-body-sm text-text-secondary">
                            {totalQuestions} generated question{totalQuestions === 1 ? '' : 's'} ready from this topic.
                        </p>
                        <Link
                            to={startHref}
                            className="mt-space-5 inline-flex w-full items-center justify-center gap-space-2 rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
                        >
                            Start Quiz
                            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                        </Link>
                        <Link
                            to={course?._id ? `/dashboard/quiz?courseId=${course._id}` : '/dashboard/quiz'}
                            className="mt-space-3 inline-flex w-full items-center justify-center rounded-xl border border-border-default bg-surface px-space-5 py-space-3 font-label-md text-label-md text-text-primary transition-colors hover:bg-surface-soft"
                        >
                            View Topics
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
    const selectedCourseId = routeTopicId ? '' : requestedCourseId || resumeTarget?.courseId || courseList[0]?._id || '';
    const courseWithTopics = useQuery(
        api.courses.getCourseWithTopics,
        isAuthenticated && selectedCourseId ? { courseId: selectedCourseId } : 'skip',
    );
    const topicList = Array.isArray(courseWithTopics?.topics) ? courseWithTopics.topics : EMPTY_LIST;
    const selectedTopicId = useMemo(() => {
        if (routeTopicId) return routeTopicId;
        if (resumeTarget?.topicId && topicList.some((topic) => String(topic._id) === String(resumeTarget.topicId))) {
            return resumeTarget.topicId;
        }
        return topicList[0]?._id || '';
    }, [resumeTarget?.topicId, routeTopicId, topicList]);
    const topicPreview = useQuery(
        api.topics.getTopicWithQuestions,
        isAuthenticated && selectedTopicId ? { topicId: String(selectedTopicId) } : 'skip',
    );
    const selectedCourse = useMemo(() => {
        const topicCourseId = topicPreview?.courseId;
        return courseList.find((course) => String(course._id) === String(topicCourseId))
            || courseList.find((course) => String(course._id) === String(selectedCourseId))
            || courseList[0]
            || null;
    }, [courseList, selectedCourseId, topicPreview?.courseId]);
    const previewQuestions = Array.isArray(topicPreview?.questions)
        ? topicPreview.questions.filter(isObjectiveQuestion)
        : EMPTY_LIST;
    const previewQuestion = useMemo(() => pickPreviewQuestion(previewQuestions), [previewQuestions]);
    const previewQuestionIndex = Math.max(
        0,
        previewQuestions.findIndex((question) => String(question._id) === String(previewQuestion?._id)),
    );
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
        (!routeTopicId && (courseList.length === 0 || topicList.length === 0))
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
                        previewQuestionIndex={previewQuestionIndex}
                        totalQuestions={previewQuestions.length}
                        selectedAnswer={previewSelectedAnswer}
                        onSelectAnswer={(value) => setSelectedAnswer({ questionId: previewQuestionId, value })}
                    />

                    {courseList.length > 1 && (
                        <section className="mt-space-6 grid gap-space-4 md:grid-cols-2">
                            {courseList.slice(0, 4).map((course) => (
                                <CourseQuizCard key={course._id} course={course} />
                            ))}
                        </section>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ActiveQuizSession;
