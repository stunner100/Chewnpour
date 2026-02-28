import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PREFERRED_VOICE_STORAGE_KEY = "studymate.voice.preferredVoiceURI";
const LEGACY_PREFERRED_VOICE_STORAGE_KEY = "stitch.voice.preferredVoiceURI";

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

const APPLE_QUALITY_TOKENS = [
    "apple",
    "siri",
    "premium",
    "enhanced",
    "neural",
    "natural",
];

const PREFERRED_APPLE_ENGLISH_TOKENS = [
    "samantha",
    "ava",
    "allison",
    "daniel",
    "karen",
    "moira",
    "tessa",
    "reed",
    "zoe",
    "serena",
];

const NOVELTY_VOICE_TOKENS = [
    "bad news",
    "bahh",
    "bells",
    "boing",
    "bubbles",
    "cellos",
    "wobble",
    "pipe organ",
    "whisper",
    "zarvox",
    "trinoids",
    "hysterical",
];

const hasToken = (value, tokens) => tokens.some((token) => value.includes(token));

const buildVoiceDescriptor = (voice) =>
    `${(voice?.name || "").toLowerCase()} ${(voice?.voiceURI || "").toLowerCase()}`;

const isGoogleLikeVoice = (voice) => buildVoiceDescriptor(voice).includes("google");

const isNoveltyVoice = (voice) => hasToken(buildVoiceDescriptor(voice), NOVELTY_VOICE_TOKENS);

const scoreVoice = (voice, browserLang, langRoot, preferredVoiceURI = "") => {
    const descriptor = buildVoiceDescriptor(voice);
    const lang = (voice?.lang || "").toLowerCase();
    let score = 0;

    if (preferredVoiceURI && voice?.voiceURI === preferredVoiceURI) score += 10000;

    if (voice?.localService) score += 2000;
    if (lang === browserLang) score += 1200;
    else if (lang.startsWith(`${langRoot}-`)) score += 900;

    if (voice?.default) score += 150;
    if (hasToken(descriptor, APPLE_QUALITY_TOKENS)) score += 900;
    if (langRoot === "en" && hasToken(descriptor, PREFERRED_APPLE_ENGLISH_TOKENS)) score += 350;

    if (descriptor.includes("compact")) score -= 120;
    if (isGoogleLikeVoice(voice)) score -= 260;
    if (isNoveltyVoice(voice)) score -= 1400;

    return score;
};

const sortVoicesByScore = (voices, browserLang, langRoot, preferredVoiceURI = "") =>
    [...voices].sort((a, b) => {
        const scoreDiff =
            scoreVoice(b, browserLang, langRoot, preferredVoiceURI) -
            scoreVoice(a, browserLang, langRoot, preferredVoiceURI);
        if (scoreDiff !== 0) return scoreDiff;

        const aName = (a?.name || "").toLowerCase();
        const bName = (b?.name || "").toLowerCase();
        return aName.localeCompare(bName);
    });

const pickPreferredVoice = (voices, browserLang, preferredVoiceURI = "") => {
    if (!voices || voices.length === 0) return null;

    const langRoot = browserLang.split("-")[0];

    if (preferredVoiceURI) {
        const explicit = voices.find((voice) => voice.voiceURI === preferredVoiceURI);
        if (explicit) return explicit;
    }

    let candidates = voices;

    const sameLanguage = candidates.filter((voice) => {
        const lang = (voice.lang || "").toLowerCase();
        return lang === browserLang || lang.startsWith(`${langRoot}-`);
    });
    if (sameLanguage.length > 0) candidates = sameLanguage;

    const nonGoogle = candidates.filter((voice) => !isGoogleLikeVoice(voice));
    if (nonGoogle.length > 0) candidates = nonGoogle;

    const nonNovelty = candidates.filter((voice) => !isNoveltyVoice(voice));
    if (nonNovelty.length > 0) candidates = nonNovelty;

    const sortedCandidates = sortVoicesByScore(candidates, browserLang, langRoot, preferredVoiceURI);
    if (sortedCandidates.length > 0) return sortedCandidates[0];

    const sortedAll = sortVoicesByScore(voices, browserLang, langRoot, preferredVoiceURI);
    return sortedAll[0] || null;
};

const getStoredPreferredVoiceURI = () => {
    if (typeof window === "undefined") return "";
    try {
        return (
            window.localStorage.getItem(PREFERRED_VOICE_STORAGE_KEY) ||
            window.localStorage.getItem(LEGACY_PREFERRED_VOICE_STORAGE_KEY) ||
            ""
        );
    } catch {
        return "";
    }
};

const persistPreferredVoiceURI = (voiceURI) => {
    if (typeof window === "undefined") return;
    try {
        if (!voiceURI) {
            window.localStorage.removeItem(PREFERRED_VOICE_STORAGE_KEY);
            window.localStorage.removeItem(LEGACY_PREFERRED_VOICE_STORAGE_KEY);
        } else {
            window.localStorage.setItem(PREFERRED_VOICE_STORAGE_KEY, voiceURI);
            window.localStorage.removeItem(LEGACY_PREFERRED_VOICE_STORAGE_KEY);
        }
    } catch {
        // Ignore storage failures silently.
    }
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

    // iPadOS can report a desktop-like UA and Mac platform.
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
    const synthesisRef = useRef(null);
    const playbackIdRef = useRef(0);
    const activeUtteranceRef = useRef(null);
    const activeAudioRef = useRef(null);
    const activeAudioObjectUrlRef = useRef("");
    const remotePrefetchRef = useRef({
        chunkKey: "",
        chunkText: "",
        payload: null,
        payloadPromise: null,
    });
    const isStoppingRef = useRef(false);
    const voicesRef = useRef([]);
    const preferredVoiceRef = useRef(null);
    const startTimeoutRef = useRef(null);
    const remoteFailureCountRef = useRef(0);
    const remotePlaybackDisabledRef = useRef(false);
    const audioUnlockRef = useRef({
        unlocked: false,
        context: null,
    });

    const hasSpeechSynthesis = useMemo(() => {
        if (typeof window === "undefined") return false;
        return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    }, []);
    const canPlayAudio = useMemo(() => canCreateAudioElement(), []);
    const isSupported = useMemo(() => {
        const hasRemote = typeof remoteStream === "function" && canPlayAudio;
        return hasSpeechSynthesis || hasRemote;
    }, [hasSpeechSynthesis, canPlayAudio, remoteStream]);
    const convexHttpBaseUrl = useMemo(() => resolveConvexHttpBaseUrl(), []);

    const browserLang = useMemo(() => {
        if (typeof navigator === "undefined" || !navigator.language) return "en-us";
        return navigator.language.toLowerCase();
    }, []);

    const [status, setStatus] = useState(() => (isSupported ? "idle" : "unsupported"));
    const [error, setError] = useState(null);
    const [playbackEngine, setPlaybackEngine] = useState("browser");
    const [preferredVoiceURI, setPreferredVoiceURI] = useState(() => getStoredPreferredVoiceURI());
    const [selectedVoiceName, setSelectedVoiceName] = useState("Auto");
    const [availableVoices, setAvailableVoices] = useState([]);
    const isMobileBrowser = useMemo(() => isLikelyMobileBrowser(), []);
    const speechStartTimeoutMs = useMemo(() => (isMobileBrowser ? 9000 : 2000), [isMobileBrowser]);
    const maxSpeechStartRetries = useMemo(() => (isMobileBrowser ? 2 : 1), [isMobileBrowser]);

    const clearStartTimeout = useCallback(() => {
        if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
        }
    }, []);

    const refreshVoices = useCallback(() => {
        if (!hasSpeechSynthesis || !synthesisRef.current) return;

        const voices = synthesisRef.current.getVoices() || [];
        voicesRef.current = voices;

        const selected = pickPreferredVoice(voices, browserLang, preferredVoiceURI);
        preferredVoiceRef.current = selected;
        setSelectedVoiceName(selected?.name || "Auto");

        const sortedForDisplay = sortVoicesByScore(
            voices,
            browserLang,
            browserLang.split("-")[0],
            preferredVoiceURI
        );

        setAvailableVoices(
            sortedForDisplay.map((voice) => ({
                name: voice.name,
                lang: voice.lang || "",
                voiceURI: voice.voiceURI || voice.name,
                localService: Boolean(voice.localService),
                default: Boolean(voice.default),
            }))
        );
    }, [hasSpeechSynthesis, browserLang, preferredVoiceURI]);

    const setVoicePreference = useCallback((voiceURI) => {
        const normalized = String(voiceURI || "");
        setPreferredVoiceURI(normalized);
        persistPreferredVoiceURI(normalized);
    }, []);

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

            // A near-silent oscillator "unlocks" audio output on mobile browsers.
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            gainNode.gain.value = 0.00001;
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.01);
            audioUnlockRef.current.unlocked = true;
        } catch {
            // Ignore unlock failures and continue normal playback attempts.
        }
    }, [canPlayAudio]);

    const unlockSpeechSynthesisOutput = useCallback(() => {
        if (!isMobileBrowser || !hasSpeechSynthesis || !synthesisRef.current) return;
        try {
            const synthesis = synthesisRef.current;
            if (synthesis.speaking || synthesis.pending) return;
            const warmup = new window.SpeechSynthesisUtterance(" ");
            warmup.volume = 0;
            warmup.rate = 1;
            warmup.pitch = 1;
            warmup.lang = browserLang;
            synthesis.speak(warmup);
            synthesis.cancel();
        } catch {
            // Ignore warm-up failures and keep normal playback flow.
        }
    }, [isMobileBrowser, hasSpeechSynthesis, browserLang]);

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

    useEffect(() => {
        if (!hasSpeechSynthesis) return;
        const synthesis = window.speechSynthesis;
        synthesisRef.current = synthesis;
        const initVoicesTimer = setTimeout(() => {
            refreshVoices();
        }, 0);

        const handleVoicesChanged = () => {
            refreshVoices();
        };

        if (synthesis.addEventListener) {
            synthesis.addEventListener("voiceschanged", handleVoicesChanged);
        } else {
            synthesis.onvoiceschanged = handleVoicesChanged;
        }

        return () => {
            clearTimeout(initVoicesTimer);
            clearStartTimeout();
            if (synthesis.removeEventListener) {
                synthesis.removeEventListener("voiceschanged", handleVoicesChanged);
            } else if (synthesis.onvoiceschanged === handleVoicesChanged) {
                synthesis.onvoiceschanged = null;
            }
        };
    }, [hasSpeechSynthesis, refreshVoices, clearStartTimeout]);

    const stop = useCallback(() => {
        if (!isSupported) return false;
        clearStartTimeout();
        playbackIdRef.current += 1;
        isStoppingRef.current = true;
        if (hasSpeechSynthesis && synthesisRef.current) {
            synthesisRef.current.cancel();
        }
        activeUtteranceRef.current = null;
        clearRemotePrefetch();
        clearActiveAudio();
        setStatus("idle");
        setError(null);
        return true;
    }, [
        isSupported,
        hasSpeechSynthesis,
        clearStartTimeout,
        clearRemotePrefetch,
        clearActiveAudio,
    ]);

    const playWithSpeechSynthesis = useCallback(
        (text, playbackId) => {
            if (!hasSpeechSynthesis || !synthesisRef.current) {
                return false;
            }

            const chunks = splitTextIntoChunks(String(text || ""));
            if (chunks.length === 0) {
                setError("No explanation text available to read.");
                setStatus("error");
                return false;
            }

            setPlaybackEngine("browser");
            isStoppingRef.current = false;
            clearStartTimeout();
            refreshVoices();

            if (synthesisRef.current.paused) {
                synthesisRef.current.resume();
            }
            if (synthesisRef.current.speaking || synthesisRef.current.pending) {
                synthesisRef.current.cancel();
            }

            let chunkIndex = 0;
            let firstChunkStarted = false;
            let firstChunkRetryCount = 0;

            const retryFirstChunk = (reason) => {
                if (chunkIndex !== 0) return false;
                if (firstChunkRetryCount >= maxSpeechStartRetries) return false;

                firstChunkRetryCount += 1;
                clearStartTimeout();
                if (synthesisRef.current?.speaking || synthesisRef.current?.pending) {
                    synthesisRef.current.cancel();
                }
                refreshVoices();

                if (import.meta.env.DEV) {
                    console.warn(`[VoiceMode] ${reason}; retrying first chunk (${firstChunkRetryCount}/${maxSpeechStartRetries}).`);
                }

                setTimeout(() => {
                    if (playbackIdRef.current !== playbackId || isStoppingRef.current) return;
                    speakChunk(false);
                }, 220);
                return true;
            };

            const speakChunk = (usePreferredVoice = true) => {
                const utterance = new window.SpeechSynthesisUtterance(chunks[chunkIndex]);
                if (usePreferredVoice) {
                    const preferredVoice =
                        preferredVoiceRef.current ||
                        pickPreferredVoice(voicesRef.current, browserLang, preferredVoiceURI) ||
                        null;
                    if (preferredVoice) {
                        utterance.voice = preferredVoice;
                        utterance.lang = preferredVoice.lang;
                    } else {
                        utterance.lang = browserLang;
                    }
                } else {
                    utterance.lang = browserLang;
                }
                utterance.rate = 0.96;
                utterance.pitch = 1;
                utterance.volume = 1;
                activeUtteranceRef.current = utterance;

                utterance.onstart = () => {
                    if (playbackIdRef.current !== playbackId) return;
                    firstChunkStarted = true;
                    clearStartTimeout();
                    setStatus("playing");
                };

                utterance.onend = () => {
                    if (playbackIdRef.current !== playbackId || isStoppingRef.current) return;
                    chunkIndex += 1;
                    speakNext();
                };

                utterance.onerror = (event) => {
                    if (playbackIdRef.current !== playbackId || isStoppingRef.current) return;
                    clearStartTimeout();
                    if (retryFirstChunk("Speech synthesis errored before first chunk started")) {
                        return;
                    }
                    if (import.meta.env.DEV) {
                        console.error("[VoiceMode] Speech synthesis error:", event.error || event);
                    }
                    setError("Voice playback failed. Please try again.");
                    setStatus("error");
                };

                synthesisRef.current.speak(utterance);

                if (chunkIndex === 0) {
                    startTimeoutRef.current = setTimeout(() => {
                        if (
                            playbackIdRef.current === playbackId &&
                            !isStoppingRef.current &&
                            !firstChunkStarted
                        ) {
                            if (retryFirstChunk("First utterance did not start")) {
                                return;
                            }
                            setError(
                                isMobileBrowser
                                    ? "Voice did not start on mobile. Turn off silent mode, raise media volume, then tap Play again."
                                    : "Voice did not start. Check tab/site sound and system output, then press Play again."
                            );
                            setStatus("error");
                        }
                    }, speechStartTimeoutMs);
                }
            };

            const speakNext = () => {
                if (playbackIdRef.current !== playbackId || isStoppingRef.current) return;

                if (chunkIndex >= chunks.length) {
                    clearStartTimeout();
                    activeUtteranceRef.current = null;
                    setStatus("idle");
                    return;
                }

                const usePreferredVoice = !(chunkIndex === 0 && firstChunkRetryCount > 0);
                speakChunk(usePreferredVoice);
            };

            speakNext();
            return true;
        },
        [
            hasSpeechSynthesis,
            clearStartTimeout,
            refreshVoices,
            browserLang,
            preferredVoiceURI,
            speechStartTimeoutMs,
            maxSpeechStartRetries,
            isMobileBrowser,
        ]
    );

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

            setPlaybackEngine("remote");
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
            clearStartTimeout();
            clearRemotePrefetch();
            clearActiveAudio();
            unlockAudioOutput();
            unlockSpeechSynthesisOutput();

            if (hasSpeechSynthesis && synthesisRef.current) {
                if (synthesisRef.current.paused) {
                    synthesisRef.current.resume();
                }
                if (synthesisRef.current.speaking || synthesisRef.current.pending) {
                    synthesisRef.current.cancel();
                }
            }

            if (
                typeof remoteStream === "function" &&
                canPlayAudio &&
                !remotePlaybackDisabledRef.current
            ) {
                try {
                    const remoteStarted = await playWithRemoteAudio(inputText, playbackId);
                    if (remoteStarted) return true;
                } catch (remoteError) {
                    const remoteMessage = formatRemotePlaybackError(remoteError);
                    const hasBrowserVoiceFallback = Boolean(hasSpeechSynthesis && synthesisRef.current);
                    if (isVoiceQuotaExceededMessage(remoteMessage)) {
                        remotePlaybackDisabledRef.current = true;
                        setError(remoteMessage);
                        setStatus("error");
                        return false;
                    }

                    if (isLikelyAutoplayPolicyErrorMessage(remoteMessage)) {
                        remotePlaybackDisabledRef.current = true;
                        if (!hasBrowserVoiceFallback) {
                            setError("Audio was blocked by your mobile browser. Tap Play again.");
                            setStatus("error");
                            return false;
                        }
                        setError(null);
                        console.warn("[VoiceMode] AI voice blocked by autoplay/permission policy. Falling back to browser voice.", {
                            remoteMessage,
                            disabledForSession: remotePlaybackDisabledRef.current,
                        });
                        remoteFailureCountRef.current = 0;
                    } else if (isMobileBrowser) {
                        remotePlaybackDisabledRef.current = true;
                        if (!hasBrowserVoiceFallback) {
                            setError(remoteMessage);
                            setStatus("error");
                            return false;
                        }
                        setError(null);
                        console.warn("[VoiceMode] AI voice failed on mobile. Falling back to browser voice.", {
                            remoteMessage,
                            disabledForSession: remotePlaybackDisabledRef.current,
                        });
                        remoteFailureCountRef.current = 0;
                    } else {
                        if (!hasBrowserVoiceFallback) {
                            setError(remoteMessage);
                            setStatus("error");
                            return false;
                        }

                        remoteFailureCountRef.current += 1;
                        const shouldDisableRemote =
                            shouldDisableRemotePlaybackForSession(remoteMessage) ||
                            remoteFailureCountRef.current >= 2;
                        if (shouldDisableRemote) {
                            remotePlaybackDisabledRef.current = true;
                        }

                        setError(null);
                        console.warn("[VoiceMode] AI voice playback failed. Falling back to browser voice.", {
                            remoteMessage,
                            disabledForSession: remotePlaybackDisabledRef.current,
                            failureCount: remoteFailureCountRef.current,
                        });
                    }
                }
            }

            const localStarted = playWithSpeechSynthesis(inputText, playbackId);
            if (!localStarted) {
                setError("Voice playback is unavailable right now.");
                setStatus("error");
                return false;
            }
            return true;
        },
        [
            isSupported,
            clearStartTimeout,
            clearRemotePrefetch,
            clearActiveAudio,
            hasSpeechSynthesis,
            formatRemotePlaybackError,
            remoteStream,
            canPlayAudio,
            playWithRemoteAudio,
            playWithSpeechSynthesis,
            isMobileBrowser,
            unlockAudioOutput,
            unlockSpeechSynthesisOutput,
        ]
    );

    const pause = useCallback(() => {
        if (!isSupported) return false;

        if (playbackEngine === "remote" && activeAudioRef.current) {
            if (!activeAudioRef.current.paused && !activeAudioRef.current.ended) {
                activeAudioRef.current.pause();
                setStatus("paused");
                return true;
            }
        }

        if (!hasSpeechSynthesis || !synthesisRef.current) return false;
        if (!synthesisRef.current.speaking || synthesisRef.current.paused) return false;
        synthesisRef.current.pause();
        setStatus("paused");
        return true;
    }, [isSupported, playbackEngine, hasSpeechSynthesis]);

    const resume = useCallback(() => {
        if (!isSupported) return false;

        if (playbackEngine === "remote" && activeAudioRef.current) {
            if (!activeAudioRef.current.paused) return false;
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
        }

        if (!hasSpeechSynthesis || !synthesisRef.current) return false;
        if (!synthesisRef.current.paused) return false;
        synthesisRef.current.resume();
        setStatus("playing");
        return true;
    }, [isSupported, playbackEngine, hasSpeechSynthesis]);

    useEffect(
        () => () => {
            if (!isSupported) return;
            clearStartTimeout();
            playbackIdRef.current += 1;
            isStoppingRef.current = true;
            if (hasSpeechSynthesis && synthesisRef.current) {
                synthesisRef.current.cancel();
            }
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
        [isSupported, hasSpeechSynthesis, clearStartTimeout, clearRemotePrefetch, clearActiveAudio]
    );

    return {
        isSupported,
        status,
        error,
        playbackEngine,
        play,
        pause,
        resume,
        stop,
        isPlaying: status === "playing",
        isPaused: status === "paused",
        availableVoices,
        selectedVoiceURI: preferredVoiceURI,
        selectedVoiceName,
        setVoicePreference,
        primeVoicePlayback: primeRemotePlayback,
    };
};

export default useVoicePlayback;
