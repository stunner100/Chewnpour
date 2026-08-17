import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import StudyWorkerChat from '@/components/tutor/StudyWorkerChat';
import { TutorAvatarMark } from '@/components/tutor/TutorAvatar';
import AppIcon from '../components/AppIcon';
import { formatCourseTitle } from '../lib/courseTitle';
import { DEFAULT_TUTOR_PERSONA } from '../lib/tutorPersonas';
import { useAuth } from '../contexts/AuthContext';

const suggestedPrompts = [
    { icon: 'lightbulb', text: 'Explain in simple terms', prompt: 'Explain this topic in simple terms.' },
    { icon: 'psychology', text: 'Give me an example', prompt: 'Give me a practical example from this topic.' },
    { icon: 'quiz', text: 'Quiz me on this', prompt: 'Quiz me on the most important ideas from this topic.' },
];

const EMPTY_LIST = [];

const TutorSkeleton = () => (
    <div className="min-h-[calc(100vh-4rem)] animate-pulse bg-background-light px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-5xl flex-col">
            <div className="mb-6 h-16 rounded-[20px] bg-surface-soft" />
            <div className="flex flex-1 items-center justify-center rounded-[28px] bg-surface-soft">
                <p className="text-body-sm text-text-muted" role="status" aria-live="polite">Loading AI Tutor...</p>
            </div>
        </div>
    </div>
);

const EmptyTutorState = () => (
    <div className="min-h-[calc(100vh-4rem)] bg-background-light px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-[28px] border border-dashed border-border-default bg-surface px-6 py-12 text-center shadow-sm">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
                <AppIcon name="smart_toy" className="text-[28px]" />
            </div>
            <h2 className="font-display text-display-sm font-bold text-text-primary">No lessons yet</h2>
            <p className="mt-2 max-w-md text-body-sm text-text-secondary">
                Upload study material first, then chat with the AI tutor against your generated lessons.
            </p>
            <Link
                to="/dashboard/upload"
                className="btn-primary mt-6 inline-flex min-h-11 items-center gap-2 text-body-sm"
            >
                <AppIcon name="cloud_upload" className="text-[18px]" />
                Upload Material
            </Link>
        </div>
    </div>
);

const TutorContextLoading = ({ topicTitle }) => (
    <div className="flex justify-start gap-3" role="status" aria-live="polite">
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary-soft bg-primary-subtle">
            <TutorAvatarMark size={36} className="size-9" />
        </div>
        <div className="max-w-[85%] rounded-[20px] bg-surface-soft px-4 py-3 shadow-sm md:max-w-[75%]">
            <p className="text-body-sm font-semibold text-text-primary">Loading tutor context...</p>
            <p className="mt-1 text-body-sm text-text-secondary">
                Getting the latest chat for {topicTitle || 'this lesson'}.
            </p>
        </div>
    </div>
);

const AIStudyTutor = () => {
    const { profile } = useAuth();
    const [courses, setCourses] = useState(null);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [selectedTopicId, setSelectedTopicId] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const response = await fetch('/api/courses', {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload?.error || 'Failed to load courses');
                if (!cancelled) setCourses(Array.isArray(payload.courses) ? payload.courses : []);
            } catch (err) {
                console.error(err);
                if (!cancelled) setCourses([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const safeCourses = courses || EMPTY_LIST;
    const effectiveCourseId = safeCourses.some((course) => String(course.id) === String(selectedCourseId))
        ? selectedCourseId
        : String(safeCourses[0]?.id || '');

    useEffect(() => {
        if (!effectiveCourseId) {
            setSelectedCourse(null);
            return undefined;
        }
        let cancelled = false;
        (async () => {
            try {
                const response = await fetch(`/api/courses/${encodeURIComponent(effectiveCourseId)}`, {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload?.error || 'Failed to load course');
                if (!cancelled) setSelectedCourse(payload.course || null);
            } catch (err) {
                console.error(err);
                if (!cancelled) setSelectedCourse(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [effectiveCourseId]);

    const topicOptions = (selectedCourse?.topics || EMPTY_LIST).map((topic) => ({
        topicId: topic.id,
        courseId: selectedCourse.id,
        title: topic.title,
        description: topic.description || '',
        courseTitle: formatCourseTitle(selectedCourse.title) || selectedCourse.title,
        icon: 'auto_stories',
    }));

    const effectiveSelectedTopicId = topicOptions.some((option) => String(option.topicId) === String(selectedTopicId))
        ? selectedTopicId
        : String(topicOptions[0]?.topicId || '');
    const selectedTopicOption = useMemo(
        () => topicOptions.find((option) => String(option.topicId) === String(effectiveSelectedTopicId)) || topicOptions[0] || null,
        [effectiveSelectedTopicId, topicOptions],
    );

    const persona = profile?.studyPreferences?.preferredPersona || DEFAULT_TUTOR_PERSONA;

    if (courses === null || (effectiveCourseId && selectedCourse === null && safeCourses.length > 0)) {
        return <TutorSkeleton />;
    }
    if (topicOptions.length === 0) return <EmptyTutorState />;

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-background-light px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-6 md:px-8 md:pb-0 md:py-8">
            <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
                            AI Tutor
                        </h1>
                        <p className="mt-2 max-w-xl text-body-md text-text-secondary">
                            Ask questions grounded in your generated lessons and source material.
                        </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        {safeCourses.length > 1 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label="AI tutor course"
                                        className="flex w-full min-w-[220px] items-center gap-3 rounded-full border border-border-default bg-surface px-3 py-2 text-left shadow-sm outline-none transition-all hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-primary-soft sm:w-[240px]"
                                    >
                                        <AppIcon name="folder" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-[18px] text-primary" />
                                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                            <span className="truncate text-body-sm font-semibold text-text-primary">{selectedCourse?.title}</span>
                                            <span className="truncate text-caption text-text-muted">Course</span>
                                        </span>
                                        <AppIcon name="unfold_more" className="text-[20px] text-text-muted" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[260px] rounded-[16px] p-2">
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Courses</DropdownMenuLabel>
                                        <DropdownMenuRadioGroup value={effectiveCourseId} onValueChange={setSelectedCourseId}>
                                            {safeCourses.map((course) => (
                                                <DropdownMenuRadioItem key={course.id} value={String(course.id)} className="rounded-xl px-2 py-2 pr-8">
                                                    <span className="text-body-sm font-semibold text-text-primary">{formatCourseTitle(course.title) || course.title}</span>
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    aria-label="AI tutor material"
                                    className="flex w-full min-w-[220px] items-center gap-3 rounded-full border border-border-default bg-surface px-3 py-2 text-left shadow-sm outline-none transition-all hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-primary-soft sm:w-[320px]"
                                >
                                    <AppIcon name={selectedTopicOption?.icon || 'auto_stories'} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-[18px] text-primary" />
                                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                        <span className="truncate text-body-sm font-semibold text-text-primary">{selectedTopicOption?.title}</span>
                                        <span className="truncate text-caption text-text-muted">{selectedTopicOption?.courseTitle}</span>
                                    </span>
                                    <AppIcon name="unfold_more" className="text-[20px] text-text-muted" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[min(320px,calc(100vw-2rem))] rounded-[16px] p-2">
                                <div className="px-2 py-2">
                                    <p className="text-body-sm font-semibold text-text-primary">Tutor context</p>
                                    <p className="mt-1 text-caption text-text-muted">Choose the lesson this chat should use.</p>
                                </div>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>Generated lessons</DropdownMenuLabel>
                                    <DropdownMenuRadioGroup value={effectiveSelectedTopicId} onValueChange={setSelectedTopicId}>
                                        {topicOptions.map((topic) => (
                                            <DropdownMenuRadioItem
                                                key={topic.topicId}
                                                value={String(topic.topicId)}
                                                className="items-start gap-3 rounded-xl px-2 py-2 pr-8"
                                            >
                                                <AppIcon name={topic.icon || 'auto_stories'} className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-[18px] text-primary" />
                                                <span className="flex min-w-0 flex-col gap-1">
                                                    <span className="text-body-sm font-semibold text-text-primary">{topic.title}</span>
                                                    <span className="text-caption text-text-muted">{topic.courseTitle}</span>
                                                </span>
                                            </DropdownMenuRadioItem>
                                        ))}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-border-subtle bg-surface shadow-sm ph-mask">
                    {selectedTopicOption ? (
                        <StudyWorkerChat
                            key={effectiveSelectedTopicId}
                            topicId={selectedTopicOption.topicId}
                            topicTitle={selectedTopicOption.title}
                            courseId={selectedTopicOption.courseId}
                            courseTitle={selectedTopicOption.courseTitle}
                            persona={persona}
                            suggestedPrompts={suggestedPrompts}
                            placeholder={`Ask a question about ${selectedTopicOption.title || 'this lesson'}...`}
                            inputAriaLabel={`Ask AI Tutor a question about ${selectedTopicOption.title || 'this lesson'}`}
                            disclaimer="AI Tutor can make mistakes. Verify important academic information."
                        />
                    ) : (
                        <TutorContextLoading topicTitle="" />
                    )}
                </div>
            </main>
        </div>
    );
};

export default AIStudyTutor;
