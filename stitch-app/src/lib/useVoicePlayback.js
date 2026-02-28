import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const normalizeForSpeech = (text) =>
    text
        .replace(/\s+/g, " ")
        .replace(/\s+([.,!?;:])/g, "$1")
        .trim();

const REMOTE_STARTUP_CHUNK_CHARS = 320;

const chunkLongSentence = (sentence, maxLength) => {
    if (sentence.length <= maxLength) return [sentence];

    const chunks = [];
    let remaining = sentence;

    while (remaining.length > maxLength) {
        let splitIndex = remaining.lastIndexOf(" ", maxLength);
        if (splitIndex <= 0) splitIndex = maxLength;
        const chunk = remaining.slice(0, splitIndex).trim();
        if (chunk) chunks.push(chunk);
        remaining = remaining.slice(splitIndex).trim();
    }

    if (remaining) chunks.push(remaining);
    return chunks;
};

const splitTextIntoChunks = (text, maxLength = 220) => {
    const normalized = normalizeForSpeech(text);
    if (!normalized) return [];

    const sentences = (normalized.match(/[^.!?]+[.!?]*/g) || [normalized])
        .map((part) => part.trim())
        .filter(Boolean);
    const chunks = [];
    let current = "";

    for (const sentence of sentences) {
        const prepared = sentence.trim();
        if (!prepared) continue;

        if (prepared.length > maxLength) {
            if (current) {
                chunks.push(current.trim());
                current = "";
            }
            chunks.push(...chunkLongSentence(prepared, maxLength));
            continue;
        }

        if (!current) {
            current = prepared;
            continue;
        }

        if (`${current} ${prepared}`.length <= maxLength) {
            current = `${current} ${prepared}`;
        } else {
            chunks.push(current.trim());
            current = prepared;
        }
    }

    if (current) chunks.push(current.trim());
    return chunks;
};

const buildRemoteChunkPlan = (normalizedText, maxChars) => {
    const startupChunkChars = Math.max(180, Math.min(REMOTE_STARTUP_CHUNK_CHARS, maxChars));
    const startupChunks = splitTextIntoChunks(normalizedText, startupChunkChars);
    if (startupChunks.length === 0) return [];

    const firstChunk = startupChunks[0];
    const remainingText = normalizedText.slice(firstChunk.length).trim();
    const trailingChunks = remainingText ? splitTextIntoChunks(remainingText, maxChars) : [];
    return [firstChunk, ...trailingChunks];
};

const GENERIC_REMOTE_PLAYBACK_ERROR_MESSAGE = "AI voice is unavailable right now.";

const CONVEX_SERVER_ERROR_PATTERN =
    /\[CONVEX [^\]]+\]\s*\[Request ID:[^\]]+\]\s*Server Error\s*Called by client/i;

const PERSISTENT_REMOTE_FAILURE_PATTERNS = [
    /payment_required/i,
    /insufficient/i,
    /quota/i,
    /credit/i,
    /missing api key/i,
    /invalid api key/i,
    /unauthorized/i,
    /forbidden/i,
];

const normalizeRemotePlaybackErrorMessage = (error) => {
    const rawMessage = error instanceof Error ? error.message : String(error || "");
    const normalized = rawMessage.replace(/\s+/g, " ").trim();
    if (!normalized) return "";

    const withoutConvexWrapper = normalized.replace(CONVEX_SERVER_ERROR_PATTERN, "").trim();
    if (!withoutConvexWrapper) return GENERIC_REMOTE_PLAYBACK_ERROR_MESSAGE;

    if (CONVEX_SERVER_ERROR_PATTERN.test(normalized) && /^server error$/i.test(withoutConvexWrapper)) {
        return GENERIC_REMOTE_PLAYBACK_ERROR_MESSAGE;
    }

    return withoutConvexWrapper;
};

const shouldDisableRemotePlaybackForSession = (message) => {
    const normalized = String(message || "").trim();
    if (!normalized) return false;
    return PERSISTENT_REMOTE_FAILURE_PATTERNS.some((pattern) => pattern.test(normalized));
};

const AUTOPLAY_BLOCK_ERROR_PATTERNS = [
    /notallowed/i,
    /not\s+allowed/i,
    /denied permission/i,
    /user agent|platform in the current context/i,
    /user.*interact/i,
    /play\(\)\s*request/i,
    /gesture/i,
    /autoplay/i,
];

const isLikelyAutoplayPolicyErrorMessage = (message) => {
    const normalized = String(message || "").trim();
    if (!normalized) return false;
    return AUTOPLAY_BLOCK_ERROR_PATTERNS.some((pattern) => pattern.test(normalized));
};

const isVoiceQuotaExceededMessage = (message) => {
    const normalized = String(message || "").toLowerCase();
    if (!normalized) return false;
    return (
        normalized.includes("voice_quota_exceeded")
        || normalized.includes("free ai voice generation")
        || normalized.includes("unlimited ai voice")
    );
};

const resolveConvexHttpBaseUrl = () => {
    const rawConvexUrl = String(import.meta.env?.VITE_CONVEX_URL || "").trim();
    if (!rawConvexUrl) return "";
    try {
        const parsed = new URL(rawConvexUrl);
        if (parsed.hostname.endsWith(".convex.cloud")) {
            parsed.hostname = parsed.hostname.replace(/\.convex\.cloud$/, ".convex.site");
        }
        return parsed.origin;
    } catch {
        return "";
    }
};

const MOBILE_BROWSER_PATTERN = /(iphone|ipad|ipod|android|mobile)/i;

const isLikelyMobileBrowser = () => {
    if (typeof navigator === "undefined") return false;
    const ua = String(navigator.userAgent || navigator.vendor || "").toLowerCase();
    if (navigator.userAgentData && navigator.userAgentData.mobile) return true;
    if (MOBILE_BROWSER_PATTERN.test(ua)) return true;

    const platform = String(navigator.platform || "").toLowerCase();
    const maxTouchPoints = Number(navigator.maxTouchPoints || 0);

    if (platform === "macintel" && maxTouchPoints > 1) return true;

    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        const hasCoarsePointer =
            window.matchMedia("(pointer: coarse)").matches ||
            window.matchMedia("(any-pointer: coarse)").matches;
        if (hasCoarsePointer && maxTouchPoints > 0) return true;
    }

    return false;
};

const canCreateAudioElement = () => {
    if (typeof window === "undefined") return false;
    if (typeof window.Audio === "function") return true;
    if (typeof document === "undefined" || typeof document.createElement !== "function") return false;
    const audio = document.createElement("audio");
    return Boolean(audio && typeof audio.play === "function");
};

const createAudioElement = (src) => {
    if (typeof window !== "undefined" && typeof window.Audio === "function") {
        return new window.Audio(src);
    }
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
        return null;
    }
    const audio = document.createElement("audio");
    audio.src = src;
    return audio;
};

export const useVoicePlayback = ({
    remoteStream = null,
    maxRemoteChars = 900,
} = {}) => {
    const playbackIdRef = useRef(0);
    const activeAudioRef = useRef(null);
    const activeAudioObjectUrlRef = useRef("");
    const remotePrefetchRef = useRef({
        chunkKey: "",
        chunkText: "",
        payload: null,
        payloadPromise: null,
    });
    const isStoppingRef = useRef(false);
    const remoteFailureCountRef = useRef(0);
    const remotePlaybackDisabledRef = useRef(false);
    const autoplayRetryCountRef = useRef(0);
    const audioUnlockRef = useRef({
        unlocked: false,
        context: null,
    });

    const canPlayAudio = useMemo(() => canCreateAudioElement(), []);
    const isSupported = useMemo(() => {
        return typeof remoteStream === "function" && canPlayAudio;
    }, [canPlayAudio, remoteStream]);
    const convexHttpBaseUrl = useMemo(() => resolveConvexHttpBaseUrl(), []);
    const isMobileBrowser = useMemo(() => isLikelyMobileBrowser(), []);

    const [status, setStatus] = useState(() => (isSupported ? "idle" : "unsupported"));
    const [error, setError] = useState(null);

    const formatRemotePlaybackError = useCallback((sourceError) => {
        const normalized = normalizeRemotePlaybackErrorMessage(sourceError);
        if (!normalized) {
            return "AI voice generation failed.";
        }
        if (normalized === GENERIC_REMOTE_PLAYBACK_ERROR_MESSAGE) {
            return normalized;
        }
        return `AI voice failed: ${normalized}`;
    }, []);

    const clearActiveAudio = useCallback(() => {
        const audio = activeAudioRef.current;
        if (audio) {
            audio.onplay = null;
            audio.onpause = null;
            audio.onended = null;
            audio.onerror = null;
            try {
                audio.pause();
            } catch {
                // ignore
            }
            try {
                audio.removeAttribute("src");
                audio.load();
            } catch {
                // ignore
            }
        }
        activeAudioRef.current = null;
        if (activeAudioObjectUrlRef.current) {
            try {
                URL.revokeObjectURL(activeAudioObjectUrlRef.current);
            } catch {
                // ignore
            }
            activeAudioObjectUrlRef.current = "";
        }
    }, []);

    const clearRemotePrefetch = useCallback(() => {
        remotePrefetchRef.current = {
            chunkKey: "",
            chunkText: "",
            payload: null,
            payloadPromise: null,
        };
    }, []);

    const unlockAudioOutput = useCallback(() => {
        if (!canPlayAudio || typeof window === "undefined") return;
        if (audioUnlockRef.current.unlocked) return;
        try {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextCtor) return;

            let context = audioUnlockRef.current.context;
            if (!context || context.state === "closed") {
                context = new AudioContextCtor();
                audioUnlockRef.current.context = context;
            }

            if (context.state === "suspended") {
                context.resume().catch(() => undefined);
            }

            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            gainNode.gain.value = 0.00001;
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.01);
            audioUnlockRef.current.unlocked = true;
        } catch {
            // Ignore unlock failures.
        }
    }, [canPlayAudio]);

    const fetchRemoteAudioBlobUrl = useCallback(async (streamUrl) => {
        const response = await fetch(streamUrl, {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            const contentType = String(response.headers.get("content-type") || "").toLowerCase();
            let details = "";
            if (contentType.includes("application/json")) {
                const payload = await response.json().catch(() => null);
                details = String(payload?.error || payload?.message || "").trim();
            } else {
                details = String(await response.text().catch(() => "") || "").trim().slice(0, 220);
            }
            throw new Error(details || `AI voice request failed with status ${response.status}.`);
        }

        const blob = await response.blob();
        if (!blob || blob.size <= 0) {
            throw new Error("AI voice provider returned empty audio.");
        }
        return URL.createObjectURL(blob);
    }, []);

    const primeRemotePlayback = useCallback(
        (text) => {
            if (
                typeof remoteStream !== "function" ||
                !canPlayAudio ||
                remotePlaybackDisabledRef.current
            ) {
                return false;
            }

            const normalizedText = normalizeForSpeech(String(text || ""));
            if (!normalizedText) return false;

            const maxChars = Math.max(300, Number(maxRemoteChars || 2500));
            const remoteChunks = buildRemoteChunkPlan(normalizedText, maxChars);
            if (remoteChunks.length === 0) return false;
            const firstChunk = remoteChunks[0];
            const chunkKey = `${maxChars}:${firstChunk}`;

            if (
                remotePrefetchRef.current.chunkKey === chunkKey &&
                (remotePrefetchRef.current.payload || remotePrefetchRef.current.payloadPromise)
            ) {
                return true;
            }

            const payloadPromise = remoteStream(firstChunk, { consumeQuota: false })
                .then((payload) => {
                    if (remotePrefetchRef.current.chunkKey === chunkKey) {
                        remotePrefetchRef.current.payload = payload;
                    }
                    return payload;
                })
                .catch(() => null)
                .finally(() => {
                    if (remotePrefetchRef.current.chunkKey === chunkKey) {
                        remotePrefetchRef.current.payloadPromise = null;
                    }
                });

            remotePrefetchRef.current = {
                chunkKey,
                chunkText: firstChunk,
                payload: null,
                payloadPromise,
            };
            return true;
        },
        [remoteStream, canPlayAudio, maxRemoteChars]
    );

    const stop = useCallback(() => {
        if (!isSupported) return false;
        playbackIdRef.current += 1;
        isStoppingRef.current = true;
        clearRemotePrefetch();
        clearActiveAudio();
        setStatus("idle");
        setError(null);
        return true;
    }, [isSupported, clearRemotePrefetch, clearActiveAudio]);

    const playWithRemoteAudio = useCallback(
        async (text, playbackId) => {
            if (
                typeof remoteStream !== "function" ||
                !canPlayAudio ||
                remotePlaybackDisabledRef.current
            ) {
                return false;
            }

            const normalizedText = normalizeForSpeech(String(text || ""));
            if (!normalizedText) {
                return false;
            }

            const maxChars = Math.max(300, Number(maxRemoteChars || 2500));
            const remoteChunks = buildRemoteChunkPlan(normalizedText, maxChars);
            if (remoteChunks.length === 0) {
                return false;
            }

            const resolveStreamUrlFromPayload = (payload) => {
                const directUrl = String(payload?.streamUrl || payload?.audioUrl || "").trim();
                if (directUrl) return directUrl;

                const streamToken = String(payload?.streamToken || payload?.token || "").trim();
                if (!streamToken || !convexHttpBaseUrl) {
                    throw new Error("AI voice provider did not return a stream URL.");
                }

                return `${convexHttpBaseUrl}/voice/stream?token=${encodeURIComponent(streamToken)}`;
            };

            const resolveChunkPayload = async (
                chunkText,
                preferredPayloadPromise = null,
                consumeQuota = false,
            ) => {
                let payload = preferredPayloadPromise
                    ? await preferredPayloadPromise
                    : null;
                if (!payload) {
                    payload = await remoteStream(chunkText, { consumeQuota });
                }
                if (playbackIdRef.current !== playbackId || isStoppingRef.current) {
                    return null;
                }

                remoteFailureCountRef.current = 0;
                return {
                    streamUrl: resolveStreamUrlFromPayload(payload),
                };
            };

            const playChunkAtIndex = async (
                chunkIndex,
                preferredPayloadPromise = null,
                consumeQuota = false,
            ) => {
                const chunkText = remoteChunks[chunkIndex];
                const payload = await resolveChunkPayload(
                    chunkText,
                    preferredPayloadPromise,
                    consumeQuota,
                );
                if (!payload) {
                    return true;
                }

                const nextChunkIndex = chunkIndex + 1;
                const hasNextChunk = nextChunkIndex < remoteChunks.length;
                const nextChunkText = hasNextChunk ? remoteChunks[nextChunkIndex] : "";
                const nextPayloadPromise = hasNextChunk
                    ? remoteStream(nextChunkText, { consumeQuota: false })
                        .then((nextPayload) => ({ ok: true, payload: nextPayload }))
                        .catch((nextError) => ({ ok: false, error: nextError }))
                    : null;

                const streamUrl = payload.streamUrl;
                const sourceUrl = isMobileBrowser
                    ? await fetchRemoteAudioBlobUrl(streamUrl)
                    : streamUrl;

                clearActiveAudio();
                if (isMobileBrowser) {
                    activeAudioObjectUrlRef.current = sourceUrl;
                }
                const audio = createAudioElement(sourceUrl);
                if (!audio) {
                    throw new Error("Audio playback is unavailable right now.");
                }
                activeAudioRef.current = audio;
                audio.preload = "auto";
                audio.playsInline = true;
                audio.crossOrigin = "anonymous";

                audio.onplay = () => {
                    if (playbackIdRef.current !== playbackId || isStoppingRef.current) return;
                    setStatus("playing");
                };
                audio.onpause = () => {
                    if (playbackIdRef.current !== playbackId || isStoppingRef.current) return;
                    if (!audio.ended) {
                        setStatus("paused");
                    }
                };
                audio.onended = () => {
                    if (playbackIdRef.current !== playbackId || isStoppingRef.current) return;
                    if (!hasNextChunk) {
                        setStatus("idle");
                        return;
                    }

                    setStatus("loading");
                    void (async () => {
                        let preferredNextPromise = null;
                        if (nextPayloadPromise) {
                            const nextResult = await nextPayloadPromise;
                            if (!nextResult?.ok) {
                                throw nextResult?.error || new Error("AI voice prefetch failed.");
                            }
                            preferredNextPromise = Promise.resolve(nextResult.payload);
                        }
                        await playChunkAtIndex(nextChunkIndex, preferredNextPromise, false);
                    })().catch((chunkError) => {
                        if (playbackIdRef.current !== playbackId || isStoppingRef.current) return;
                        clearRemotePrefetch();
                        setError(formatRemotePlaybackError(chunkError));
                        setStatus("error");
                    });
                };
                audio.onerror = () => {
                    if (playbackIdRef.current !== playbackId) return;
                    setError("Voice playback failed. Please try again.");
                    setStatus("error");
                };

                try {
                    await audio.play();
                } catch (playError) {
                    const playMessage = normalizeRemotePlaybackErrorMessage(playError);
                    if (isLikelyAutoplayPolicyErrorMessage(playMessage)) {
                        unlockAudioOutput();
                        await new Promise((resolve) => setTimeout(resolve, 80));
                        await audio.play();
                    } else {
                        throw playError;
                    }
                }
                return true;
            };

            const firstChunkText = remoteChunks[0];
            const firstChunkKey = `${maxChars}:${firstChunkText}`;
            const hasPrefetchedFirstChunk = remotePrefetchRef.current.chunkKey === firstChunkKey;
            const prefetchedFirstChunkPromise = hasPrefetchedFirstChunk
                ? (
                    remotePrefetchRef.current.payload
                        ? Promise.resolve(remotePrefetchRef.current.payload)
                        : remotePrefetchRef.current.payloadPromise
                )
                : null;

            setStatus("loading");
            const started = await playChunkAtIndex(0, prefetchedFirstChunkPromise, true);
            if (hasPrefetchedFirstChunk) {
                clearRemotePrefetch();
            }
            return started;
        },
        [
            remoteStream,
            canPlayAudio,
            maxRemoteChars,
            convexHttpBaseUrl,
            clearActiveAudio,
            clearRemotePrefetch,
            formatRemotePlaybackError,
            fetchRemoteAudioBlobUrl,
            isMobileBrowser,
            unlockAudioOutput,
        ]
    );

    const play = useCallback(
        async (text) => {
            const inputText = String(text || "");
            if (!inputText.trim()) {
                setError("No explanation text available to read.");
                setStatus("error");
                return false;
            }

            if (!isSupported) {
                setStatus("unsupported");
                return false;
            }

            playbackIdRef.current += 1;
            const playbackId = playbackIdRef.current;
            isStoppingRef.current = false;
            setError(null);
            clearRemotePrefetch();
            clearActiveAudio();
            unlockAudioOutput();

            try {
                const remoteStarted = await playWithRemoteAudio(inputText, playbackId);
                if (remoteStarted) {
                    autoplayRetryCountRef.current = 0;
                    return true;
                }
            } catch (remoteError) {
                const remoteMessage = formatRemotePlaybackError(remoteError);

                if (isVoiceQuotaExceededMessage(remoteMessage)) {
                    remotePlaybackDisabledRef.current = true;
                    setError(remoteMessage);
                    setStatus("error");
                    return false;
                }

                if (isLikelyAutoplayPolicyErrorMessage(remoteMessage)) {
                    if (autoplayRetryCountRef.current < 1) {
                        autoplayRetryCountRef.current += 1;
                        setError(
                            isMobileBrowser
                                ? "Audio was blocked by your browser. Tap Play again to start voice."
                                : "Audio was blocked. Click Play again to start voice."
                        );
                    } else {
                        setError(
                            isMobileBrowser
                                ? "Voice is blocked on mobile. Turn off silent mode, raise volume, and tap Play."
                                : "Voice is blocked. Check that the tab is not muted, then click Play."
                        );
                    }
                    setStatus("error");
                    return false;
                }

                remoteFailureCountRef.current += 1;
                if (
                    shouldDisableRemotePlaybackForSession(remoteMessage) ||
                    remoteFailureCountRef.current >= 3
                ) {
                    remotePlaybackDisabledRef.current = true;
                }

                setError(remoteMessage);
                setStatus("error");
                return false;
            }

            setError("AI voice is unavailable right now.");
            setStatus("error");
            return false;
        },
        [
            isSupported,
            clearRemotePrefetch,
            clearActiveAudio,
            formatRemotePlaybackError,
            playWithRemoteAudio,
            isMobileBrowser,
            unlockAudioOutput,
        ]
    );

    const pause = useCallback(() => {
        if (!isSupported) return false;
        if (activeAudioRef.current && !activeAudioRef.current.paused && !activeAudioRef.current.ended) {
            activeAudioRef.current.pause();
            setStatus("paused");
            return true;
        }
        return false;
    }, [isSupported]);

    const resume = useCallback(() => {
        if (!isSupported) return false;
        if (!activeAudioRef.current || !activeAudioRef.current.paused) return false;
        activeAudioRef.current.play()
            .then(() => {
                if (!isStoppingRef.current) {
                    setStatus("playing");
                }
            })
            .catch((resumeError) => {
                if (import.meta.env.DEV) {
                    console.warn("[VoiceMode] Failed to resume AI voice playback", resumeError);
                }
                setError("Voice playback failed. Please try again.");
                setStatus("error");
            });
        return true;
    }, [isSupported]);

    useEffect(
        () => () => {
            if (!isSupported) return;
            playbackIdRef.current += 1;
            isStoppingRef.current = true;
            const audioContext = audioUnlockRef.current.context;
            if (audioContext && typeof audioContext.close === "function") {
                audioContext.close().catch(() => undefined);
            }
            audioUnlockRef.current = {
                unlocked: false,
                context: null,
            };
            clearRemotePrefetch();
            clearActiveAudio();
        },
        [isSupported, clearRemotePrefetch, clearActiveAudio]
    );

    return {
        isSupported,
        status,
        error,
        playbackEngine: "remote",
        play,
        pause,
        resume,
        stop,
        isPlaying: status === "playing",
        isPaused: status === "paused",
        availableVoices: [],
        selectedVoiceURI: "",
        selectedVoiceName: "Deepgram AI",
        setVoicePreference: () => {},
        primeVoicePlayback: primeRemotePlayback,
    };
};

export default useVoicePlayback;
