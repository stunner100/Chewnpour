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
        <div className="w-9 h-9 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0 border border-primary-fixed-dim">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
        </div>
        <div className="max-w-[85%] md:max-w-[75%] bg-ai-subtle rounded-2xl rounded-tl-sm p-space-4 shadow-sm border border-outline-variant">
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
                <div className="w-14 h-14 bg-primary-soft text-primary rounded-2xl flex items-center justify-center mx-auto mb-space-4">
                    <span className="material-symbols-outlined text-[28px]">smart_toy</span>
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

const resolveConvexErrorMessage = (error, fallbackMessage) => {
    const dataMessage = typeof error?.data === 'string'
        ? error.data
        : typeof error?.data?.message === 'string'
            ? error.data.message
            : '';
    const resolved = String(dataMessage || error?.message || fallbackMessage || '')
        .replace(/^Uncaught (ConvexError|Error):\s*/i, '')
        .trim();
    return resolved || fallbackMessage;
};

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
    const [inputValue, setInputValue] = useState('');
    const [selectedTopicId, setSelectedTopicId] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const messagesContainerRef = useRef(null);
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

    const handleSend = useCallback(async (overridePrompt) => {
        const question = String(overridePrompt || inputValue || '').trim();
        if (!question || !selectedTopicOption?.topicId || sending) return;
        setSending(true);
        setError('');
        setInputValue('');
        try {
            await askTopicTutor({
                topicId: selectedTopicOption.topicId,
                question,
            });
        } catch (err) {
            setError(resolveConvexErrorMessage(err, 'Could not get a tutor response. Please try again.'));
        } finally {
            setSending(false);
        }
    }, [askTopicTutor, inputValue, selectedTopicOption?.topicId, sending]);

    const handleKeyDown = useCallback((event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    useEffect(() => {
        const messagesContainer = messagesContainerRef.current;
        if (!messagesContainer) return undefined;

        const frame = requestAnimationFrame(() => {
            messagesContainer.scrollTo({
                top: messagesContainer.scrollHeight,
                behavior: 'smooth',
            });
        });

        return () => cancelAnimationFrame(frame);
    }, [effectiveSelectedTopicId, messages, sending]);

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
                    <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-space-5 flex flex-col gap-space-6" aria-label="AI Tutor conversation">
                        <div className="text-center">
                            <span className="font-label-xs text-label-xs text-text-muted bg-surface-soft px-3 py-1 rounded-full">
                                {selectedTopicOption?.courseTitle}
                            </span>
                        </div>

                        {messages === undefined ? (
                            <TutorContextLoading topicTitle={selectedTopicOption?.title} />
                        ) : messages.length === 0 ? (
                            <div className="flex justify-start gap-4">
                                <div className="w-9 h-9 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0 border border-primary-fixed-dim">
                                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                                </div>
                                <div className="max-w-[85%] md:max-w-[75%] bg-ai-subtle rounded-2xl rounded-tl-sm p-space-4 shadow-sm border border-outline-variant">
                                    <p className="font-body-sm text-body-sm text-text-primary">
                                        I can help with {selectedTopicOption?.title}. Ask about a confusing idea, request examples, or start a quick review.
                                    </p>
                                    {selectedTopicOption?.description && (
                                        <p className="font-body-sm text-body-sm text-text-secondary mt-space-3">{selectedTopicOption.description}</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            messages.map((message) => {
                                const isUser = message.role === 'user';
                                return (
                                    <div key={message._id} className={`flex ${isUser ? 'justify-end' : 'justify-start gap-4'}`}>
                                        {!isUser && (
                                            <div className="w-9 h-9 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0 border border-primary-fixed-dim">
                                                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                                            </div>
                                        )}
                                        <div className={`${isUser ? 'max-w-[80%] md:max-w-[70%] bg-surface-muted rounded-tr-sm' : 'max-w-[85%] md:max-w-[75%] bg-ai-subtle rounded-tl-sm border-outline-variant'} rounded-2xl p-space-4 shadow-sm border border-border-subtle`}>
                                            <p className="font-body-sm text-body-sm text-text-primary whitespace-pre-wrap">{message.content}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {sending && (
                            <div className="flex justify-start gap-4">
                                <div className="w-9 h-9 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0 border border-primary-fixed-dim">
                                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                                </div>
                                <div className="bg-ai-subtle rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm border border-outline-variant flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
                                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.2s' }} />
                                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.4s' }} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-space-4 bg-surface border-t border-border-subtle flex flex-col gap-space-3">
                        <div className="flex flex-wrap gap-2">
                            {suggestedPrompts.map((prompt) => (
                                <button
                                    key={prompt.text}
                                    type="button"
                                    onClick={() => handleSend(prompt.prompt)}
                                    disabled={sending}
                                    className="px-4 py-2 bg-surface-soft border border-border-default rounded-full font-label-xs text-label-xs text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors flex items-center gap-1.5 disabled:opacity-60"
                                >
                                    <span className="material-symbols-outlined text-[16px]">{prompt.icon}</span>
                                    {prompt.text}
                                </button>
                            ))}
                        </div>
                        {error && (
                            <p className="font-body-sm text-body-sm text-error bg-error-soft border border-error/20 rounded-lg px-space-3 py-space-2">{error}</p>
                        )}
                        <div className="relative flex items-end gap-2 bg-surface-soft rounded-xl border border-border-strong p-2 focus-within:ring-2 focus-within:ring-primary-soft focus-within:border-primary transition-all shadow-sm">
                            <textarea
                                aria-label={`Ask AI Tutor a question about ${selectedTopicOption?.title || 'this lesson'}`}
                                className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-2.5 px-2 font-body-sm text-body-sm text-text-primary placeholder:text-text-muted min-h-[44px] max-h-[120px]"
                                placeholder={`Ask a question about ${selectedTopicOption?.title || 'this lesson'}...`}
                                rows={1}
                                value={inputValue}
                                onChange={(event) => setInputValue(event.target.value)}
                                onKeyDown={handleKeyDown}
                                style={{ overflowY: 'hidden' }}
                            />
                            <button
                                type="button"
                                aria-label="Send message to AI Tutor"
                                onClick={() => handleSend()}
                                disabled={sending || !inputValue.trim()}
                                className="w-10 h-10 bg-primary text-on-primary rounded-lg flex items-center justify-center hover:bg-primary-hover transition-colors shadow-sm self-end mb-1 flex-shrink-0 disabled:opacity-50 disabled:hover:bg-primary"
                            >
                                <span className="material-symbols-outlined">send</span>
                            </button>
                        </div>
                        <div className="text-center">
                            <p className="font-label-xs text-label-xs text-text-muted">AI Tutor can make mistakes. Verify important academic information.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AIStudyTutor;
