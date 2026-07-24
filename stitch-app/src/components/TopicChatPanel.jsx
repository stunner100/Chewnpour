import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DEFAULT_TUTOR_PERSONA, TUTOR_PERSONAS } from '../lib/tutorPersonas';
import { useAuth } from '../contexts/AuthContext';
import { TutorChatComposer, TutorChatMessages } from '@/components/tutor/TutorChatSurface';
import { TutorAvatarMark } from '@/components/tutor/TutorAvatar';
import { TutorWelcomeMessage } from '@/components/tutor/TutorMessageRow';

const EXIT_ANIMATION_MS = 250;

const fetchTopicChatMessages = async (topicId) => {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/chat`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || `Failed to load chat (${response.status})`);
    }
    return Array.isArray(payload.messages) ? payload.messages : [];
};

const askTopicTutor = async ({ topicId, question, persona }) => {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question, persona }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || `Tutor request failed (${response.status})`);
    }
    return payload;
};

const clearTopicChat = async (topicId) => {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/chat`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || `Failed to clear chat (${response.status})`);
    }
    return payload;
};

const TopicChatPanel = memo(function TopicChatPanel({ topicId, topicTitle, open, onClose, initialPrompt }) {
    const { profile, updateProfile } = useAuth();
    const [messages, setMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [isClosing, setIsClosing] = useState(false);
    const [selectedPersona, setSelectedPersona] = useState(
        profile?.studyPreferences?.preferredPersona || DEFAULT_TUTOR_PERSONA,
    );
    const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
    const closingTimerRef = useRef(null);
    const personaMenuRef = useRef(null);

    useEffect(() => {
        const preferred = profile?.studyPreferences?.preferredPersona;
        if (preferred) setSelectedPersona(preferred);
    }, [profile?.studyPreferences?.preferredPersona]);

    useEffect(() => {
        if (!open || !topicId) return undefined;
        let cancelled = false;
        setMessagesLoading(true);
        setError('');
        (async () => {
            try {
                const next = await fetchTopicChatMessages(topicId);
                if (!cancelled) setMessages(next);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Could not load chat.');
            } finally {
                if (!cancelled) setMessagesLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, topicId]);

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
        [selectedPersona],
    );

    const suggestedPrompts = useMemo(
        () => [
            { label: 'Explain this simply', prompt: `Explain ${topicTitle || 'this lesson'} in simple terms.` },
            { label: 'Quiz me', prompt: 'Quiz me on the most important ideas from this lesson.' },
            { label: 'Summarise key points', prompt: 'Summarise the key points of this lesson in a short list.' },
        ],
        [topicTitle],
    );

    const handleClose = useCallback(() => {
        if (isClosing) return;
        setIsClosing(true);
        closingTimerRef.current = setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, EXIT_ANIMATION_MS);
    }, [isClosing, onClose]);

    useEffect(() => () => {
        if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        setIsClosing(false);
        return undefined;
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') handleClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, handleClose]);

    const handleSend = useCallback(async (questionInput) => {
        const question = String(questionInput || '').trim();
        if (!question || sending || !topicId) return;
        setSending(true);
        setError('');
        try {
            const result = await askTopicTutor({
                topicId,
                question,
                persona: selectedPersona,
            });
            if (Array.isArray(result?.messages)) {
                setMessages(result.messages);
            } else {
                const next = await fetchTopicChatMessages(topicId);
                setMessages(next);
            }
        } catch (err) {
            setError(err.message || 'Could not get a response. Please try again.');
            throw err;
        } finally {
            setSending(false);
        }
    }, [sending, topicId, selectedPersona]);

    const handlePersonaChange = useCallback(async (personaKey) => {
        const normalized = String(personaKey || DEFAULT_TUTOR_PERSONA);
        setSelectedPersona(normalized);
        try {
            await updateProfile({
                studyPreferences: {
                    ...(profile?.studyPreferences || {}),
                    preferredPersona: normalized,
                },
            });
        } catch (err) {
            setError(err.message || 'Could not save tutor style. Please try again.');
        }
    }, [profile?.studyPreferences, updateProfile]);

    const handleClearChat = useCallback(async () => {
        if (!topicId) return;
        try {
            await clearTopicChat(topicId);
            setMessages([]);
        } catch {
            // Silent
        }
    }, [topicId]);

    if (!open && !isClosing) return null;

    const messageList = Array.isArray(messages) ? messages : [];
    const panelAnimClass = isClosing
        ? 'animate-panel-slide-down md:animate-panel-slide-right'
        : 'animate-panel-slide-up md:animate-panel-slide-left';

    return (
        <>
            <button
                type="button"
                aria-label="Close AI tutor panel"
                className={`fixed inset-0 z-[55] border-0 bg-black/20 p-0 md:bg-transparent md:pointer-events-none lg:hidden transition-opacity ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleClose}
            />

            <div className={`fixed inset-0 z-[60] md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-[420px] flex flex-col bg-surface-light dark:bg-surface-dark border-t md:border-t-0 md:border-l border-border-light dark:border-border-dark shadow-lg ${panelAnimClass} pb-[env(safe-area-inset-bottom)] md:pb-0`}>
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
                    <span className="text-caption text-text-faint-light dark:text-text-faint-dark">
                        {messagesLoading ? 'Loading…' : 'Lesson-grounded'}
                    </span>
                </div>

                <TutorChatMessages
                    scrollerKey={topicId}
                    compact
                    className="min-h-0 flex-1"
                    messages={messageList}
                    isTyping={sending}
                    emptyState={
                        messageList.length === 0 && !sending && !messagesLoading ? (
                            <TutorWelcomeMessage topicTitle={topicTitle} compact />
                        ) : null
                    }
                />

                <TutorChatComposer
                    className="border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark"
                    suggestedPrompts={messageList.length === 0 && !sending ? suggestedPrompts : []}
                    onSuggestedPrompt={handleSend}
                    onSubmit={handleSend}
                    sending={sending}
                    error={error}
                    disabled={false}
                    initialInput={open ? (initialPrompt || '') : ''}
                    placeholder="Ask about this lesson..."
                    inputAriaLabel="Send message to AI Tutor"
                    disclaimer="Enter to send · Shift+Enter for new line"
                />
            </div>
        </>
    );
});

export default TopicChatPanel;
