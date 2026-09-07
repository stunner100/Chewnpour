import React, { memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from './AppIcon';

const TopicSettingsModal = memo(function TopicSettingsModal({
    open,
    onClose,
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
                        Read aloud
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-icon size-9"
                        aria-label="Close read-aloud settings"
                    >
                        <AppIcon name="close" className="text-[20px]" />
                    </button>
                </div>

                <div className="rounded-2xl border border-border-subtle p-4">
                    {isVoiceSupported ? (
                        <>
                            <p className="text-sm text-text-secondary">
                                Use Play on the lesson to hear the current section. Pause and stop stay visible while audio is playing.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    stopVoice?.();
                                    playVoice?.('If you can hear this sentence, read aloud is working.');
                                }}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-soft px-3 py-2 text-xs font-semibold text-text-secondary hover:border-primary/40 hover:text-primary"
                            >
                                <AppIcon name="record_voice_over" className="text-[16px]" />
                                Test read aloud
                            </button>
                        </>
                    ) : (
                        <p className="text-sm text-text-secondary">
                            Read aloud is not available in this browser.
                        </p>
                    )}
                </div>

                <div className="mt-5 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-primary px-4 py-2 text-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
});

export default TopicSettingsModal;
