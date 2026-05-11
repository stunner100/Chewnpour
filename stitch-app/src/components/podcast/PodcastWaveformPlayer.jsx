import React, { useEffect, useMemo, useReducer, useRef } from 'react';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const formatTime = (seconds) => {
    if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return '0:00';
    const total = Math.max(0, Math.round(Number(seconds)));
    const minutes = Math.floor(total / 60);
    const remainingSeconds = total % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const hashSeed = (value) => {
    const text = String(value || 'chewnpour-podcast');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const seededRandom = (seed) => {
    let state = seed || 1;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
};

const buildWaveform = (seedValue, barCount = 84) => {
    const random = seededRandom(hashSeed(seedValue));
    return Array.from({ length: barCount }, (_, index) => {
        const position = index / Math.max(1, barCount - 1);
        const phraseEnvelope = 0.55 + Math.sin(position * Math.PI * 5.5) * 0.18;
        const breath = Math.sin(position * Math.PI * 17) * 0.08;
        const noise = random() * 0.36;
        return {
            id: `waveform-bar-${String(index).padStart(2, '0')}`,
            level: clamp(0.18 + phraseEnvelope * 0.42 + breath + noise, 0.18, 1),
            position,
        };
    });
};

const createInitialPlayerState = (durationSeconds) => ({
    buffering: false,
    currentTime: 0,
    duration: Number(durationSeconds) || 0,
    error: '',
    playing: false,
});

const playerReducer = (state, action) => {
    switch (action.type) {
        case 'reset':
            return createInitialPlayerState(action.durationSeconds);
        case 'buffering':
            return { ...state, buffering: action.value };
        case 'clearError':
            return { ...state, error: '' };
        case 'duration':
            return { ...state, duration: action.value };
        case 'ended':
            return { ...state, currentTime: action.currentTime, playing: false };
        case 'error':
            return { ...state, buffering: false, error: action.message, playing: false };
        case 'playback':
            return { ...state, playing: action.playing };
        case 'seek':
            return { ...state, currentTime: action.currentTime };
        default:
            return state;
    }
};

const PodcastWaveformPlayer = ({
    audioUrl,
    title,
    subtitle,
    durationSeconds,
    className = '',
}) => {
    const audioRef = useRef(null);
    const scrubberRef = useRef(null);
    const draggingRef = useRef(false);
    const [{ buffering, currentTime, duration, error, playing }, dispatchPlayer] = useReducer(
        playerReducer,
        durationSeconds,
        createInitialPlayerState,
    );

    const waveform = useMemo(
        () => buildWaveform(`${audioUrl || ''}:${title || ''}`),
        [audioUrl, title],
    );
    const effectiveDuration = duration > 0 ? duration : Number(durationSeconds) || 0;
    const progress = effectiveDuration > 0 ? clamp(currentTime / effectiveDuration, 0, 1) : 0;

    useEffect(() => {
        dispatchPlayer({ type: 'reset', durationSeconds });
    }, [audioUrl, durationSeconds]);

    const seekToRatio = (ratio) => {
        const audio = audioRef.current;
        if (!audio || effectiveDuration <= 0) return;
        const nextTime = clamp(ratio, 0, 1) * effectiveDuration;
        audio.currentTime = nextTime;
        dispatchPlayer({ type: 'seek', currentTime: nextTime });
    };

    const seekFromClientX = (clientX) => {
        const node = scrubberRef.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        seekToRatio((clientX - rect.left) / Math.max(1, rect.width));
    };

    const handlePointerDown = (event) => {
        draggingRef.current = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        seekFromClientX(event.clientX);
    };

    const handlePointerMove = (event) => {
        if (!draggingRef.current) return;
        seekFromClientX(event.clientX);
    };

    const handlePointerUp = (event) => {
        draggingRef.current = false;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    const handleKeyDown = (event) => {
        if (effectiveDuration <= 0) return;
        const step = event.shiftKey ? 15 : 5;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault();
            seekToRatio((currentTime + step) / effectiveDuration);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault();
            seekToRatio((currentTime - step) / effectiveDuration);
        } else if (event.key === 'Home') {
            event.preventDefault();
            seekToRatio(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            seekToRatio(1);
        }
    };

    const togglePlayback = async () => {
        const audio = audioRef.current;
        if (!audio || !audioUrl) return;
        dispatchPlayer({ type: 'clearError' });
        try {
            if (audio.paused) {
                dispatchPlayer({ type: 'buffering', value: true });
                await audio.play();
                dispatchPlayer({ type: 'playback', playing: true });
            } else {
                audio.pause();
                dispatchPlayer({ type: 'playback', playing: false });
            }
        } catch (playError) {
            dispatchPlayer({ type: 'error', message: playError?.message || 'Unable to play this podcast.' });
        } finally {
            dispatchPlayer({ type: 'buffering', value: false });
        }
    };

    return (
        <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#130d24] text-white shadow-soft ${className}`}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.32),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_45%)]" />
            <div className="relative p-4 md:p-5">
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    preload="metadata"
                    onLoadedMetadata={(event) => {
                        const nextDuration = Number(event.currentTarget.duration);
                        if (Number.isFinite(nextDuration) && nextDuration > 0) {
                            dispatchPlayer({ type: 'duration', value: nextDuration });
                        }
                    }}
                    onTimeUpdate={(event) => dispatchPlayer({ type: 'seek', currentTime: event.currentTarget.currentTime || 0 })}
                    onWaiting={() => dispatchPlayer({ type: 'buffering', value: true })}
                    onCanPlay={() => dispatchPlayer({ type: 'buffering', value: false })}
                    onPlay={() => dispatchPlayer({ type: 'playback', playing: true })}
                    onPause={() => dispatchPlayer({ type: 'playback', playing: false })}
                    onEnded={() => {
                        dispatchPlayer({ type: 'ended', currentTime: effectiveDuration || 0 });
                    }}
                >
                    <track kind="captions" />
                </audio>

                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={togglePlayback}
                        disabled={!audioUrl}
                        className="group inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white text-[#22143d] shadow-lg transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={playing ? 'Pause podcast' : 'Play podcast'}
                    >
                        <span
                            className="material-symbols-outlined text-[30px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                            {buffering ? 'hourglass_top' : playing ? 'pause' : 'play_arrow'}
                        </span>
                    </button>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                {title && (
                                    <p className="truncate text-body-sm font-semibold text-white">
                                        {title}
                                    </p>
                                )}
                                {subtitle && (
                                    <p className="truncate text-caption text-white/55">
                                        {subtitle}
                                    </p>
                                )}
                            </div>
                            <div className="shrink-0 text-caption font-semibold tabular-nums text-white/70">
                                {formatTime(currentTime)} / {formatTime(effectiveDuration)}
                            </div>
                        </div>

                        <div
                            ref={scrubberRef}
                            role="slider"
                            tabIndex={0}
                            aria-label="Podcast progress"
                            aria-valuemin={0}
                            aria-valuemax={Math.max(0, Math.round(effectiveDuration))}
                            aria-valuenow={Math.max(0, Math.round(currentTime))}
                            className="group relative mt-3 h-16 cursor-pointer touch-none select-none rounded-2xl border border-white/10 bg-white/[0.06] p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/70"
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onKeyDown={handleKeyDown}
                        >
                            <div className="flex h-full items-center gap-[3px]">
                                {waveform.map(({ id, level, position }) => {
                                    const active = position <= progress;
                                    return (
                                        <span
                                            key={id}
                                            className={`flex-1 rounded-full transition-colors duration-150 ${
                                                active
                                                    ? 'bg-gradient-to-t from-[#8B5CF6] to-[#34D399]'
                                                    : 'bg-white/20 group-hover:bg-white/28'
                                            }`}
                                            style={{ height: `${Math.round(12 + level * 34)}px` }}
                                        />
                                    );
                                })}
                            </div>
                            <span
                                className="pointer-events-none absolute top-2 h-[calc(100%-1rem)] w-1 rounded-full bg-white shadow-[0_0_24px_rgba(139,92,246,0.9)] transition-[left]"
                                style={{ left: `calc(${progress * 100}% - 2px)` }}
                                aria-hidden="true"
                            />
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mt-3 rounded-xl border border-red-300/30 bg-red-500/15 px-3 py-2 text-body-sm text-red-100">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PodcastWaveformPlayer;
