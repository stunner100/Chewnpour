import React, { useCallback, useEffect, useRef } from 'react';
import { TutorChatComposer, TutorChatMessages } from '@/components/tutor/TutorChatSurface';
import { TutorWelcomeMessage } from '@/components/tutor/TutorMessageRow';
import useTutorChat from '@/hooks/useTutorChat';

const toFriendlyError = (error) => {
    const message = String(error || '').toLowerCase();
    if (message.includes('unauthorized') || message.includes('401')) {
        return 'Sign in again to keep chatting with the tutor.';
    }
    if (message.includes('not configured') || message.includes('503')) {
        return 'The AI tutor is not available yet. Try again in a moment.';
    }
    if (message.includes('failed to fetch') || message.includes('network')) {
        return 'We could not reach the tutor. Check your connection and try again.';
    }
    return 'The tutor could not answer just now. Try again.';
};

export default function StudyWorkerChat({
    topicId,
    topicTitle,
    // courseId is accepted for API compat but unused after Eve removal.
    courseTitle,
    persona,
    compact = false,
    initialPrompt = '',
    suggestedPrompts = [],
    showComposerSuggestions = true,
    placeholder,
    inputAriaLabel,
    disclaimer,
    onClearAvailable,
    studyContext = null,
}) {
    const {
        messages,
        status,
        error: chatError,
        send,
        cancel,
        clear,
    } = useTutorChat({ topicId, persona, studyContext });

    const isBusy = status === 'streaming';
    const error = chatError ? toFriendlyError(chatError) : '';
    const sendLockRef = useRef(false);

    const handleSend = useCallback(async (questionInput) => {
        const question = String(questionInput || '').trim();
        if (!question) return;
        if (!topicId) return;
        if (isBusy || sendLockRef.current) return;
        sendLockRef.current = true;
        try {
            await send(question);
        } catch {
            // Error is surfaced via the hook's error state.
        } finally {
            sendLockRef.current = false;
        }
    }, [send, isBusy, topicId]);

    const handleClear = useCallback(async () => {
        await clear();
    }, [clear]);

    const handleCancel = useCallback(() => {
        cancel();
        sendLockRef.current = false;
    }, [cancel]);

    useEffect(() => {
        onClearAvailable?.(messages.length > 0 ? handleClear : null);
        return () => onClearAvailable?.(null);
    }, [handleClear, messages.length, onClearAvailable]);

    return (
        <>
            <TutorChatMessages
                scrollerKey={topicId}
                compact={compact}
                className="min-h-0 flex-1 overflow-hidden"
                messages={messages}
                isTyping={isBusy}
                error={error}
                emptyState={
                    <TutorWelcomeMessage
                        topicTitle={topicTitle}
                        compact={compact}
                        suggestedPrompts={suggestedPrompts}
                        onSuggestedPrompt={handleSend}
                        sending={isBusy}
                    />
                }
                courseBadge={courseTitle ? (
                    <span className="rounded-full bg-surface-soft px-3 py-1 text-caption font-semibold text-text-muted">
                        {courseTitle}
                    </span>
                ) : null}
            />

            <TutorChatComposer
                className={compact
                    ? 'relative z-10 shrink-0 border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark'
                    : undefined}
                suggestedPrompts={showComposerSuggestions && messages.length > 0 ? suggestedPrompts : []}
                onSuggestedPrompt={handleSend}
                onSubmit={handleSend}
                onStop={handleCancel}
                sending={isBusy}
                status={isBusy ? 'streaming' : 'ready'}
                error={error}
                disabled={!topicId}
                initialInput={initialPrompt || ''}
                placeholder={placeholder}
                inputAriaLabel={inputAriaLabel}
                disclaimer={disclaimer}
            />
        </>
    );
}
