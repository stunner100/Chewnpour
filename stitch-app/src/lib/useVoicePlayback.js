import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

export const useVoicePlayback = () => {
    const synthesisRef = useRef(null);
    const playbackIdRef = useRef(0);
    const activeUtteranceRef = useRef(null);
    const isStoppingRef = useRef(false);
    const voicesRef = useRef([]);
    const preferredVoiceRef = useRef(null);
    const startTimeoutRef = useRef(null);

    const isSupported = useMemo(() => {
        if (typeof window === "undefined") return false;
        return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    }, []);

    const browserLang = useMemo(() => {
        if (typeof navigator === "undefined" || !navigator.language) return "en-us";
        return navigator.language.toLowerCase();
    }, []);

    const [status, setStatus] = useState(() => (isSupported ? "idle" : "unsupported"));
    const [error, setError] = useState(null);
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
        if (!synthesisRef.current) return;

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
    }, [browserLang, preferredVoiceURI]);

    const setVoicePreference = useCallback((voiceURI) => {
        const normalized = String(voiceURI || "");
        setPreferredVoiceURI(normalized);
        persistPreferredVoiceURI(normalized);
    }, []);

    useEffect(() => {
        if (!isSupported) return;
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
    }, [isSupported, refreshVoices, clearStartTimeout]);

    const stop = useCallback(() => {
        if (!isSupported || !synthesisRef.current) return false;
        clearStartTimeout();
        playbackIdRef.current += 1;
        isStoppingRef.current = true;
        synthesisRef.current.cancel();
        activeUtteranceRef.current = null;
        setStatus("idle");
        setError(null);
        return true;
    }, [isSupported, clearStartTimeout]);

    const play = useCallback(
        (text) => {
            if (!isSupported || !synthesisRef.current) {
                setStatus("unsupported");
                return false;
            }

            const chunks = splitTextIntoChunks(String(text || ""));
            if (chunks.length === 0) {
                setError("No explanation text available to read.");
                setStatus("error");
                return false;
            }

            playbackIdRef.current += 1;
            const playbackId = playbackIdRef.current;
            isStoppingRef.current = false;
            setError(null);
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
        [isSupported, clearStartTimeout, refreshVoices, browserLang, preferredVoiceURI]
    );

    const pause = useCallback(() => {
        if (!isSupported || !synthesisRef.current) return false;
        if (!synthesisRef.current.speaking || synthesisRef.current.paused) return false;
        synthesisRef.current.pause();
        setStatus("paused");
        return true;
    }, [isSupported]);

    const resume = useCallback(() => {
        if (!isSupported || !synthesisRef.current) return false;
        if (!synthesisRef.current.paused) return false;
        synthesisRef.current.resume();
        setStatus("playing");
        return true;
    }, [isSupported]);

    useEffect(
        () => () => {
            if (!isSupported || !synthesisRef.current) return;
            clearStartTimeout();
            playbackIdRef.current += 1;
            isStoppingRef.current = true;
            synthesisRef.current.cancel();
        },
        [isSupported, clearStartTimeout]
    );

    return {
        isSupported,
        status,
        error,
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
