import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
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
import { resolveConvexErrorMessage } from '../lib/convexClientErrors';
import { TutorChatComposer, TutorChatMessages, TutorWelcomeMessage } from '@/components/tutor/TutorChatSurface';
import { TutorAvatarMark } from '@/components/tutor/TutorAvatar';

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

const TutorContextLoading = ({ topicTitle }) => (
    <div className="flex justify-start gap-4" role="status" aria-live="polite">
        <div className="w-9 h-9 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0 border border-primary-fixed-dim overflow-hidden">
            <TutorAvatarMark size={36} className="size-9" />
        </div>
        <div className="max-w-[85%] md:max-w-[75%] rounded-full bg-muted px-4 py-3 shadow-sm">
            <p className="font-label-md text-label-md text-text-primary">Loading tutor context...</p>
            <p className="font-body-sm text-body-sm text-text-secondary mt-1">
                Getting the latest chat for {topicTitle || 'this lesson'}.
            </p>
            <div className="mt-space-3 flex gap-1.5" aria-hidden="true">
                <span className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                <span className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.15s' }} />
                <span className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.3s' }} />
            </div>
        </div>
    </div>
);

const EmptyTutorState = () => (
    <div className="flex-1 flex flex-col md:ml-0 h-[calc(100vh-64px)] overflow-hidden">
        <main className="flex-1 min-h-0 flex flex-col p-space-4 md:p-space-6 max-w-container-max mx-auto w-full">
            <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-space-6 md:p-space-8 text-center">
                <div className="w-14 h-14 bg-primary-soft text-primary rounded-2xl flex items-center justify-center mx-auto mb-space-4 overflow-hidden border border-primary-fixed-dim">
                    <TutorAvatarMark size={56} className="size-14 rounded-2xl" />
                </div>
                <h2 className="font-display-md text-display-md text-text-primary">AI Tutor needs a lesson first</h2>
                <p className="font-body-sm text-body-sm text-text-secondary mt-space-3 max-w-xl mx-auto">
                    Upload material and generate topics so the tutor can answer from your real course content.
                </p>
                <Link
                    to="/dashboard/upload"
                    className="mt-space-8 inline-flex items-center gap-space-2 bg-primary text-on-primary px-space-6 py-space-3 rounded-xl font-label-md text-label-md hover:bg-primary-hover transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                    Upload Material
                </Link>
            </section>
        </main>
    </div>
);

const AIStudyTutor = () => {
    const courses = useQuery(api.courses.getUserCourses, {});
    const safeCourses = courses || EMPTY_LIST;
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const effectiveCourseId = safeCourses.some((course) => String(course._id) === String(selectedCourseId))
        ? selectedCourseId
        : String(safeCourses[0]?._id || '');
    const selectedCourse = useQuery(
        api.courses.getCourseWithTopics,
        effectiveCourseId ? { courseId: effectiveCourseId } : 'skip'
    );
    const topicOptions = (selectedCourse?.topics || EMPTY_LIST).map((topic) => ({
        topicId: topic._id,
        courseId: selectedCourse._id,
        title: topic.title,
        description: topic.description || '',
        courseTitle: selectedCourse.title,
        icon: 'auto_stories',
    }));
    const [selectedTopicId, setSelectedTopicId] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [pendingExchange, setPendingExchange] = useState(null);
    const messagesContainerRef = useRef(null);
    const questionAnchorRef = useRef(null);
    const responseAnchorRef = useRef(null);
    const lastScrollAnchorKeyRef = useRef('');
    const askTopicTutor = useAction(api.ai.askTopicTutor);

    const effectiveSelectedTopicId = topicOptions.some((option) => String(option.topicId) === String(selectedTopicId))
        ? selectedTopicId
        : String(topicOptions[0]?.topicId || '');
    const selectedTopicOption = useMemo(
        () => topicOptions.find((option) => String(option.topicId) === String(effectiveSelectedTopicId)) || topicOptions[0] || null,
        [effectiveSelectedTopicId, topicOptions]
    );

    const messages = useQuery(
        api.topicChat.getMessages,
        selectedTopicOption?.topicId ? { topicId: selectedTopicOption.topicId } : 'skip'
    );
    const messageList = Array.isArray(messages) ? messages : EMPTY_LIST;
    const pendingExchangeForTopic = pendingExchange && selectedTopicOption?.topicId && String(pendingExchange.topicId) === String(selectedTopicOption.topicId)
        ? pendingExchange
        : null;
    const pendingServerState = useMemo(() => {
        if (!pendingExchangeForTopic) {
            return {
                hasQuestion: false,
                hasAssistant: false,
                questionMessageId: '',
                assistantMessageId: '',
            };
        }

        let matchingQuestionCount = 0;
        let questionIndex = -1;
        let questionMessageId = '';
        for (let index = 0; index < messageList.length; index += 1) {
            const message = messageList[index];
            if (message.role !== 'user') continue;
            if (String(message.content || '').trim() !== pendingExchangeForTopic.question) continue;
            matchingQuestionCount += 1;
            if (matchingQuestionCount > pendingExchangeForTopic.baselineQuestionCount) {
                questionIndex = index;
                questionMessageId = String(message._id || '');
            }
        }

        const assistantMessage = questionIndex >= 0
            ? messageList.slice(questionIndex + 1).find((message) => message.role === 'assistant')
            : null;

        return {
            hasQuestion: questionIndex >= 0,
            hasAssistant: Boolean(assistantMessage),
            questionMessageId,
            assistantMessageId: String(assistantMessage?._id || ''),
        };
    }, [messageList, pendingExchangeForTopic]);
    const displayMessages = useMemo(() => {
        const nextMessages = [...messageList];
        if (!pendingExchangeForTopic || messages === undefined) return nextMessages;

        if (!pendingServerState.hasQuestion) {
            nextMessages.push({
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
    const questionAnchorKey = pendingExchangeForTopic && !pendingServerState.hasAssistant
        ? pendingServerState.questionMessageId || `pending-user-${pendingExchangeForTopic.clientId}`
        : '';
    const responseAnchorKey = pendingServerState.assistantMessageId || (
        isTyping ? `typing-${pendingExchangeForTopic?.clientId || 'active'}` : ''
    );
    const activeScrollAnchorKey = pendingServerState.assistantMessageId
        ? responseAnchorKey
        : questionAnchorKey || responseAnchorKey;

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
            await askTopicTutor({
                topicId: selectedTopicOption.topicId,
                question,
            });
        } catch (err) {
            setPendingExchange(null);
            setError(resolveConvexErrorMessage(err, 'Could not get a tutor response. Please try again.'));
            throw err;
        } finally {
            setSending(false);
        }
    }, [askTopicTutor, messageList, selectedTopicOption?.topicId, sending]);

    useEffect(() => {
        setPendingExchange(null);
        lastScrollAnchorKeyRef.current = '';
        const messagesContainer = messagesContainerRef.current;
        if (!messagesContainer) return undefined;

        const frame = requestAnimationFrame(() => {
            messagesContainer.scrollTo({ top: 0 });
        });

        return () => cancelAnimationFrame(frame);
    }, [effectiveSelectedTopicId]);

    useEffect(() => {
        if (!activeScrollAnchorKey || lastScrollAnchorKeyRef.current === activeScrollAnchorKey) return undefined;

        const frame = requestAnimationFrame(() => {
            const target = pendingServerState.assistantMessageId
                ? responseAnchorRef.current
                : questionAnchorRef.current || (isTyping ? responseAnchorRef.current : null);
            if (!target) return;
            target.scrollIntoView({
                block: 'start',
                behavior: 'smooth',
            });
            lastScrollAnchorKeyRef.current = activeScrollAnchorKey;
        });

        return () => cancelAnimationFrame(frame);
    }, [activeScrollAnchorKey, displayMessages.length, isTyping, pendingServerState.assistantMessageId]);

    useEffect(() => {
        if (pendingExchangeForTopic && pendingServerState.hasAssistant) {
            setPendingExchange(null);
        }
    }, [pendingExchangeForTopic, pendingServerState.hasAssistant]);

    if (courses === undefined || (effectiveCourseId && selectedCourse === undefined)) return <TutorSkeleton />;
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
                                    <span className="material-symbols-outlined flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-[18px] text-primary">folder</span>
                                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                        <span className="truncate font-label-md text-label-md text-text-primary">{selectedCourse?.title}</span>
                                        <span className="truncate font-body-sm text-body-sm text-text-muted">Course</span>
                                    </span>
                                    <span className="material-symbols-outlined text-[20px] text-text-muted">unfold_more</span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[260px] p-space-2">
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>Courses</DropdownMenuLabel>
                                    <DropdownMenuRadioGroup value={effectiveCourseId} onValueChange={setSelectedCourseId}>
                                        {safeCourses.map((course) => (
                                            <DropdownMenuRadioItem key={course._id} value={String(course._id)} className="rounded-lg px-space-2 py-space-2 pr-space-8">
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
                                <span className="material-symbols-outlined flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-[18px] text-primary">
                                    {selectedTopicOption?.icon || 'auto_stories'}
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                    <span className="truncate font-label-md text-label-md text-text-primary">{selectedTopicOption?.title}</span>
                                    <span className="truncate font-body-sm text-body-sm text-text-muted">{selectedTopicOption?.courseTitle}</span>
                                </span>
                                <span className="material-symbols-outlined text-[20px] text-text-muted">unfold_more</span>
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
                                            <span className="material-symbols-outlined mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-[18px] text-primary">
                                                {topic.icon || 'auto_stories'}
                                            </span>
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
                        messages={messages === undefined || displayMessages.length === 0 ? [] : displayMessages}
                        messagesContainerRef={messagesContainerRef}
                        isTyping={showTypingIndicator}
                        typingAnchorRef={responseAnchorRef}
                        getMessageAnchorRef={(message) => {
                            const isQuestionAnchor = questionAnchorKey && String(message._id) === String(questionAnchorKey);
                            const isResponseAnchor = responseAnchorKey && String(message._id) === String(responseAnchorKey);
                            if (isResponseAnchor) return responseAnchorRef;
                            if (isQuestionAnchor) return questionAnchorRef;
                            return null;
                        }}
                        loadingState={messages === undefined ? (
                            <TutorContextLoading topicTitle={selectedTopicOption?.title} />
                        ) : null}
                        emptyState={messages !== undefined && displayMessages.length === 0 ? (
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
