import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { TutorChatComposer, TutorChatMessages, TutorWelcomeMessage } from '@/components/tutor/TutorChatSurface';
import { TutorAvatarMark } from '@/components/tutor/TutorAvatar';
import AppIcon from '../components/AppIcon';

const suggestedPrompts = [
    { icon: 'lightbulb', text: 'Explain in simple terms', prompt: 'Explain this topic in simple terms.' },
    { icon: 'psychology', text: 'Give me an example', prompt: 'Give me a practical example from this topic.' },
    { icon: 'quiz', text: 'Quiz me on this', prompt: 'Quiz me on the most important ideas from this topic.' },
];

const EMPTY_LIST = [];

const TutorSkeleton = () => (
    <div className="flex-1 flex flex-col md:ml-0 h-[calc(100vh-64px)] overflow-hidden">
        <main className="flex-1 min-h-0 flex flex-col p-space-4 md:p-space-8 max-w-container-max mx-auto w-full animate-pulse" role="status" aria-live="polite">
            <div className="h-20 rounded-2xl bg-surface-soft mb-space-8" />
            <div className="flex-1 rounded-2xl bg-surface-soft flex items-center justify-center">
                <p className="font-body-sm text-body-sm text-text-muted">Loading AI Tutor...</p>
            </div>
        </main>
    </div>
);

const EmptyTutorState = () => (
    <div className="flex-1 flex flex-col md:ml-0 h-[calc(100vh-64px)] overflow-hidden">
        <main className="flex-1 min-h-0 flex flex-col items-center justify-center p-space-8 max-w-container-max mx-auto w-full text-center">
            <AppIcon name="smart_toy" className="text-[48px] text-text-muted mb-space-4" />
            <h2 className="font-headline-md text-headline-md text-text-primary">No lessons yet</h2>
            <p className="mt-space-2 font-body-sm text-body-sm text-text-secondary max-w-md">
                Upload study material first, then chat with the AI tutor against your generated lessons.
            </p>
            <Link
                to="/dashboard/upload"
                className="mt-space-8 inline-flex items-center gap-space-2 bg-primary text-on-primary px-space-6 py-space-3 rounded-xl font-label-md text-label-md hover:bg-primary-hover transition-colors"
            >
                <AppIcon name="cloud_upload" className="text-[18px]" />
                Upload Material
            </Link>
        </main>
    </div>
);

const TutorContextLoading = ({ topicTitle }) => (
    <div className="flex justify-start gap-4" role="status" aria-live="polite">
        <div className="w-9 h-9 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0 border border-primary-fixed-dim overflow-hidden">
            <TutorAvatarMark size={36} className="size-9" />
        </div>
        <div className="max-w-[85%] md:max-w-[75%] rounded-2xl bg-muted px-4 py-3 shadow-sm">
            <p className="font-label-md text-label-md text-text-primary">Loading tutor context...</p>
            <p className="font-body-sm text-body-sm text-text-secondary mt-1">
                Getting the latest chat for {topicTitle || 'this lesson'}.
            </p>
        </div>
    </div>
);

const AIStudyTutor = () => {
    const [courses, setCourses] = useState(null);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [selectedTopicId, setSelectedTopicId] = useState('');
    const [messages, setMessages] = useState(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [pendingExchange, setPendingExchange] = useState(null);

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
        courseTitle: selectedCourse.title,
        icon: 'auto_stories',
    }));

    const effectiveSelectedTopicId = topicOptions.some((option) => String(option.topicId) === String(selectedTopicId))
        ? selectedTopicId
        : String(topicOptions[0]?.topicId || '');
    const selectedTopicOption = useMemo(
        () => topicOptions.find((option) => String(option.topicId) === String(effectiveSelectedTopicId)) || topicOptions[0] || null,
        [effectiveSelectedTopicId, topicOptions],
    );

    useEffect(() => {
        const topicId = selectedTopicOption?.topicId;
        if (!topicId) {
            setMessages([]);
            return undefined;
        }
        let cancelled = false;
        setMessages(null);
        (async () => {
            try {
                const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/chat`, {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload?.error || 'Failed to load chat');
                if (!cancelled) setMessages(Array.isArray(payload.messages) ? payload.messages : []);
            } catch (err) {
                console.error(err);
                if (!cancelled) setMessages([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedTopicOption?.topicId]);

    const messageList = Array.isArray(messages) ? messages : EMPTY_LIST;
    const pendingExchangeForTopic = pendingExchange && selectedTopicOption?.topicId && String(pendingExchange.topicId) === String(selectedTopicOption.topicId)
        ? pendingExchange
        : null;
    const pendingServerState = useMemo(() => {
        if (!pendingExchangeForTopic) {
            return { hasQuestion: false, hasAssistant: false };
        }
        let matchingQuestionCount = 0;
        let questionIndex = -1;
        for (let index = 0; index < messageList.length; index += 1) {
            const message = messageList[index];
            if (message.role !== 'user') continue;
            if (String(message.content || '').trim() !== pendingExchangeForTopic.question) continue;
            matchingQuestionCount += 1;
            if (matchingQuestionCount > pendingExchangeForTopic.baselineQuestionCount) {
                questionIndex = index;
            }
        }
        const assistantMessage = questionIndex >= 0
            ? messageList.slice(questionIndex + 1).find((message) => message.role === 'assistant')
            : null;
        return {
            hasQuestion: questionIndex >= 0,
            hasAssistant: Boolean(assistantMessage),
        };
    }, [messageList, pendingExchangeForTopic]);

    const displayMessages = useMemo(() => {
        const nextMessages = [...messageList];
        if (!pendingExchangeForTopic || messages === null) return nextMessages;
        if (!pendingServerState.hasQuestion) {
            nextMessages.push({
                id: `pending-user-${pendingExchangeForTopic.clientId}`,
                _id: `pending-user-${pendingExchangeForTopic.clientId}`,
                role: 'user',
                content: pendingExchangeForTopic.question,
                optimistic: true,
            });
        }
        return nextMessages;
    }, [messageList, messages, pendingExchangeForTopic, pendingServerState]);

    const isTyping = Boolean(pendingExchangeForTopic && !pendingServerState.hasAssistant);
    const showTypingIndicator = sending || isTyping;

    useEffect(() => {
        setPendingExchange(null);
    }, [effectiveSelectedTopicId]);

    useEffect(() => {
        if (pendingExchangeForTopic && pendingServerState.hasAssistant) {
            setPendingExchange(null);
        }
    }, [pendingExchangeForTopic, pendingServerState.hasAssistant]);

    const handleSend = useCallback(async (overridePrompt) => {
        const question = String(overridePrompt || '').trim();
        if (!question || !selectedTopicOption?.topicId || sending) return;
        const baselineQuestionCount = messageList.filter((message) =>
            message.role === 'user' && String(message.content || '').trim() === question
        ).length;
        setPendingExchange({
            clientId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            topicId: selectedTopicOption.topicId,
            question,
            baselineQuestionCount,
        });
        setSending(true);
        setError('');
        try {
            const response = await fetch(`/api/topics/${encodeURIComponent(selectedTopicOption.topicId)}/chat`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload?.error || 'Could not get a tutor response.');
            setMessages(Array.isArray(payload.messages) ? payload.messages : []);
        } catch (err) {
            setPendingExchange(null);
            setError(err.message || 'Could not get a tutor response. Please try again.');
            throw err;
        } finally {
            setSending(false);
        }
    }, [messageList, selectedTopicOption?.topicId, sending]);

    if (courses === null || (effectiveCourseId && selectedCourse === null && safeCourses.length > 0)) {
        return <TutorSkeleton />;
    }
    if (topicOptions.length === 0) return <EmptyTutorState />;

    return (
        <div className="flex-1 flex flex-col md:ml-0 h-[calc(100vh-64px)] overflow-hidden">
            <main className="flex-1 min-h-0 flex flex-col p-space-4 md:p-space-6 max-w-container-max mx-auto w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-space-6 gap-4">
                    <div>
                        <h2 className="font-display-md text-display-md text-text-primary">AI Tutor</h2>
                        <p className="font-body-sm text-body-sm text-text-secondary mt-1 max-w-xl">
                            Ask questions grounded in your generated lessons and source material.
                        </p>
                    </div>
                    {safeCourses.length > 1 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    aria-label="AI tutor course"
                                    className="flex w-full min-w-[220px] sm:w-[260px] items-center gap-space-3 rounded-lg border border-border-default bg-surface px-space-3 py-space-2 text-left font-body-base text-text-primary shadow-sm outline-none transition-all hover:bg-surface-soft focus:border-primary focus:ring-2 focus:ring-primary-soft"
                                >
                                    <AppIcon name="folder" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-[18px] text-primary" />
                                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                        <span className="truncate font-label-md text-label-md text-text-primary">{selectedCourse?.title}</span>
                                        <span className="truncate font-body-sm text-body-sm text-text-muted">Course</span>
                                    </span>
                                    <AppIcon name="unfold_more" className="text-[20px] text-text-muted" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[260px] p-space-2">
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>Courses</DropdownMenuLabel>
                                    <DropdownMenuRadioGroup value={effectiveCourseId} onValueChange={setSelectedCourseId}>
                                        {safeCourses.map((course) => (
                                            <DropdownMenuRadioItem key={course.id} value={String(course.id)} className="rounded-lg px-space-2 py-space-2 pr-space-8">
                                                <span className="font-label-md text-label-md text-text-primary">{course.title}</span>
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
                                className="flex w-full min-w-[220px] sm:w-[340px] items-center gap-space-3 rounded-lg border border-border-default bg-surface px-space-3 py-space-2 text-left font-body-base text-text-primary shadow-sm outline-none transition-all hover:bg-surface-soft focus:border-primary focus:ring-2 focus:ring-primary-soft"
                            >
                                <AppIcon name={selectedTopicOption?.icon || 'auto_stories'} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-[18px] text-primary" />
                                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                    <span className="truncate font-label-md text-label-md text-text-primary">{selectedTopicOption?.title}</span>
                                    <span className="truncate font-body-sm text-body-sm text-text-muted">{selectedTopicOption?.courseTitle}</span>
                                </span>
                                <AppIcon name="unfold_more" className="text-[20px] text-text-muted" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[340px] p-space-2">
                            <div className="px-space-2 py-space-2">
                                <p className="font-label-md text-label-md text-text-primary">Tutor context</p>
                                <p className="mt-1 font-body-sm text-body-sm text-text-muted">Choose the lesson this chat should use.</p>
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Generated lessons</DropdownMenuLabel>
                                <DropdownMenuRadioGroup value={effectiveSelectedTopicId} onValueChange={setSelectedTopicId}>
                                    {topicOptions.map((topic) => (
                                        <DropdownMenuRadioItem
                                            key={topic.topicId}
                                            value={String(topic.topicId)}
                                            className="items-start gap-space-3 rounded-lg px-space-2 py-space-2 pr-space-8"
                                        >
                                            <AppIcon name={topic.icon || 'auto_stories'} className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-[18px] text-primary" />
                                            <span className="flex min-w-0 flex-col gap-1">
                                                <span className="font-label-md text-label-md text-text-primary">{topic.title}</span>
                                                <span className="font-body-sm text-body-sm text-text-muted">{topic.courseTitle}</span>
                                            </span>
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="flex-1 min-h-0 bg-surface rounded-2xl border border-border-subtle shadow-sm flex flex-col overflow-hidden">
                    <TutorChatMessages
                        scrollerKey={effectiveSelectedTopicId}
                        messages={messages === null || displayMessages.length === 0 ? [] : displayMessages}
                        isTyping={showTypingIndicator}
                        loadingState={messages === null ? (
                            <TutorContextLoading topicTitle={selectedTopicOption?.title} />
                        ) : null}
                        emptyState={messages !== null && displayMessages.length === 0 ? (
                            <TutorWelcomeMessage
                                topicTitle={selectedTopicOption?.title}
                                description={selectedTopicOption?.description}
                            />
                        ) : null}
                        courseBadge={(
                            <span className="font-label-xs text-label-xs text-text-muted bg-surface-soft px-3 py-1 rounded-full">
                                {selectedTopicOption?.courseTitle}
                            </span>
                        )}
                    />

                    <TutorChatComposer
                        suggestedPrompts={suggestedPrompts}
                        onSuggestedPrompt={handleSend}
                        onSubmit={handleSend}
                        sending={sending}
                        error={error}
                        placeholder={`Ask a question about ${selectedTopicOption?.title || 'this lesson'}...`}
                        inputAriaLabel={`Ask AI Tutor a question about ${selectedTopicOption?.title || 'this lesson'}`}
                        disclaimer="AI Tutor can make mistakes. Verify important academic information."
                    />
                </div>
            </main>
        </div>
    );
};

export default AIStudyTutor;
