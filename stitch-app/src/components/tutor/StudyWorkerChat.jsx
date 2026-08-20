import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEveAgent } from 'eve/react';
import { TutorChatComposer, TutorChatMessages } from '@/components/tutor/TutorChatSurface';
import { TutorWelcomeMessage } from '@/components/tutor/TutorMessageRow';
import { useAuth } from '@/contexts/AuthContext';
import {
    clearStudyWorkerSession,
    loadStudyWorkerSession,
    mergePendingTutorMessages,
    pendingInputRequestsFromEve,
    saveStudyWorkerSession,
} from '@/lib/studyWorkerSession';
import { getEveHost, getStudyWorkerToken } from '@/lib/studyWorkerToken';

const toFriendlyError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('unauthorized') || message.includes('401')) {
        return 'Sign in again to keep chatting with the tutor.';
    }
    if (message.includes('not configured') || message.includes('503')) {
        return 'The study worker is not available yet. Try again in a moment.';
    }
    if (message.includes('failed to fetch') || message.includes('network')) {
        return 'We could not reach the tutor. Check your connection and try again.';
    }
    return 'The tutor could not answer just now. Try again.';
};

export default function StudyWorkerChat({
    topicId,
    topicTitle,
    courseId,
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
}) {
    const { user } = useAuth();
    const [error, setError] = useState('');
    const [pendingUserMessages, setPendingUserMessages] = useState([]);
    const sendLockRef = useRef(false);
    const saved = useMemo(
        () => loadStudyWorkerSession(user?.id, topicId),
        [topicId, user?.id],
    );

    const agent = useEveAgent({
        host: getEveHost(),
        auth: {
            bearer: async () => getStudyWorkerToken({ topicId, persona }),
        },
        headers: async () => ({
            'x-chewnpour-topic-id': String(topicId || ''),
            'x-chewnpour-course-id': String(courseId || ''),
        }),
        initialSession: saved?.session,
        initialEvents: saved?.events,
        prepareSend: (input) => ({
            ...input,
            clientContext: {
                topicId,
                topicTitle,
                courseId,
                persona,
            },
        }),
        onError: (nextError) => {
            setError(toFriendlyError(nextError));
        },
        onFinish: (snapshot) => {
            saveStudyWorkerSession(user?.id, topicId, snapshot);
        },
    });

    const isBusy = agent.status === 'submitted' || agent.status === 'streaming';
    const eveMessages = useMemo(
        () => agent.data?.messages || [],
        [agent.data?.messages],
    );
    const messageList = useMemo(
        () => mergePendingTutorMessages(eveMessages, pendingUserMessages),
        [eveMessages, pendingUserMessages],
    );
    const pendingRequests = useMemo(
        () => pendingInputRequestsFromEve(eveMessages),
        [eveMessages],
    );

    useEffect(() => {
        const confirmed = new Set(
            mergePendingTutorMessages(eveMessages, [])
                .filter((message) => message.role === 'user')
                .map((message) => message.content),
        );
        setPendingUserMessages((prev) => {
            if (prev.length === 0) return prev;
            const next = prev.filter((message) => !confirmed.has(message.content));
            return next.length === prev.length ? prev : next;
        });
    }, [eveMessages]);

    const handleSend = useCallback(async (questionInput) => {
        const question = String(questionInput || '').trim();
        if (!question) return;
        if (!topicId) {
            setError('This lesson is not ready for chat yet.');
            return;
        }
        if (isBusy || sendLockRef.current) return;
        sendLockRef.current = true;
        const pendingId = `pending-${Date.now()}`;
        setPendingUserMessages((prev) => [
            ...prev,
            { id: pendingId, _id: pendingId, role: 'user', content: question },
        ]);
        setError('');
        try {
            await agent.send(question);
        } catch (err) {
            setError(toFriendlyError(err));
            throw err;
        } finally {
            sendLockRef.current = false;
        }
    }, [agent, isBusy, topicId]);

    const handleRespond = useCallback(async (request, option) => {
        setError('');
        try {
            await agent.respond([{ requestId: request.requestId, optionId: option.id }]);
        } catch (err) {
            setError(toFriendlyError(err));
        }
    }, [agent]);

    const handleClear = useCallback(async () => {
        clearStudyWorkerSession(user?.id, topicId);
        setPendingUserMessages([]);
        agent.reset();
        setError('');
    }, [agent, topicId, user?.id]);

    const handleCancel = useCallback(() => {
        agent.cancel();
        sendLockRef.current = false;
    }, [agent]);

    useEffect(() => {
        onClearAvailable?.(messageList.length > 0 ? handleClear : null);
        return () => onClearAvailable?.(null);
    }, [handleClear, messageList.length, onClearAvailable]);

    const showWelcome = messageList.length === 0 && !isBusy;

    return (
        <>
            <TutorChatMessages
                scrollerKey={topicId}
                compact={compact}
                className="min-h-0 flex-1 overflow-hidden"
                messages={messageList}
                isTyping={isBusy}
                error={error}
                emptyState={
                    showWelcome ? (
                        <TutorWelcomeMessage
                            topicTitle={topicTitle}
                            compact={compact}
                            suggestedPrompts={suggestedPrompts}
                            onSuggestedPrompt={handleSend}
                            sending={isBusy}
                        />
                    ) : null
                }
                courseBadge={courseTitle ? (
                    <span className="rounded-full bg-surface-soft px-3 py-1 text-caption font-semibold text-text-muted">
                        {courseTitle}
                    </span>
                ) : null}
            />

            {pendingRequests.length > 0 ? (
                <div className={compact ? 'px-3 pb-2' : 'px-5 pb-2 md:px-6'}>
                    {pendingRequests.map((request) => (
                        <fieldset
                            key={request.requestId}
                            className="rounded-[20px] border border-border-subtle bg-surface-soft px-4 py-3"
                        >
                            <legend className="px-1 text-caption font-semibold text-text-muted">
                                Check your understanding
                            </legend>
                            <p className="text-body-sm text-text-primary">{request.prompt}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {(request.options || []).map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => void handleRespond(request, option)}
                                        className="rounded-full border border-border-default bg-surface px-3 py-1.5 text-caption font-semibold text-text-secondary hover:bg-surface-muted hover:text-text-primary disabled:opacity-50"
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                    ))}
                </div>
            ) : null}

            <TutorChatComposer
                className={compact
                    ? 'relative z-10 shrink-0 border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark'
                    : undefined}
                suggestedPrompts={showComposerSuggestions && messageList.length > 0 ? suggestedPrompts : []}
                onSuggestedPrompt={handleSend}
                onSubmit={handleSend}
                onStop={handleCancel}
                sending={isBusy}
                status={agent.status}
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
