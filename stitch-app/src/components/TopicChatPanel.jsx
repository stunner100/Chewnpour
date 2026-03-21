import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useAction, useMutation, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';

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

const TopicChatPanel = memo(function TopicChatPanel({ topicId, topicTitle, open, onClose }) {
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
    const messages = useQuery(api.topicChat.getMessages, topicId ? { topicId } : 'skip');
    const aiMessageQuota = useQuery(
        api.subscriptions.getAiMessageQuotaStatus,
        isConvexAuthenticated ? {} : 'skip'
    );
    const askTutor = useAction(api.ai.askTopicTutor);
    const clearChat = useMutation(api.topicChat.clearChat);

    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [isClosing, setIsClosing] = useState(false);
    const closingTimerRef = useRef(null);

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

    const handleSend = useCallback(async () => {
        const question = input.trim();
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
            await askTutor({ topicId, question });
        } catch (err) {
            if (isAiMessageQuotaExceededError(err)) {
                setError(resolveConvexErrorMessage(err, aiMessageLimitMessage));
            } else {
                setError(resolveConvexErrorMessage(err, 'Could not get a response. Please try again.'));
            }
        } finally {
            setSending(false);
        }
    }, [input, sending, askTutor, topicId, isFreeQuotaExhausted, aiMessageLimitMessage]);

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
            {/* Backdrop (mobile) */}
            <div
                className={`fixed inset-0 z-[55] bg-black/20 md:bg-transparent md:pointer-events-none transition-opacity ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleClose}
            />

            {/* Panel */}
            <div className={`fixed z-[60] inset-0 md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-80 flex flex-col bg-surface-light dark:bg-surface-dark border-t md:border-t-0 md:border-l border-border-light dark:border-border-dark shadow-lg ${panelAnimClass} pb-[env(safe-area-inset-bottom)] md:pb-0`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 h-14 border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">smart_toy</span>
                        <h3 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">AI Tutor</h3>
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

                {/* Messages */}
                <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
                >
                    {messageList.length === 0 && !sending && (
                        <div className="flex gap-2.5 items-start">
                            <div className="w-7 h-7 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                                <span className="material-symbols-outlined text-primary text-[14px]">smart_toy</span>
                            </div>
                            <div className="rounded-xl rounded-tl-sm bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark px-3 py-2.5 text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-[85%]">
                                Hi! I&apos;m your AI tutor{topicTitle ? ` for "${topicTitle}"` : ''}. Ask me anything about this lesson.
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
                <div className="px-3 py-3 border-t border-border-light dark:border-border-dark">
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleTextareaChange}
                            onKeyDown={handleKeyDown}
                            placeholder={isFreeQuotaExhausted ? 'Daily limit reached' : 'Ask about this lesson...'}
                            disabled={sending || isFreeQuotaExhausted}
                            rows={1}
                            className="flex-1 resize-none input-field text-body-sm py-2.5 disabled:opacity-50"
                            style={{ maxHeight: 120 }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={sending || !input.trim() || isFreeQuotaExhausted}
                            className="w-9 h-9 shrink-0 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Send message"
                        >
                            <span className="material-symbols-outlined text-[18px]">send</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
});

export default TopicChatPanel;
