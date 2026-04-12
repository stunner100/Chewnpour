import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useAction, useMutation, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { DEFAULT_TUTOR_PERSONA, TUTOR_PERSONAS } from '../lib/tutorPersonas';

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

    const [input, setInput] = useState('');
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

    const textareaRef = useRef(null);
    const endRef = useRef(null);
    const messagesContainerRef = useRef(null);

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

    // Auto-scroll to bottom when messages change or sending state changes
    useEffect(() => {
        if (open && endRef.current) {
            endRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [open, messages, sending]);

    // Focus textarea when panel opens
    useEffect(() => {
        if (open && textareaRef.current) {
            setTimeout(() => textareaRef.current?.focus(), 200);
        }
    }, [open]);

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
        if (open) setIsClosing(false);
    }, [open]);

    // Pre-fill input from initialPrompt (tutor entry points)
    useEffect(() => {
        if (open && initialPrompt) {
            setInput(initialPrompt);
        }
    }, [open, initialPrompt]);

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

    const handleSend = useCallback(async (override) => {
        const raw = typeof override === 'string' ? override : input;
        const question = String(raw || '').trim();
        if (!question || sending) return;
        if (isFreeQuotaExhausted) {
            setError(aiMessageLimitMessage);
            return;
        }
        setSending(true);
        setError('');
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        try {
            await askTutor({ topicId, question, persona: selectedPersona });
        } catch (err) {
            if (isAiMessageQuotaExceededError(err)) {
                setError(resolveConvexErrorMessage(err, aiMessageLimitMessage));
            } else {
                setError(resolveConvexErrorMessage(err, 'Could not get a response. Please try again.'));
            }
        } finally {
            setSending(false);
        }
    }, [input, sending, askTutor, topicId, isFreeQuotaExhausted, aiMessageLimitMessage, selectedPersona]);

    const handlePersonaChange = useCallback(async (personaKey) => {
        const normalized = String(personaKey || DEFAULT_TUTOR_PERSONA);
        setSelectedPersona(normalized);
        try {
            await setTutorPersona({ persona: normalized });
        } catch (err) {
            setError(resolveConvexErrorMessage(err, 'Could not save tutor style. Please try again.'));
        }
    }, [setTutorPersona]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const handleTextareaChange = useCallback((e) => {
        setInput(e.target.value);
        // Auto-expand textarea
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    }, []);

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
            <div
                className={`fixed inset-0 z-[55] bg-black/20 md:bg-transparent md:pointer-events-none lg:hidden transition-opacity ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleClose}
            />

            {/* Panel */}
            <div className={`fixed inset-0 z-[60] md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-[420px] lg:relative lg:z-auto lg:w-[420px] lg:shrink-0 lg:h-full flex flex-col bg-surface-light dark:bg-surface-dark border-t md:border-t-0 md:border-l border-border-light dark:border-border-dark shadow-lg lg:shadow-none ${panelAnimClass} pb-[env(safe-area-inset-bottom)] md:pb-0`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 h-14 lg:h-16 border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="material-symbols-outlined text-primary text-[20px] lg:text-[24px]">smart_toy</span>
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
                                className="btn-icon w-8 h-8 text-text-faint-light dark:text-text-faint-dark hover:text-red-500"
                                title="Clear chat"
                                aria-label="Clear chat"
                            >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                        )}
                        <button
                            onClick={handleClose}
                            className="btn-icon w-8 h-8"
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

                {/* Messages */}
                <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
                >
                    {messageList.length === 0 && !sending && (
                        <div className="space-y-4">
                            <div className="flex gap-2.5 items-start">
                                <div className="w-7 h-7 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                                    <span className="material-symbols-outlined text-primary text-[14px]">smart_toy</span>
                                </div>
                                <div className="rounded-xl rounded-tl-sm bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark px-3 py-2.5 text-body-sm text-text-main-light dark:text-text-main-dark max-w-[85%]">
                                    Hi! I&apos;m your AI tutor{topicTitle ? ` for "${topicTitle}"` : ''}. Ask anything, or try one of these:
                                </div>
                            </div>
                            <div className="pl-[38px] flex flex-col gap-2">
                                {suggestedPrompts.map((item) => (
                                    <button
                                        key={item.label}
                                        type="button"
                                        onClick={() => handleSend(item.prompt)}
                                        disabled={sending || isFreeQuotaExhausted}
                                        className="group flex items-center gap-2 self-start rounded-full border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-3 py-1.5 text-caption text-text-sub-light dark:text-text-sub-dark hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined text-[14px] text-text-faint-light dark:text-text-faint-dark group-hover:text-primary">auto_awesome</span>
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messageList.map((msg, idx) => {
                        const isAssistant = msg.role === 'assistant';
                        const showAvatar = idx === 0 || messageList[idx - 1].role !== msg.role;

                        if (isAssistant) {
                            return (
                                <div key={msg._id} className="flex gap-2.5 items-start">
                                    {showAvatar ? (
                                        <div className="w-7 h-7 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                                            <span className="material-symbols-outlined text-primary text-[14px]">smart_toy</span>
                                        </div>
                                    ) : (
                                        <div className="w-7 shrink-0" />
                                    )}
                                    <div className="rounded-xl rounded-tl-sm bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark px-3 py-2.5 text-body-sm text-text-main-light dark:text-text-main-dark max-w-[85%] whitespace-pre-wrap break-words">
                                        {msg.content}
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={msg._id} className="flex justify-end">
                                <div className="rounded-xl rounded-tr-sm bg-primary px-3 py-2.5 text-body-sm text-white max-w-[85%] whitespace-pre-wrap break-words">
                                    {msg.content}
                                </div>
                            </div>
                        );
                    })}

                    {sending && (
                        <div className="flex gap-2.5 items-start">
                            <div className="w-7 h-7 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                                <span className="material-symbols-outlined text-primary text-[14px]">smart_toy</span>
                            </div>
                            <div className="rounded-xl rounded-tl-sm bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark px-3 py-2.5 text-body-sm text-text-faint-light dark:text-text-faint-dark max-w-[85%]">
                                <span className="inline-flex items-center gap-1">
                                    Thinking
                                    <span className="inline-flex gap-0.5">
                                        <span className="w-1 h-1 rounded-full bg-text-faint-light dark:bg-text-faint-dark animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1 h-1 rounded-full bg-text-faint-light dark:bg-text-faint-dark animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1 h-1 rounded-full bg-text-faint-light dark:bg-text-faint-dark animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </span>
                                </span>
                            </div>
                        </div>
                    )}

                    <div ref={endRef} />
                </div>

                {/* Error */}
                {error && (
                    <div className="px-3 py-2 border-t border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10">
                        <p className="text-caption text-red-600 dark:text-red-300">{error}</p>
                        {isFreeQuotaExhausted && (
                            <Link
                                to={aiMessageLimitPath}
                                state={{ paywallMessage: error || aiMessageLimitMessage }}
                                className="mt-1 inline-flex text-caption font-semibold text-primary hover:text-primary-hover transition-colors"
                            >
                                Upgrade to premium
                            </Link>
                        )}
                    </div>
                )}

                {/* Composer */}
                <div className="px-3 pt-2 pb-3 border-t border-border-light dark:border-border-dark">
                    <div className="flex items-end gap-2 rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark pl-3 pr-2 py-2 shadow-sm transition-all focus-within:border-primary/50 focus-within:shadow-md focus-within:bg-surface-light dark:focus-within:bg-surface-dark">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleTextareaChange}
                            onKeyDown={handleKeyDown}
                            placeholder={isFreeQuotaExhausted ? 'Daily limit reached' : 'Ask about this lesson...'}
                            disabled={sending || isFreeQuotaExhausted}
                            rows={1}
                            className="flex-1 resize-none bg-transparent border-0 outline-none focus:ring-0 text-body-sm text-text-main-light dark:text-text-main-dark placeholder:text-text-faint-light dark:placeholder:text-text-faint-dark py-1.5 disabled:opacity-50"
                            style={{ maxHeight: 120 }}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={sending || !input.trim() || isFreeQuotaExhausted}
                            className="w-9 h-9 shrink-0 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm hover:bg-primary-hover hover:shadow-md active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100"
                            aria-label="Send message"
                        >
                            <span className="material-symbols-outlined text-[18px]">send</span>
                        </button>
                    </div>
                    <p className="mt-1.5 px-1 text-[10px] text-text-faint-light dark:text-text-faint-dark">
                        Enter to send · Shift+Enter for new line
                    </p>
                </div>
            </div>
        </>
    );
});

export default TopicChatPanel;
