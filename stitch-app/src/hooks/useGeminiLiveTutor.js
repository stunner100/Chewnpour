import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { createPcmPlayer, startMicCapture } from '@/lib/liveTutorAudio';
import { revealedCaption } from '@/lib/liveTutorCaptions';
import { isLiveTutorUiEnabled } from '@/lib/liveTutorEnabled';

const KICKOFF_TEXT = 'Start the oral review now with your first question.';

const appendTranscription = (items, role, chunk) => {
    const text = String(chunk || '');
    if (!text) return items;
    const last = items[items.length - 1];
    if (last?.role === role) {
        return [...items.slice(0, -1), { ...last, text: `${last.text}${text}` }];
    }
    return [...items, { id: `${role}-${items.length + 1}`, role, text }];
};

export default function useGeminiLiveTutor({ topicId } = {}) {
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const [transcript, setTranscript] = useState([]);
    const [liveCaption, setLiveCaption] = useState('');
    const sessionRef = useRef(null);
    const captureRef = useRef(null);
    const playerRef = useRef(null);
    const generationRef = useRef(0);
    const statusRef = useRef('idle');
    const voiceLevelRef = useRef(0);
    const pendingCaptionRef = useRef('');
    const liveCaptionRef = useRef('');
    const captionClockRef = useRef(0);
    const captionIdRef = useRef(0);
    const stopCaptionClockRef = useRef(() => {});
    const startCaptionClockRef = useRef(() => {});
    const commitAssistantCaptionRef = useRef(() => {});
    const applyLiveCaptionRef = useRef(() => {});
    const playQueueRef = useRef(Promise.resolve());
    const queuedAudioRef = useRef(0);
    const turnCompleteRef = useRef(false);
    const captionCommittedRef = useRef(true);

    const applyStatus = useCallback((next) => {
        statusRef.current = next;
        setStatus(next);
    }, []);

    const setVoiceLevel = (level) => {
        voiceLevelRef.current = Number.isFinite(level) ? level : 0;
    };

    const applyLiveCaption = (text) => {
        const next = String(text || '');
        if (next === liveCaptionRef.current) return;
        liveCaptionRef.current = next;
        setLiveCaption(next);
    };
    applyLiveCaptionRef.current = applyLiveCaption;

    const stopCaptionClock = () => {
        if (!captionClockRef.current) return;
        cancelAnimationFrame(captionClockRef.current);
        captionClockRef.current = 0;
    };
    stopCaptionClockRef.current = stopCaptionClock;

    const tickCaption = () => {
        captionClockRef.current = 0;
        const player = playerRef.current;
        const playing = Boolean(player?.isPlaying?.());
        const progress = playing ? Number(player?.getProgress?.() || 0) : 0;
        applyLiveCaptionRef.current(
            revealedCaption(pendingCaptionRef.current, progress, liveCaptionRef.current),
        );
        if (playing) {
            captionClockRef.current = requestAnimationFrame(tickCaption);
        }
    };

    const startCaptionClock = () => {
        if (captionClockRef.current) return;
        captionClockRef.current = requestAnimationFrame(tickCaption);
    };
    startCaptionClockRef.current = startCaptionClock;

    const commitAssistantCaption = () => {
        stopCaptionClockRef.current();
        const full = pendingCaptionRef.current.trim();
        pendingCaptionRef.current = '';
        applyLiveCaptionRef.current('');
        captionCommittedRef.current = true;
        turnCompleteRef.current = false;
        if (!full) return;
        captionIdRef.current += 1;
        setTranscript((current) => [
            ...current,
            { id: `assistant-${captionIdRef.current}`, role: 'assistant', text: full },
        ]);
    };
    commitAssistantCaptionRef.current = commitAssistantCaption;

    const stop = useCallback(async () => {
        generationRef.current += 1;
        commitAssistantCaptionRef.current();
        const session = sessionRef.current;
        sessionRef.current = null;
        const capture = captureRef.current;
        captureRef.current = null;
        const player = playerRef.current;
        playerRef.current = null;
        try {
            session?.close?.();
        } catch {
            // ignore close races
        }
        if (capture?.stop) {
            await capture.stop();
        }
        if (player?.close) {
            await player.close();
        }
        setVoiceLevel(0);
        applyStatus('idle');
    }, [applyStatus]);

    const start = useCallback(async () => {
        if (!topicId) {
            setError('Missing lesson.');
            applyStatus('error');
            return;
        }

        await stop();
        const generation = generationRef.current;
        setError(null);
        setTranscript([]);
        pendingCaptionRef.current = '';
        applyLiveCaptionRef.current('');
        playQueueRef.current = Promise.resolve();
        queuedAudioRef.current = 0;
        turnCompleteRef.current = false;
        captionCommittedRef.current = true;
        applyStatus('connecting');

        try {
            const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/live-tutor`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || 'Could not start the live tutor.');
            }
            const token = String(payload.token || '').trim();
            const model = String(payload.model || '').trim();
            if (!token || !model) {
                throw new Error('Live tutor token was incomplete.');
            }
            if (generation !== generationRef.current) return;

            const player = createPcmPlayer({
                onLevel: (level) => {
                    if (generation !== generationRef.current) return;
                    if (statusRef.current === 'speaking') setVoiceLevel(level);
                },
                onIdle: () => {
                    if (generation !== generationRef.current) return;
                    setVoiceLevel(0);
                    if (queuedAudioRef.current > 0) return;
                    if (!turnCompleteRef.current) return;
                    const full = pendingCaptionRef.current.trim();
                    if (full) applyLiveCaptionRef.current(full);
                    applyStatus('listening');
                },
            });
            playerRef.current = player;

            const ai = new GoogleGenAI({
                apiKey: token,
                httpOptions: { apiVersion: payload.apiVersion || 'v1alpha' },
            });

            const connectConfig = payload.connectConfig && typeof payload.connectConfig === 'object'
                ? {
                    ...payload.connectConfig,
                    responseModalities: payload.connectConfig.responseModalities || [Modality.AUDIO],
                }
                : { responseModalities: [Modality.AUDIO] };

            const session = await ai.live.connect({
                model,
                config: connectConfig,
                callbacks: {
                    onopen: () => {
                        if (generation !== generationRef.current) return;
                        applyStatus('listening');
                    },
                    onmessage: (message) => {
                        if (generation !== generationRef.current) return;
                        const content = message?.serverContent;
                        if (content?.interrupted) {
                            playerRef.current?.stop?.();
                            turnCompleteRef.current = true;
                            commitAssistantCaptionRef.current();
                            setVoiceLevel(0);
                            applyStatus('listening');
                        }
                        const parts = content?.modelTurn?.parts;
                        if (Array.isArray(parts)) {
                            for (const part of parts) {
                                const audioData = part?.inlineData?.data;
                                if (!audioData) continue;
                                queuedAudioRef.current += 1;
                                playQueueRef.current = playQueueRef.current
                                    .then(async () => {
                                        if (generation !== generationRef.current) return;
                                        const player = playerRef.current;
                                        if (!player) return;
                                        if (!player.isPlaying() && captionCommittedRef.current) {
                                            applyLiveCaptionRef.current('');
                                            pendingCaptionRef.current = '';
                                            captionCommittedRef.current = false;
                                            turnCompleteRef.current = false;
                                        }
                                        applyStatus('speaking');
                                        await player.playBase64(audioData);
                                        if (generation !== generationRef.current) return;
                                        startCaptionClockRef.current();
                                    })
                                    .catch(() => {})
                                    .finally(() => {
                                        queuedAudioRef.current = Math.max(0, queuedAudioRef.current - 1);
                                    });
                            }
                        }
                        if (content?.inputTranscription?.text) {
                            commitAssistantCaptionRef.current();
                            setTranscript((current) =>
                                appendTranscription(current, 'user', content.inputTranscription.text),
                            );
                        }
                        if (content?.outputTranscription?.text) {
                            pendingCaptionRef.current += content.outputTranscription.text;
                            if (playerRef.current?.isPlaying?.()) {
                                startCaptionClockRef.current();
                            } else if (pendingCaptionRef.current.trim()) {
                                applyLiveCaptionRef.current(
                                    revealedCaption(
                                        pendingCaptionRef.current,
                                        1,
                                        liveCaptionRef.current,
                                    ),
                                );
                            }
                        }
                        if (content?.turnComplete) {
                            turnCompleteRef.current = true;
                            if (queuedAudioRef.current === 0 && !playerRef.current?.isPlaying?.()) {
                                const full = pendingCaptionRef.current.trim();
                                if (full) applyLiveCaptionRef.current(full);
                                setVoiceLevel(0);
                                applyStatus('listening');
                            }
                        }
                    },
                    onerror: (event) => {
                        if (generation !== generationRef.current) return;
                        setError(event?.message || 'Live tutor connection failed.');
                        applyStatus('error');
                    },
                    onclose: () => {
                        if (generation !== generationRef.current) return;
                        if (statusRef.current === 'error') return;
                        applyStatus('idle');
                    },
                },
            });

            if (generation !== generationRef.current) {
                session.close();
                await player.close();
                playerRef.current = null;
                return;
            }

            sessionRef.current = session;
            session.sendRealtimeInput({ text: KICKOFF_TEXT });

            const capture = await startMicCapture({
                onPcmBase64: (data) => {
                    if (generation !== generationRef.current) return;
                    sessionRef.current?.sendRealtimeInput({
                        audio: {
                            data,
                            mimeType: 'audio/pcm;rate=16000',
                        },
                    });
                },
                onLevel: (level) => {
                    if (generation !== generationRef.current) return;
                    if (statusRef.current === 'listening') setVoiceLevel(level);
                },
            });
            if (generation !== generationRef.current) {
                await capture.stop();
                session.close();
                await player.close();
                playerRef.current = null;
                return;
            }
            captureRef.current = capture;
            applyStatus('listening');
        } catch (caught) {
            if (generation !== generationRef.current) return;
            setError(caught?.message || 'Could not start the live tutor.');
            await stop();
            applyStatus('error');
        }
    }, [applyStatus, stop, topicId]);

    useEffect(() => () => {
        void stop();
    }, [stop]);

    return {
        enabled: isLiveTutorUiEnabled(),
        status,
        error,
        transcript,
        liveCaption,
        voiceLevelRef,
        start,
        stop,
    };
}
