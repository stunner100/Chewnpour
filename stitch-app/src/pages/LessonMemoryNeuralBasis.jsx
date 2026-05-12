import React, { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const EMPTY_LIST = [];

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const stripMarkdown = (value) =>
    normalizeText(
        String(value || '')
            .replace(/```[\s\S]*?```/g, ' ')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/[#>*_~[\]()]/g, ' ')
            .replace(/\s[-*]\s/g, ' '),
    );

const firstContentParagraph = (content) => {
    const paragraphs = String(content || '')
        .split(/\n{2,}/)
        .map(stripMarkdown)
        .filter((paragraph) => paragraph.length > 80);
    return paragraphs[0] || '';
};

const resolveSummary = (topic) =>
    normalizeText(topic?.description)
    || normalizeText(topic?.contentGraph?.summary)
    || firstContentParagraph(topic?.content)
    || 'This lesson was generated from your uploaded material.';

const resolveLearningObjectives = (topic) => {
    const objectives = topic?.structuredLearningObjectives
        || topic?.contentGraph?.learningObjectives
        || topic?.contentGraph?.objectives
        || EMPTY_LIST;
    if (Array.isArray(objectives) && objectives.length > 0) {
        return objectives.map(stripMarkdown).filter(Boolean).slice(0, 5);
    }
    return EMPTY_LIST;
};

const resolveDefinitions = (topic) => {
    const definitions = topic?.structuredDefinitions || topic?.contentGraph?.definitions || EMPTY_LIST;
    if (!Array.isArray(definitions)) return EMPTY_LIST;
    return definitions.flatMap((definition) => {
        const term = normalizeText(definition?.term || definition?.label);
        const meaning = normalizeText(definition?.meaning || definition?.definition || definition?.description);
        return term && meaning ? [{ term, meaning }] : [];
    }).slice(0, 6);
};

const resolveExamples = (topic) => {
    const examples = topic?.structuredExamples || topic?.contentGraph?.examples || EMPTY_LIST;
    if (!Array.isArray(examples)) return EMPTY_LIST;
    return examples.map((example) => stripMarkdown(example?.example || example?.text || example)).filter(Boolean).slice(0, 3);
};

const resolveConfusions = (topic) => {
    const confusions = topic?.structuredLikelyConfusions
        || topic?.contentGraph?.likelyConfusions
        || topic?.contentGraph?.confusions
        || EMPTY_LIST;
    if (!Array.isArray(confusions)) return EMPTY_LIST;
    return confusions.map((confusion) => stripMarkdown(confusion?.confusion || confusion?.text || confusion)).filter(Boolean).slice(0, 3);
};

const hasLessonContent = (course) =>
    Boolean(course?.firstTopicId) || Number(course?.topicCount || 0) > 0;

const StudyToolSkeleton = () => (
    <div className="flex-1 flex flex-col lg:flex-row relative pb-20 md:pb-0">
        <article className="flex-1 mx-auto w-full max-w-5xl px-space-4 md:px-space-10 pt-space-6 pb-space-8 md:pt-space-8 md:pb-space-10 lg:pt-space-8 lg:pb-space-12">
            <div className="animate-pulse space-y-space-6">
                <div className="h-8 w-48 rounded-lg bg-surface-muted" />
                <div className="h-36 rounded-2xl bg-surface" />
                <div className="grid gap-space-4 md:grid-cols-2">
                    <div className="h-44 rounded-2xl bg-surface" />
                    <div className="h-44 rounded-2xl bg-surface" />
                </div>
            </div>
        </article>
    </div>
);

const EmptyLessonsState = ({ title = 'Upload material to generate lessons', description }) => (
    <section className="rounded-2xl border border-border-subtle bg-surface p-space-8 text-center shadow-sm">
        <div className="mx-auto mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <span className="material-symbols-outlined">menu_book</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">
            {title}
        </h2>
        <p className="mx-auto mt-space-3 max-w-xl font-body-base text-body-base text-text-secondary">
            {description || 'Lessons are created from your own notes, slides, documents, and images. Add material to build your first real lesson.'}
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

const ResumeLessonCard = ({ resumeTarget }) => {
    if (!resumeTarget?.topicId) return null;

    return (
        <section className="rounded-2xl border border-primary/20 bg-primary-soft p-space-6 shadow-sm">
            <div className="flex flex-col gap-space-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">
                        Continue reading
                    </p>
                    <h2 className="mt-space-2 font-display-sm text-display-sm text-text-primary">
                        {resumeTarget.topicTitle || 'Your latest topic'}
                    </h2>
                    <p className="mt-space-2 font-body-base text-body-base text-text-secondary">
                        Jump back into the generated lesson you last studied.
                    </p>
                </div>
                <Link
                    to={`/dashboard/lessons/${resumeTarget.topicId}`}
                    className="inline-flex shrink-0 items-center justify-center gap-space-2 rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
                >
                    Open Lesson
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </Link>
            </div>
        </section>
    );
};

const CourseLessonCard = ({ course, selected = false }) => (
    <Link
        to={`/dashboard/lessons?courseId=${course._id}`}
        className={`group rounded-2xl border bg-surface p-space-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${
            selected ? 'border-primary/50 ring-2 ring-primary-soft' : 'border-border-subtle'
        }`}
    >
        <div className="mb-space-5 flex items-start justify-between gap-space-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <span className="material-symbols-outlined">auto_stories</span>
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
            <span>View lessons</span>
            <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
                arrow_forward
            </span>
        </div>
    </Link>
);

const TopicLessonCard = ({ topic }) => (
    <Link
        to={`/dashboard/lessons/${topic._id}`}
        className="group rounded-2xl border border-border-subtle bg-surface p-space-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
        <div className="mb-space-4 flex items-start justify-between gap-space-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
                <span className="material-symbols-outlined">article</span>
            </div>
            <span className="inline-flex items-center rounded-full bg-surface-soft px-space-3 py-space-1 font-label-xs text-label-xs text-text-secondary">
                {Number(topic.progress || topic.bestScore || 0)}%
            </span>
        </div>
        <h3 className="font-headline-sm text-headline-sm text-text-primary">
            {topic.title || 'Untitled lesson'}
        </h3>
        {topic.description && (
            <p className="mt-space-2 line-clamp-2 font-body-sm text-body-sm text-text-secondary">
                {topic.description}
            </p>
        )}
        <div className="mt-space-5 flex items-center justify-between border-t border-border-subtle pt-space-4 font-label-md text-label-md text-primary">
            <span>Open lesson</span>
            <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
                arrow_forward
            </span>
        </div>
    </Link>
);

const DetailSection = ({ icon, title, children }) => (
    <section className="rounded-2xl border border-border-subtle bg-surface p-space-6 shadow-sm">
        <div className="mb-space-4 flex items-center gap-space-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-text-primary">{title}</h2>
        </div>
        {children}
    </section>
);

const LessonDetailView = ({ topic }) => {
    const summary = resolveSummary(topic);
    const objectives = useMemo(() => resolveLearningObjectives(topic), [topic]);
    const definitions = useMemo(() => resolveDefinitions(topic), [topic]);
    const examples = useMemo(() => resolveExamples(topic), [topic]);
    const confusions = useMemo(() => resolveConfusions(topic), [topic]);
    const contentPreview = firstContentParagraph(topic?.content);

    return (
        <div className="flex-1 flex flex-col lg:flex-row relative pb-20 md:pb-0">
            <article className="flex-1 mx-auto w-full max-w-5xl px-space-4 md:px-space-10 pt-space-6 pb-space-8 md:pt-space-8 md:pb-space-10 lg:pt-space-8 lg:pb-space-12">
                <div className="mb-space-6">
                    <Link
                        to="/dashboard/lessons"
                        className="inline-flex items-center gap-space-2 font-label-md text-label-md text-text-secondary transition-colors hover:text-primary"
                    >
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        All lessons
                    </Link>
                </div>

                <header className="rounded-[28px] border border-border-subtle bg-surface p-space-6 md:p-space-8 shadow-sm">
                    <p className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">
                        Generated Lesson
                    </p>
                    <h1 className="mt-space-3 max-w-3xl font-display-md text-display-md text-text-primary">
                        {topic?.title || 'Untitled lesson'}
                    </h1>
                    <p className="mt-space-4 max-w-3xl font-body-lg text-body-lg text-text-secondary">
                        {summary}
                    </p>
                    <div className="mt-space-6 flex flex-col gap-space-3 sm:flex-row">
                        <Link
                            to={`/dashboard/quiz/${topic._id}`}
                            className="inline-flex items-center justify-center gap-space-2 rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
                        >
                            Start Quiz
                            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                        </Link>
                        <Link
                            to={`/dashboard/flashcards/${topic._id}`}
                            className="inline-flex items-center justify-center gap-space-2 rounded-xl border border-border-default bg-surface px-space-5 py-space-3 font-label-md text-label-md text-text-primary transition-colors hover:bg-surface-soft"
                        >
                            Study Flashcards
                            <span className="material-symbols-outlined text-[20px]">style</span>
                        </Link>
                        <Link
                            to="/dashboard/ai-tutor"
                            className="inline-flex items-center justify-center gap-space-2 rounded-xl border border-border-default bg-surface px-space-5 py-space-3 font-label-md text-label-md text-text-primary transition-colors hover:bg-surface-soft"
                        >
                            Ask AI Tutor
                            <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                        </Link>
                    </div>
                </header>

                <div className="mt-space-6 grid gap-space-5 lg:grid-cols-2">
                    <DetailSection icon="lightbulb" title="Big Idea">
                        <p className="font-body-base text-body-base text-text-secondary">{summary}</p>
                    </DetailSection>

                    <DetailSection icon="checklist" title="Key Ideas">
                        {objectives.length > 0 ? (
                            <ul className="space-y-space-3">
                                {objectives.map((objective) => (
                                    <li key={objective} className="flex gap-space-3 font-body-sm text-body-sm text-text-secondary">
                                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                                        <span>{objective}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="font-body-sm text-body-sm text-text-muted">Key ideas will appear after this lesson finishes processing.</p>
                        )}
                    </DetailSection>

                    <DetailSection icon="dictionary" title="Definitions">
                        {definitions.length > 0 ? (
                            <div className="space-y-space-4">
                                {definitions.map((definition) => (
                                    <div key={definition.term}>
                                        <h3 className="font-label-md text-label-md text-text-primary">{definition.term}</h3>
                                        <p className="mt-space-1 font-body-sm text-body-sm text-text-secondary">{definition.meaning}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="font-body-sm text-body-sm text-text-muted">No definitions were generated for this topic yet.</p>
                        )}
                    </DetailSection>

                    <DetailSection icon="psychology" title="Common Confusions">
                        {confusions.length > 0 ? (
                            <ul className="space-y-space-3">
                                {confusions.map((confusion) => (
                                    <li key={confusion} className="rounded-xl bg-warning-soft/50 p-space-3 font-body-sm text-body-sm text-text-secondary">
                                        {confusion}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="font-body-sm text-body-sm text-text-muted">Common confusions will appear when the lesson has enough source context.</p>
                        )}
                    </DetailSection>
                </div>

                <div className="mt-space-5 grid gap-space-5">
                    <DetailSection icon="science" title="Worked Examples">
                        {examples.length > 0 ? (
                            <div className="space-y-space-3">
                                {examples.map((example) => (
                                    <p key={example} className="rounded-xl bg-surface-soft p-space-4 font-body-sm text-body-sm text-text-secondary">
                                        {example}
                                    </p>
                                ))}
                            </div>
                        ) : (
                            <p className="font-body-sm text-body-sm text-text-muted">Worked examples will appear here when generated from your source material.</p>
                        )}
                    </DetailSection>

                    <DetailSection icon="article" title="Lesson Content">
                        <p className="font-body-base text-body-base text-text-secondary">
                            {contentPreview || summary}
                        </p>
                    </DetailSection>
                </div>
            </article>
        </div>
    );
};

const LessonMemoryNeuralBasis = () => {
    const { lessonId } = useParams();
    const [searchParams] = useSearchParams();
    const routeTopicId = typeof lessonId === 'string' ? lessonId.trim() : '';
    const { isAuthenticated } = useConvexAuth();
    const courses = useQuery(api.courses.getUserCourses, isAuthenticated && !routeTopicId ? {} : 'skip');
    const resumeTarget = useQuery(api.topics.getResumeTarget, isAuthenticated && !routeTopicId ? {} : 'skip');
    const courseList = Array.isArray(courses) ? courses : EMPTY_LIST;
    const lessonCourseList = useMemo(() => courseList.filter(hasLessonContent), [courseList]);
    const requestedCourseId = searchParams.get('courseId') || '';
    const requestedCourse = lessonCourseList.find((course) => String(course._id) === String(requestedCourseId));
    const resumeCourse = resumeTarget?.courseId
        ? lessonCourseList.find((course) => String(course._id) === String(resumeTarget.courseId))
        : null;
    const selectedCourseId = !routeTopicId
        ? requestedCourse?._id || resumeCourse?._id || lessonCourseList[0]?._id || ''
        : '';
    const courseWithTopics = useQuery(
        api.courses.getCourseWithTopics,
        isAuthenticated && !routeTopicId && selectedCourseId ? { courseId: selectedCourseId } : 'skip',
    );
    const topicDetail = useQuery(
        api.topics.getTopicWithQuestions,
        isAuthenticated && routeTopicId ? { topicId: routeTopicId } : 'skip',
    );

    if (routeTopicId) {
        if (!isAuthenticated || topicDetail === undefined) {
            return <StudyToolSkeleton />;
        }

        if (!topicDetail) {
            return (
                <div className="flex-1 flex flex-col lg:flex-row relative pb-20 md:pb-0">
                    <article className="flex-1 mx-auto w-full max-w-5xl px-space-4 md:px-space-10 pt-space-6 pb-space-8 md:pt-space-8 md:pb-space-10 lg:pt-space-8 lg:pb-space-12">
                        <EmptyLessonsState
                            title="Lesson not found"
                            description="We could not find that generated lesson for your account. Open your lesson library or upload material to create a new one."
                        />
                    </article>
                </div>
            );
        }

        return <LessonDetailView topic={topicDetail} />;
    }

    if (
        !isAuthenticated
        || courses === undefined
        || resumeTarget === undefined
        || (selectedCourseId && courseWithTopics === undefined)
    ) {
        return <StudyToolSkeleton />;
    }

    const selectedCourse = lessonCourseList.find((course) => String(course._id) === String(selectedCourseId)) || null;
    const topicList = Array.isArray(courseWithTopics?.topics) ? courseWithTopics.topics : EMPTY_LIST;
    const hasPendingCourses = courseList.length > 0 && lessonCourseList.length === 0;

    return (
        <div className="flex-1 flex flex-col lg:flex-row relative pb-20 md:pb-0">
            <article className="flex-1 mx-auto w-full max-w-5xl px-space-4 md:px-space-10 pt-space-6 pb-space-8 md:pt-space-8 md:pb-space-10 lg:pt-space-8 lg:pb-space-12">
                <div className="mb-space-6 flex flex-col gap-space-2">
                    <p className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">
                        Lessons
                    </p>
                    <h1 className="font-display-sm text-display-sm text-text-primary">
                        Read lessons generated from your materials
                    </h1>
                    <p className="max-w-2xl font-body-base text-body-base text-text-secondary">
                        Continue generated topic lessons, summaries, Word Banks, and practice checks from your own uploads.
                    </p>
                </div>

                <div className="space-y-space-5">
                    <ResumeLessonCard resumeTarget={resumeTarget} />

                    {lessonCourseList.length > 0 ? (
                        <section className="grid gap-space-4 md:grid-cols-2">
                            {lessonCourseList.map((course) => (
                                <CourseLessonCard
                                    key={course._id}
                                    course={course}
                                    selected={String(course._id) === String(selectedCourseId)}
                                />
                            ))}
                        </section>
                    ) : !resumeTarget?.topicId ? (
                        <EmptyLessonsState
                            title={hasPendingCourses ? 'Lessons are still preparing' : undefined}
                            description={hasPendingCourses
                                ? 'Your materials are uploaded, but no generated lesson topics are ready yet. When processing finishes, the lesson cards will appear here.'
                                : undefined}
                        />
                    ) : null}

                    {selectedCourse && (
                        <section className="rounded-2xl border border-border-subtle bg-surface-soft p-space-5">
                            <div className="mb-space-4 flex flex-col gap-space-1">
                                <p className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">
                                    Topics
                                </p>
                                <h2 className="font-headline-sm text-headline-sm text-text-primary">
                                    {selectedCourse.title || 'Selected course'}
                                </h2>
                            </div>
                            {topicList.length > 0 ? (
                                <div className="grid gap-space-4 md:grid-cols-2">
                                    {topicList.map((topic) => (
                                        <TopicLessonCard key={topic._id} topic={topic} />
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-dashed border-border-strong bg-surface p-space-5">
                                    <p className="font-body-sm text-body-sm text-text-secondary">
                                        This material is still preparing topic lessons.
                                    </p>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </article>
        </div>
    );
};

export default LessonMemoryNeuralBasis;
