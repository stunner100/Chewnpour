import React, { useEffect, useReducer, useRef } from 'react';
import AppIcon from '../AppIcon';

const SKIP_SECONDS = 15;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const formatTime = (seconds) => {
    if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return '0:00';
    const total = Math.max(0, Math.round(Number(seconds)));
    const minutes = Math.floor(total / 60);
    const remainingSeconds = total % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
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

const controlButtonClass =
    'inline-flex min-h-11 min-w-11 shrink-0 select-none items-center justify-center rounded-full text-text-secondary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-soft disabled:cursor-not-allowed disabled:opacity-50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-soft [@media(hover:hover)_and_(pointer:fine)]:hover:text-text-primary';

const PodcastWaveformPlayer = ({
    audioUrl,
    title,
    subtitle,
    durationSeconds,
    className = '',
    onPlay,
}) => {
    const audioRef = useRef(null);
    const scrubberRef = useRef(null);
    const draggingRef = useRef(false);
    const [{ buffering, currentTime, duration, error, playing }, dispatchPlayer] = useReducer(
        playerReducer,
        durationSeconds,
        createInitialPlayerState,
    );

    const effectiveDuration = duration > 0 ? duration : Number(durationSeconds) || 0;
    const progress = effectiveDuration > 0 ? clamp(currentTime / effectiveDuration, 0, 1) : 0;
    const timeLabel = `${formatTime(currentTime)} of ${formatTime(effectiveDuration)}`;

    useEffect(() => {
        dispatchPlayer({ type: 'reset', durationSeconds });
    }, [audioUrl, durationSeconds]);

    useEffect(() => {
        if (typeof navigator === 'undefined' || !navigator.mediaSession) return undefined;
        const audio = audioRef.current;
        if (typeof window.MediaMetadata === 'function') {
            navigator.mediaSession.metadata = new window.MediaMetadata({
                title: title || 'Study podcast',
                artist: subtitle || 'ChewnPour',
                album: 'ChewnPour',
            });
        }
        const seekBy = (offsetSeconds) => {
            if (!audio) return;
            const nextTime = clamp((audio.currentTime || 0) + offsetSeconds, 0, audio.duration || effectiveDuration || 0);
            audio.currentTime = nextTime;
            dispatchPlayer({ type: 'seek', currentTime: nextTime });
        };
        navigator.mediaSession.setActionHandler('play', () => {
            void audio?.play();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            audio?.pause();
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            seekBy(-(details?.seekOffset || SKIP_SECONDS));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            seekBy(details?.seekOffset || SKIP_SECONDS);
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (!audio || details?.seekTime == null) return;
            audio.currentTime = details.seekTime;
            dispatchPlayer({ type: 'seek', currentTime: details.seekTime });
        });
        return () => {
            navigator.mediaSession.setActionHandler('play', null);
            navigator.mediaSession.setActionHandler('pause', null);
            navigator.mediaSession.setActionHandler('seekbackward', null);
            navigator.mediaSession.setActionHandler('seekforward', null);
            navigator.mediaSession.setActionHandler('seekto', null);
        };
    }, [audioUrl, effectiveDuration, subtitle, title]);

    useEffect(() => {
        if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
        navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }, [playing]);

    const seekToRatio = (ratio) => {
        const audio = audioRef.current;
        if (!audio || effectiveDuration <= 0) return;
        const nextTime = clamp(ratio, 0, 1) * effectiveDuration;
        audio.currentTime = nextTime;
        dispatchPlayer({ type: 'seek', currentTime: nextTime });
    };

    const seekBySeconds = (offsetSeconds) => {
        if (effectiveDuration <= 0) return;
        seekToRatio((currentTime + offsetSeconds) / effectiveDuration);
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
        const step = event.shiftKey ? SKIP_SECONDS : 5;
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
                onPlay?.();
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
        <div className={`min-w-0 ${className}`.trim()}>
            <audio
                ref={audioRef}
                src={audioUrl}
                preload="metadata"
                playsInline
                webkit-playsinline="true"
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
            />

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => seekBySeconds(-SKIP_SECONDS)}
                    disabled={!audioUrl || effectiveDuration <= 0}
                    className={controlButtonClass}
                    aria-label={`Back ${SKIP_SECONDS} seconds`}
                >
                    <AppIcon name="skip_previous" size={24} aria-hidden="true" />
                </button>

                <button
                    type="button"
                    onClick={togglePlayback}
                    disabled={!audioUrl}
                    className="inline-flex size-12 shrink-0 select-none items-center justify-center rounded-full bg-cta text-cta-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-soft focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cta-hover"
                    aria-label={playing ? 'Pause podcast' : 'Play podcast'}
                >
                    <AppIcon
                        name={buffering ? 'hourglass_top' : playing ? 'pause' : 'play_arrow'}
                        size={28}
                        fill={buffering ? 'none' : 'currentColor'}
                        strokeWidth={buffering ? 2 : 2.25}
                        aria-hidden="true"
                    />
                </button>

                <button
                    type="button"
                    onClick={() => seekBySeconds(SKIP_SECONDS)}
                    disabled={!audioUrl || effectiveDuration <= 0}
                    className={controlButtonClass}
                    aria-label={`Forward ${SKIP_SECONDS} seconds`}
                >
                    <AppIcon name="skip_next" size={24} aria-hidden="true" />
                </button>

                <div className="min-w-0 flex-1">
                    <div
                        ref={scrubberRef}
                        role="slider"
                        tabIndex={0}
                        aria-label="Podcast progress"
                        aria-valuemin={0}
                        aria-valuemax={Math.max(0, Math.round(effectiveDuration))}
                        aria-valuenow={Math.max(0, Math.round(currentTime))}
                        aria-valuetext={timeLabel}
                        className="relative h-11 cursor-pointer touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-primary-soft"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onKeyDown={handleKeyDown}
                    >
                        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-muted dark:bg-surface-variant">
                            <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${progress * 100}%` }}
                            />
                        </div>
                        <span
                            className="pointer-events-none absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-primary"
                            style={{ left: `calc(${progress * 100}% - 7px)` }}
                            aria-hidden="true"
                        />
                    </div>
                    <div className="flex items-center justify-between text-caption font-semibold tabular-nums text-text-secondary">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(effectiveDuration)}</span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mt-3 rounded-xl border border-error/30 bg-error-soft px-3 py-2 text-body-sm text-error" role="alert">
                    {error}
                </div>
            )}
        </div>
    );
};

export default PodcastWaveformPlayer;
