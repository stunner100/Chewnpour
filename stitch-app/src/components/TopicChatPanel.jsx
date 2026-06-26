import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useAction, useMutation, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { DEFAULT_TUTOR_PERSONA, TUTOR_PERSONAS } from '../lib/tutorPersonas';
import { resolveConvexErrorMessage } from '../lib/convexClientErrors';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { TutorChatComposer } from '@/components/tutor/TutorChatSurface';
import { TutorAvatarMark } from '@/components/tutor/TutorAvatar';
import { TutorMessageRow, TutorWelcomeMessage } from '@/components/tutor/TutorMessageRow';
import { TutorTypingIndicator } from '@/components/tutor/TutorTypingIndicator';

const isAiMessageQuotaExceededError = (error) => {
    const code = String(error?.data?.code || '').trim().toUpperCase();
    if (code === 'AI_MESSAGE_QUOTA_EXCEEDED') return true;
    const message = String(error?.message || error?.data?.message || '').toUpperCase();
    return message.includes('AI_MESSAGE_QUOTA_EXCEEDED');
};

const EXIT_ANIMATION_MS = 250;

const TopicChatPanel = memo(function TopicChatPanel({ topicId, topicTitle, open, onClose, initialPrompt }) {
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
    const messages = useQuery(api.topicChat.getMessages, topicId ? { topicId } : 'skip');
    const aiMessageQuota = useQuery(
        api.subscriptions.getAiMessageQuotaStatus,
        isConvexAuthenticated ? {} : 'skip'
    );
    const tutorSupport = useQuery(
        api.tutor.getTopicTutorSupport,
        topicId ? { topicId } : 'skip'
    );
    const askTutor = useAction(api.ai.askTopicTutor);
    const clearChat = useMutation(api.topicChat.clearChat);
    const setTutorPersona = useMutation(api.tutor.setTutorPersona);

    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [isClosing, setIsClosing] = useState(false);
    const [selectedPersona, setSelectedPersona] = useState(DEFAULT_TUTOR_PERSONA);
    const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
    const closingTimerRef = useRef(null);
    const personaMenuRef = useRef(null);

    const aiMessageLimit = Number(aiMessageQuota?.limit);
    const aiMessageUsed = Number(aiMessageQuota?.used);
    const aiMessageRemaining = Number(aiMessageQuota?.remaining);
    const isPremium = Boolean(aiMessageQuota?.isPremium);
    const isFreeQuotaTracked = Boolean(aiMessageQuota) && !isPremium && Number.isFinite(aiMessageRemaining);
    const isFreeQuotaExhausted = isFreeQuotaTracked && aiMessageRemaining <= 0;
    const normalizedAiMessageLimit = Number.isFinite(aiMessageLimit) ? Math.max(0, aiMessageLimit) : 0;
    const aiMessageLimitMessage = normalizedAiMessageLimit > 0
        ? `You've used your ${normalizedAiMessageLimit} free AI messages today. Upgrade to premium for unlimited AI chat.`
        : "You've used your free AI messages today. Upgrade to premium for unlimited AI chat.";
    const aiMessageLimitPath = useMemo(() => {
        const fromPath = topicId ? `/dashboard/topic/${topicId}` : '/dashboard';
        const query = new URLSearchParams({
            from: fromPath,
            reason: 'ai_message_limit',
        });
        return `/subscription?${query.toString()}`;
    }, [topicId]);

    useEffect(() => {
        if (!tutorSupport?.persona) return;
        setSelectedPersona(String(tutorSupport.persona || DEFAULT_TUTOR_PERSONA));
    }, [tutorSupport?.persona]);

    useEffect(() => {
        if (!personaMenuOpen) return;
        const handleClickOutside = (event) => {
            if (personaMenuRef.current && !personaMenuRef.current.contains(event.target)) {
                setPersonaMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [personaMenuOpen]);

    const activePersona = useMemo(
        () => TUTOR_PERSONAS.find((p) => p.key === selectedPersona) || TUTOR_PERSONAS[0],
        [selectedPersona]
    );

    const suggestedPrompts = useMemo(
        () => [
            { label: 'Explain this simply', prompt: `Explain ${topicTitle || 'this lesson'} in simple terms.` },
            { label: 'Quiz me', prompt: 'Quiz me on the most important ideas from this lesson.' },
            { label: 'Summarise key points', prompt: 'Summarise the key points of this lesson in a short list.' },
        ],
        [topicTitle]
    );

    // Handle close with exit animation
    const handleClose = useCallback(() => {
        if (isClosing) return;
        setIsClosing(true);
        closingTimerRef.current = setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, EXIT_ANIMATION_MS);
    }, [isClosing, onClose]);

    // Clean up closing timer
    useEffect(() => {
        return () => {
            if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
        };
    }, []);

    // Reset closing state when panel reopens
    useEffect(() => {
        if (!open) return undefined;
        setIsClosing(false);
        return undefined;
    }, [open]);

    // Escape to close
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') handleClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, handleClose]);

    useEffect(() => {
        if (!isFreeQuotaExhausted || error) return;
        setError(aiMessageLimitMessage);
    }, [aiMessageLimitMessage, error, isFreeQuotaExhausted]);

    const handleSend = useCallback(async (questionInput) => {
        const question = String(questionInput || '').trim();
        if (!question || sending) return;
        if (isFreeQuotaExhausted) {
            setError(aiMessageLimitMessage);
            return;
        }
        setSending(true);
        setError('');
        try {
            await askTutor({ topicId, question, persona: selectedPersona });
        } catch (err) {
            if (isAiMessageQuotaExceededError(err)) {
                setError(resolveConvexErrorMessage(err, aiMessageLimitMessage));
            } else {
                setError(resolveConvexErrorMessage(err, 'Could not get a response. Please try again.'));
            }
            throw err;
        } finally {
            setSending(false);
        }
    }, [sending, askTutor, topicId, isFreeQuotaExhausted, aiMessageLimitMessage, selectedPersona]);

    const handlePersonaChange = useCallback(async (personaKey) => {
        const normalized = String(personaKey || DEFAULT_TUTOR_PERSONA);
        setSelectedPersona(normalized);
        try {
            await setTutorPersona({ persona: normalized });
        } catch (err) {
            setError(resolveConvexErrorMessage(err, 'Could not save tutor style. Please try again.'));
        }
    }, [setTutorPersona]);

    const handleClearChat = useCallback(async () => {
        if (!topicId) return;
        try {
            await clearChat({ topicId });
        } catch {
            // Silent
        }
    }, [topicId, clearChat]);

    if (!open && !isClosing) return null;

    const messageList = Array.isArray(messages) ? messages : [];

    const panelAnimClass = isClosing
        ? 'animate-panel-slide-down md:animate-panel-slide-right'
        : 'animate-panel-slide-up md:animate-panel-slide-left';

    return (
        <>
            {/* Backdrop (mobile/medium only) */}
            <button
                type="button"
                aria-label="Close AI tutor panel"
                className={`fixed inset-0 z-[55] border-0 bg-black/20 p-0 md:bg-transparent md:pointer-events-none lg:hidden transition-opacity ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleClose}
            />

            {/* Panel */}
            <div className={`fixed inset-0 z-[60] md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-[420px] flex flex-col bg-surface-light dark:bg-surface-dark border-t md:border-t-0 md:border-l border-border-light dark:border-border-dark shadow-lg ${panelAnimClass} pb-[env(safe-area-inset-bottom)] md:pb-0`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 h-14 lg:h-16 border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <TutorAvatarMark size={24} className="size-6" />
                        <div className="min-w-0">
                            <h3 className="text-body-sm lg:text-body-base font-semibold text-text-main-light dark:text-text-main-dark">AI Tutor</h3>
                            {topicTitle && (
                                <p className="hidden lg:block text-caption text-text-faint-light dark:text-text-faint-dark truncate max-w-[300px]">
                                    {topicTitle}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {messageList.length > 0 && (
                            <button
                                onClick={handleClearChat}
                                className="btn-icon size-8 text-text-faint-light dark:text-text-faint-dark hover:text-red-500"
                                title="Clear chat"
                                aria-label="Clear chat"
                            >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                        )}
                        <button
                            onClick={handleClose}
                            className="btn-icon size-8"
                            aria-label="Close chat panel"
                        >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    </div>
                </div>

                {isFreeQuotaTracked && (
                    <div className="px-4 py-2 border-b border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark">
                        <p className="text-caption text-text-sub-light dark:text-text-sub-dark">
                            {Math.max(0, aiMessageRemaining)} free message{aiMessageRemaining === 1 ? '' : 's'} left today
                            {Number.isFinite(aiMessageUsed) && Number.isFinite(aiMessageLimit)
                                ? ` (${Math.max(0, aiMessageUsed)}/${Math.max(0, aiMessageLimit)})`
                                : ''}
                        </p>
                    </div>
                )}

                <div className="px-4 py-2.5 border-b border-border-light dark:border-border-dark flex items-center justify-between gap-3">
                    <div className="relative" ref={personaMenuRef}>
                        <button
                            type="button"
                            onClick={() => setPersonaMenuOpen((prev) => !prev)}
                            className="flex items-center gap-1.5 text-caption text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark transition-colors"
                            aria-haspopup="listbox"
                            aria-expanded={personaMenuOpen}
                        >
                            <span className="text-text-faint-light dark:text-text-faint-dark">Tutor:</span>
                            <span className="font-semibold text-text-main-light dark:text-text-main-dark">{activePersona?.label || 'Exam Coach'}</span>
                            <span className={`material-symbols-outlined text-[16px] transition-transform ${personaMenuOpen ? 'rotate-180' : ''}`}>
                                expand_more
                            </span>
                        </button>
                        {personaMenuOpen && (
                            <div
                                role="listbox"
                                className="absolute left-0 top-full mt-1.5 z-20 w-64 rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-lg overflow-hidden"
                            >
                                {TUTOR_PERSONAS.map((persona) => {
                                    const isActive = selectedPersona === persona.key;
                                    return (
                                        <button
                                            key={persona.key}
                                            type="button"
                                            role="option"
                                            aria-selected={isActive}
                                            onClick={() => {
                                                handlePersonaChange(persona.key);
                                                setPersonaMenuOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2.5 transition-colors ${
                                                isActive
                                                    ? 'bg-primary/10'
                                                    : 'hover:bg-background-light dark:hover:bg-background-dark'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`text-body-sm font-semibold ${isActive ? 'text-primary' : 'text-text-main-light dark:text-text-main-dark'}`}>
                                                    {persona.label}
                                                </span>
                                                {isActive && (
                                                    <span className="material-symbols-outlined text-primary text-[16px]">check</span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-caption text-text-faint-light dark:text-text-faint-dark">
                                                {persona.description}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {tutorSupport?.latestAttempt?.percentage != null ? (
                        <span className="text-caption text-text-faint-light dark:text-text-faint-dark">
                            Last score <span className="font-semibold text-text-sub-light dark:text-text-sub-dark">{Math.round(tutorSupport.latestAttempt.percentage)}%</span>
                        </span>
                    ) : (
                        <span className="text-caption text-text-faint-light dark:text-text-faint-dark">Memory-aware</span>
                    )}
                </div>

                <MessageScroller className="min-h-0 flex-1" aria-label="AI Tutor conversation">
                    <MessageScrollerViewport>
                        <MessageScrollerContent className="gap-3 px-3 py-4">
                            {messageList.length === 0 && !sending && (
                                <TutorWelcomeMessage topicTitle={topicTitle} compact />
                            )}

                            {messageList.map((msg, idx) => {
                                const showAvatar = idx === 0 || messageList[idx - 1].role !== msg.role;
                                return (
                                    <TutorMessageRow
                                        key={msg._id}
                                        message={msg}
                                        showAvatar={showAvatar}
                                        compact
                                    />
                                );
                            })}

                            {sending ? <TutorTypingIndicator compact /> : null}
                        </MessageScrollerContent>
                    </MessageScrollerViewport>
                    <MessageScrollerButton />
                </MessageScroller>

                {error && isFreeQuotaExhausted ? (
                    <div className="border-t border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/30 dark:bg-red-900/10">
                        <Link
                            to={aiMessageLimitPath}
                            state={{ paywallMessage: error || aiMessageLimitMessage }}
                            className="inline-flex text-caption font-semibold text-primary transition-colors hover:text-primary-hover"
                        >
                            Upgrade to premium
                        </Link>
                    </div>
                ) : null}

                <TutorChatComposer
                    className="border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark"
                    suggestedPrompts={messageList.length === 0 && !sending ? suggestedPrompts : []}
                    onSuggestedPrompt={handleSend}
                    onSubmit={handleSend}
                    sending={sending}
                    error={error && !isFreeQuotaExhausted ? error : ''}
                    disabled={isFreeQuotaExhausted}
                    initialInput={open ? (initialPrompt || '') : ''}
                    placeholder={isFreeQuotaExhausted ? 'Daily limit reached' : 'Ask about this lesson...'}
                    inputAriaLabel="Send message to AI Tutor"
                    disclaimer="Enter to send · Shift+Enter for new line"
                />
            </div>
        </>
    );
});

export default TopicChatPanel;
