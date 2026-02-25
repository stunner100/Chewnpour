import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    GENERIC_REMOTE_PLAYBACK_ERROR_MESSAGE,
    normalizeRemotePlaybackErrorMessage,
    shouldDisableRemotePlaybackForSession,
} from "./voicePlaybackErrors";

const PREFERRED_VOICE_STORAGE_KEY = "studymate.voice.preferredVoiceURI";
const LEGACY_PREFERRED_VOICE_STORAGE_KEY = "stitch.voice.preferredVoiceURI";

const normalizeForSpeech = (text) =>
    text
        .replace(/\s+/g, " ")
        .replace(/\s+([.,!?;:])/g, "$1")
        .trim();

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

export const useVoicePlayback = ({
    remoteSynthesize = null,
    maxRemoteChars = 2500,
} = {}) => {
    const synthesisRef = useRef(null);
    const playbackIdRef = useRef(0);
    const activeUtteranceRef = useRef(null);
    const activeAudioRef = useRef(null);
    const activeAudioUrlRef = useRef("");
    const isStoppingRef = useRef(false);
    const voicesRef = useRef([]);
    const preferredVoiceRef = useRef(null);
    const startTimeoutRef = useRef(null);
    const remoteFailureCountRef = useRef(0);
    const remotePlaybackDisabledRef = useRef(false);

    const hasSpeechSynthesis = useMemo(() => {
        if (typeof window === "undefined") return false;
        return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    }, []);
    const canPlayAudio = useMemo(() => {
        if (typeof window === "undefined") return false;
        return typeof window.Audio === "function";
    }, []);
    const isSupported = useMemo(() => {
        const hasRemote = typeof remoteSynthesize === "function" && canPlayAudio;
        return hasSpeechSynthesis || hasRemote;
    }, [hasSpeechSynthesis, canPlayAudio, remoteSynthesize]);

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

    const formatRemotePlaybackError = useCallback((error) => {
        const normalized = normalizeRemotePlaybackErrorMessage(error);
        if (!normalized) {
            return "ElevenLabs voice generation failed.";
        }
        if (normalized === GENERIC_REMOTE_PLAYBACK_ERROR_MESSAGE) {
            return normalized;
        }
        return `ElevenLabs voice failed: ${normalized}`;
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
        if (activeAudioUrlRef.current) {
            URL.revokeObjectURL(activeAudioUrlRef.current);
            activeAudioUrlRef.current = "";
        }
    }, []);

    const decodeBase64Audio = useCallback((base64Audio, mimeType = "audio/mpeg") => {
        const normalized = String(base64Audio || "").trim();
        const binary = window.atob(normalized);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return new Blob([bytes], { type: mimeType || "audio/mpeg" });
    }, []);

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
        clearActiveAudio();
        setStatus("idle");
        setError(null);
        return true;
    }, [isSupported, hasSpeechSynthesis, clearStartTimeout, clearActiveAudio]);

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
            let recoveredFirstChunk = false;

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
                    if (chunkIndex === 0 && !recoveredFirstChunk) {
                        recoveredFirstChunk = true;
                        if (import.meta.env.DEV) {
                            console.warn("[VoiceMode] Retrying first chunk with fallback voice settings.");
                        }
                        setTimeout(() => {
                            if (playbackIdRef.current !== playbackId || isStoppingRef.current) return;
                            speakChunk(false);
                        }, 160);
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
                            if (!recoveredFirstChunk) {
                                recoveredFirstChunk = true;
                                if (import.meta.env.DEV) {
                                    console.warn("[VoiceMode] First utterance did not start; retrying with fallback voice.");
                                }
                                if (synthesisRef.current?.speaking || synthesisRef.current?.pending) {
                                    synthesisRef.current.cancel();
                                }
                                setTimeout(() => {
                                    if (playbackIdRef.current !== playbackId || isStoppingRef.current) return;
                                    speakChunk(false);
                                }, 160);
                                return;
                            }
                            setError("Voice did not start. Check tab/site sound and system output, then press Play again.");
                            setStatus("error");
                        }
                    }, 2000);
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

                const usePreferredVoice = !(chunkIndex === 0 && recoveredFirstChunk);
                speakChunk(usePreferredVoice);
            };

            speakNext();
            return true;
        },
        [hasSpeechSynthesis, clearStartTimeout, refreshVoices, browserLang, preferredVoiceURI]
    );

    const playWithRemoteAudio = useCallback(
        async (text, playbackId) => {
            if (
                typeof remoteSynthesize !== "function" ||
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
            const requestText = normalizedText.slice(0, maxChars);
            setPlaybackEngine("elevenlabs");
            setStatus("loading");

            const payload = await remoteSynthesize(requestText);
            if (playbackIdRef.current !== playbackId || isStoppingRef.current) {
                return true;
            }
            remoteFailureCountRef.current = 0;

            const audioBase64 = payload?.audioBase64;
            if (!audioBase64 || typeof audioBase64 !== "string") {
                throw new Error("ElevenLabs did not return audio data.");
            }

            const audioBlob = decodeBase64Audio(audioBase64, payload?.mimeType || "audio/mpeg");
            clearActiveAudio();
            const objectUrl = URL.createObjectURL(audioBlob);
            activeAudioUrlRef.current = objectUrl;

            const audio = new window.Audio(objectUrl);
            activeAudioRef.current = audio;
            audio.preload = "auto";

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
                if (playbackIdRef.current !== playbackId) return;
                setStatus("idle");
            };
            audio.onerror = () => {
                if (playbackIdRef.current !== playbackId) return;
                setError("Voice playback failed. Please try again.");
                setStatus("error");
            };

            await audio.play();
            return true;
        },
        [remoteSynthesize, canPlayAudio, maxRemoteChars, decodeBase64Audio, clearActiveAudio]
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
            clearActiveAudio();

            if (hasSpeechSynthesis && synthesisRef.current) {
                if (synthesisRef.current.paused) {
                    synthesisRef.current.resume();
                }
                if (synthesisRef.current.speaking || synthesisRef.current.pending) {
                    synthesisRef.current.cancel();
                }
            }

            if (
                typeof remoteSynthesize === "function" &&
                canPlayAudio &&
                !remotePlaybackDisabledRef.current
            ) {
                try {
                    const remoteStarted = await playWithRemoteAudio(inputText, playbackId);
                    if (remoteStarted) return true;
                } catch (remoteError) {
                    const remoteMessage = formatRemotePlaybackError(remoteError);
                    if (!hasSpeechSynthesis || !synthesisRef.current) {
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
                    console.warn("[VoiceMode] ElevenLabs playback failed. Falling back to browser voice.", {
                        remoteMessage,
                        disabledForSession: remotePlaybackDisabledRef.current,
                        failureCount: remoteFailureCountRef.current,
                    });
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
            clearActiveAudio,
            hasSpeechSynthesis,
            formatRemotePlaybackError,
            remoteSynthesize,
            canPlayAudio,
            playWithRemoteAudio,
            playWithSpeechSynthesis,
        ]
    );

    const pause = useCallback(() => {
        if (!isSupported) return false;

        if (playbackEngine === "elevenlabs" && activeAudioRef.current) {
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

        if (playbackEngine === "elevenlabs" && activeAudioRef.current) {
            if (!activeAudioRef.current.paused) return false;
            activeAudioRef.current.play()
                .then(() => {
                    if (!isStoppingRef.current) {
                        setStatus("playing");
                    }
                })
                .catch((resumeError) => {
                    if (import.meta.env.DEV) {
                        console.warn("[VoiceMode] Failed to resume ElevenLabs playback", resumeError);
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
            clearActiveAudio();
        },
        [isSupported, hasSpeechSynthesis, clearStartTimeout, clearActiveAudio]
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
    };
};

export default useVoicePlayback;
