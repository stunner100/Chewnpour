import React, { memo } from 'react';

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
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-6">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="topic-settings-title"
                className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl p-6"
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 id="topic-settings-title" className="text-lg font-semibold text-zinc-900 dark:text-white">Lesson Settings</h3>
                    <button
                        onClick={onClose}
                        className="size-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-primary flex items-center justify-center"
                        aria-label="Close lesson settings"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <p className="font-bold text-zinc-900 dark:text-white mb-1">Voice Mode</p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Read this topic explanation aloud.
                            </p>
                        </div>
                        <button
                            onClick={onToggleVoiceMode}
                            disabled={voiceSaving}
                            className={`relative w-14 h-8 rounded-full transition-colors ${voiceModeEnabled ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'} ${voiceSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
                            aria-label="Toggle voice mode"
                            aria-pressed={voiceModeEnabled}
                        >
                            <span
                                className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform ${voiceModeEnabled ? 'translate-x-6' : ''}`}
                            />
                        </button>
                    </div>
                    <div className="mt-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        {voiceSaving ? 'Saving...' : (voiceModeEnabled ? 'Voice mode enabled' : 'Voice mode disabled')}
                    </div>
                    {voiceSettingsError && (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                            {voiceSettingsError}
                        </div>
                    )}
                    {voiceModeEnabled && !isVoiceSupported && (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                            This browser does not support voice playback.
                        </div>
                    )}
                    {voiceModeEnabled && isVoiceSupported && (
                        <div className="mt-3 space-y-3">
                            <div>
                                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                                    Voice Engine
                                </p>
                                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2">
                                    <span className="material-symbols-outlined text-[16px] text-primary">graphic_eq</span>
                                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Deepgram AI Voice</span>
                                </div>
                                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                    High-quality AI-generated voice powered by Deepgram.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    stopVoice();
                                    playVoice("Voice mode test. If you can hear this sentence, your audio playback is working.");
                                }}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:border-primary/40 hover:text-primary"
                            >
                                <span className="material-symbols-outlined text-[16px]">record_voice_over</span>
                                Test Voice
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white"
                    >
                        Close settings
                    </button>
                </div>
            </div>
        </div>
    );
});

export default TopicSettingsModal;
