import React, { memo } from 'react';

const TopicSettingsModal = memo(function TopicSettingsModal({
    open,
    onClose,
    voiceModeEnabled,
    onToggleVoiceMode,
    voiceSaving,
    voiceSettingsError,
    isVoiceSupported,
    voiceOptions,
    selectedVoiceURI,
    selectedVoiceName,
    setVoicePreference,
    playbackEngine,
    stopVoice,
    playVoice,
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Lesson Settings</h3>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <p className="font-bold text-slate-900 dark:text-white mb-1">Voice Mode</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Read this topic explanation aloud.
                            </p>
                        </div>
                        <button
                            onClick={onToggleVoiceMode}
                            disabled={voiceSaving}
                            className={`relative w-14 h-8 rounded-full transition-colors ${voiceModeEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'} ${voiceSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
                            aria-label="Toggle voice mode"
                            aria-pressed={voiceModeEnabled}
                        >
                            <span
                                className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${voiceModeEnabled ? 'translate-x-6' : ''}`}
                            />
                        </button>
                    </div>
                    <div className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
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
                                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    Voice
                                </label>
                                <select
                                    value={selectedVoiceURI || ''}
                                    onChange={(event) => setVoicePreference(event.target.value || '')}
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                >
                                    <option value="">Auto (Best local Apple voice)</option>
                                    {voiceOptions.map((voice) => (
                                        <option key={voice.voiceURI} value={voice.voiceURI}>
                                            {voice.name} ({voice.lang || 'unknown'})
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                    Current: {selectedVoiceName || 'Auto'}.
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                    Playback: {playbackEngine === 'elevenlabs' ? 'ElevenLabs' : 'Browser voice'}.
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                    For best quality, install Enhanced/Premium voices in macOS Settings.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    stopVoice();
                                    playVoice("Voice mode test. If you can hear this sentence, your audio playback is working.");
                                }}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-primary/40 hover:text-primary"
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
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
});

export default TopicSettingsModal;
