import React, { memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from './AppIcon';

const TopicSettingsModal = memo(function TopicSettingsModal({
    open,
    onClose,
    voiceModeEnabled,
    onToggleVoiceMode,
    voiceSaving,
    voiceSettingsError,
    isVoiceSupported,
    stopVoice,
    playVoice,
}) {
    useEffect(() => {
        if (!open) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKey = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', handleKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKey);
        };
    }, [open, onClose]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="cp-theme fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-6"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose?.();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="topic-settings-title"
                className="w-full max-w-md rounded-3xl border border-border-subtle bg-surface-light p-6 text-text-primary shadow-xl dark:border-border-dark dark:bg-surface-dark dark:text-text-main-dark"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h3 id="topic-settings-title" className="text-lg font-semibold text-text-primary">
                        Lesson Settings
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-icon size-9"
                        aria-label="Close lesson settings"
                    >
                        <AppIcon name="close" className="text-[20px]" />
                    </button>
                </div>

                <div className="rounded-2xl border border-border-subtle p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <p className="mb-1 font-bold text-text-primary">Voice Mode</p>
                            <p className="text-sm text-text-secondary">
                                Read this topic explanation aloud.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onToggleVoiceMode}
                            disabled={voiceSaving}
                            className={`relative h-8 w-14 rounded-full transition-colors ${voiceModeEnabled ? 'bg-primary' : 'bg-surface-soft'} ${voiceSaving ? 'cursor-not-allowed opacity-60' : ''}`}
                            aria-label="Toggle voice mode"
                            aria-pressed={voiceModeEnabled}
                        >
                            <span
                                className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform ${voiceModeEnabled ? 'translate-x-6' : ''}`}
                            />
                        </button>
                    </div>
                    <div className="mt-3 text-xs font-semibold text-text-muted">
                        {voiceSaving ? 'Saving...' : (voiceModeEnabled ? 'Voice mode enabled' : 'Voice mode disabled')}
                    </div>
                    {voiceSettingsError ? (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                            {voiceSettingsError}
                        </div>
                    ) : null}
                    {voiceModeEnabled && !isVoiceSupported ? (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                            This browser does not support voice playback.
                        </div>
                    ) : null}
                    {voiceModeEnabled && isVoiceSupported ? (
                        <div className="mt-3 space-y-3">
                            <div>
                                <p className="mb-1 text-xs font-semibold text-text-muted">
                                    Voice Engine
                                </p>
                                <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-soft px-3 py-2">
                                    <AppIcon name="graphic_eq" className="text-[16px] text-primary" />
                                    <span className="text-xs font-semibold text-text-secondary">Deepgram AI Voice</span>
                                </div>
                                <p className="mt-1 text-[11px] text-text-muted">
                                    High-quality AI-generated voice powered by Deepgram.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    stopVoice?.();
                                    playVoice?.('Voice mode test. If you can hear this sentence, your audio playback is working.');
                                }}
                                className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-soft px-3 py-2 text-xs font-semibold text-text-secondary hover:border-primary/40 hover:text-primary"
                            >
                                <AppIcon name="record_voice_over" className="text-[16px]" />
                                Test Voice
                            </button>
                        </div>
                    ) : null}
                </div>

                <div className="mt-5 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-primary px-4 py-2 text-sm"
                    >
                        Close settings
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
});

export default TopicSettingsModal;
