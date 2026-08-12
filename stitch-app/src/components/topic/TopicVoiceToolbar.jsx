import React from 'react';
import AppIcon from '../AppIcon';

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
        <div className="flex items-center justify-between gap-3 py-1">
            <p className="min-w-0 text-caption text-text-muted">
                Read this lesson aloud
                {voicePlaybackError ? (
                    <span className="mt-0.5 block truncate text-rose-500">{voicePlaybackError}</span>
                ) : null}
            </p>
            <div className="flex shrink-0 items-center gap-1">
                <button
                    type="button"
                    onClick={handlePlay}
                    disabled={!speechText || voiceStatus === 'loading'}
                    className="btn-ghost inline-flex min-h-9 items-center gap-1 px-2.5 text-caption disabled:opacity-50"
                >
                    <AppIcon name={voiceStatus === 'loading' ? 'hourglass_top' : isPaused ? 'play_arrow' : 'volume_up'} className="text-[16px]" />
                    {voiceStatus === 'loading' ? 'Loading' : isPaused ? 'Resume' : 'Play'}
                </button>
                {(isPlaying || isPaused) ? (
                    <>
                        <button type="button" onClick={pauseVoice} disabled={!isPlaying} className="btn-icon size-8 disabled:opacity-50" aria-label="Pause">
                            <AppIcon name="pause" className="text-[16px]" />
                        </button>
                        <button type="button" onClick={stopVoice} className="btn-icon size-8" aria-label="Stop">
                            <AppIcon name="stop" className="text-[16px]" />
                        </button>
                    </>
                ) : null}
            </div>
        </div>
    );
};

export default TopicVoiceToolbar;
