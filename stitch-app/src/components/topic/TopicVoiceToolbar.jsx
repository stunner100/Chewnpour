import React from 'react';
import AppIcon from '../AppIcon';
import { VoiceAssistantWidget } from '../opensource-ui/VoiceAssistantWidget';

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

    const busy = voiceStatus === 'loading';
    const active = isPlaying || busy;

    return (
        <div className="flex flex-col gap-1 py-1">
            <div className="flex items-center gap-2">
                <VoiceAssistantWidget
                    layout="inline"
                    appearance="playback"
                    active={active}
                    label={busy ? 'Generating audio...' : 'Reading…'}
                    idleLabel={isPaused ? 'Resume' : 'Read this lesson aloud'}
                    onToggle={() => {
                        if (isPlaying) {
                            pauseVoice();
                            return;
                        }
                        handlePlay();
                    }}
                    className="min-w-0 flex-1 rounded-2xl"
                />
                {(isPlaying || isPaused) ? (
                    <button type="button" onClick={stopVoice} className="btn-icon size-8 shrink-0" aria-label="Stop">
                        <AppIcon name="stop" className="text-[16px]" />
                    </button>
                ) : null}
            </div>
            {voicePlaybackError ? (
                <p className="truncate text-caption text-rose-500">{voicePlaybackError}</p>
            ) : null}
        </div>
    );
};

export default TopicVoiceToolbar;
