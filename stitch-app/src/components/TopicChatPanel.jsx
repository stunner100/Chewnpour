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

    // Escape to close
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

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

    if (!open) return null;

    const messageList = Array.isArray(messages) ? messages : [];

    return (
        <>
            {/* Backdrop (mobile) */}
            <div
                className="fixed inset-0 z-40 bg-black/30 md:bg-transparent md:pointer-events-none"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed z-[60] inset-0 md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-80 flex flex-col bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 shadow-xl animate-chat-slide-up md:animate-chat-slide-left pb-[env(safe-area-inset-bottom)] md:pb-0">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">AI Tutor</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        {messageList.length > 0 && (
                            <button
                                onClick={handleClearChat}
                                className="w-8 h-8 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center transition-colors"
                                title="Clear chat"
                            >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>
                </div>

                {isFreeQuotaTracked && (
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                            Free AI messages today:{' '}
                            <span className="font-semibold text-slate-900 dark:text-white">{Math.max(0, aiMessageRemaining)}</span>
                            {' '}left
                            {Number.isFinite(aiMessageUsed) && Number.isFinite(aiMessageLimit)
                                ? ` (${Math.max(0, aiMessageUsed)}/${Math.max(0, aiMessageLimit)} used)`
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
                            <div className="w-7 h-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                                <span className="material-symbols-outlined text-primary text-[14px]">smart_toy</span>
                            </div>
                            <div className="rounded-2xl rounded-tl-sm bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 max-w-[85%]">
                                Hi! I'm your AI tutor{topicTitle ? ` for "${topicTitle}"` : ''}. Ask me anything about this lesson.
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
                                        <div className="w-7 h-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                                            <span className="material-symbols-outlined text-primary text-[14px]">smart_toy</span>
                                        </div>
                                    ) : (
                                        <div className="w-7 shrink-0" />
                                    )}
                                    <div className="rounded-2xl rounded-tl-sm bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 max-w-[85%] whitespace-pre-wrap break-words">
                                        {msg.content}
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={msg._id} className="flex justify-end">
                                <div className="rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm text-white max-w-[85%] whitespace-pre-wrap break-words">
                                    {msg.content}
                                </div>
                            </div>
                        );
                    })}

                    {sending && (
                        <div className="flex gap-2.5 items-start">
                            <div className="w-7 h-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                                <span className="material-symbols-outlined text-primary text-[14px]">smart_toy</span>
                            </div>
                            <div className="rounded-2xl rounded-tl-sm bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-500 dark:text-slate-400 max-w-[85%]">
                                <span className="inline-flex items-center gap-1">
                                    Thinking
                                    <span className="inline-flex gap-0.5">
                                        <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </span>
                                </span>
                            </div>
                        </div>
                    )}

                    <div ref={endRef} />
                </div>

                {/* Error */}
                {error && (
                    <div className="px-3 py-2 border-t border-rose-100 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/10">
                        <p className="text-xs text-rose-600 dark:text-rose-300">{error}</p>
                        {isFreeQuotaExhausted && (
                            <Link
                                to={aiMessageLimitPath}
                                state={{ paywallMessage: error || aiMessageLimitMessage }}
                                className="mt-1 inline-flex text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                            >
                                Upgrade to premium
                            </Link>
                        )}
                    </div>
                )}

                {/* Composer */}
                <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleTextareaChange}
                            onKeyDown={handleKeyDown}
                            placeholder={isFreeQuotaExhausted ? 'Daily free AI message limit reached' : 'Ask about this lesson...'}
                            disabled={sending || isFreeQuotaExhausted}
                            rows={1}
                            className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 disabled:opacity-60"
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

            {/* Animations */}
            <style>{`
                @keyframes chat-slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                @keyframes chat-slide-left {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .animate-chat-slide-up {
                    animation: chat-slide-up 0.25s ease-out;
                }
                .animate-chat-slide-left {
                    animation: chat-slide-left 0.25s ease-out;
                }
                @media (min-width: 768px) {
                    .animate-chat-slide-up { animation: chat-slide-left 0.25s ease-out; }
                }
            `}</style>
        </>
    );
});

export default TopicChatPanel;
