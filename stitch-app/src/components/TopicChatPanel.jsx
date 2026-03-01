import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

const TopicChatPanel = memo(function TopicChatPanel({ topicId, topicTitle, open, onClose }) {
    const messages = useQuery(api.topicChat.getMessages, topicId ? { topicId } : 'skip');
    const askTutor = useAction(api.ai.askTopicTutor);
    const clearChat = useMutation(api.topicChat.clearChat);

    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

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

    const handleSend = useCallback(async () => {
        const question = input.trim();
        if (!question || sending) return;
        setSending(true);
        setError('');
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        try {
            await askTutor({ topicId, question });
        } catch (err) {
            setError(err?.message || 'Could not get a response. Please try again.');
        } finally {
            setSending(false);
        }
    }, [input, sending, askTutor, topicId]);

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
            <div className="fixed z-50 inset-x-0 bottom-0 md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-80 flex flex-col bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 shadow-xl animate-chat-slide-up md:animate-chat-slide-left">
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

                {/* Messages */}
                <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto px-3 py-4 space-y-3 min-h-[200px] max-h-[55vh] md:max-h-none"
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
                            placeholder="Ask about this lesson..."
                            disabled={sending}
                            rows={1}
                            className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 disabled:opacity-60"
                            style={{ maxHeight: 120 }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={sending || !input.trim()}
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
