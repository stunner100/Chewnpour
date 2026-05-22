import React from 'react';

const TopicVoiceToolbar = ({
    isPaused,
    isPlaying,
    pauseVoice,
    playVoice,
    resumeVoice,
    speechText,
    stopVoice,
    voicePlaybackError,
    voiceStatus,
}) => {
    const handlePlay = () => {
        if (!speechText || voiceStatus === 'loading') return;
        if (isPaused) {
            resumeVoice();
            return;
        }
        playVoice(speechText);
    };

    return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
                <span className="size-8 rounded-lg bg-primary-50 dark:bg-primary-900/25 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>graphic_eq</span>
                </span>
                <div className="min-w-0">
                    <p className="text-caption font-semibold text-text-main-light dark:text-text-main-dark leading-tight">Read this lesson aloud</p>
                    {voicePlaybackError ? (
                        <p className="text-[11px] text-rose-500 leading-tight mt-0.5 truncate">{voicePlaybackError}</p>
                    ) : null}
                </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <button
                    type="button"
                    onClick={handlePlay}
                    disabled={!speechText || voiceStatus === 'loading'}
                    className="btn-secondary text-caption px-3 py-1.5 gap-1 disabled:opacity-50"
                >
                    <span className="material-symbols-outlined text-[16px]">
                        {voiceStatus === 'loading' ? 'hourglass_top' : isPaused ? 'play_arrow' : 'volume_up'}
                    </span>
                    {voiceStatus === 'loading' ? 'Loading' : isPaused ? 'Resume' : 'Play'}
                </button>
                {(isPlaying || isPaused) ? (
                    <>
                        <button type="button" onClick={pauseVoice} disabled={!isPlaying} className="btn-icon size-8 disabled:opacity-50" aria-label="Pause">
                            <span className="material-symbols-outlined text-[16px]">pause</span>
                        </button>
                        <button type="button" onClick={stopVoice} className="btn-icon size-8" aria-label="Stop">
                            <span className="material-symbols-outlined text-[16px]">stop</span>
                        </button>
                    </>
                ) : null}
            </div>
        </div>
    );
};

export default TopicVoiceToolbar;
