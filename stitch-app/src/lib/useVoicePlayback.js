import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_CHUNK_CHARS = 800;

const normalizeForSpeech = (text) =>
    String(text || "")
        .replace(/\s+/g, " ")
        .replace(/\s+([.,!?;:])/g, "$1")
        .trim();

export const splitLessonVoiceChunks = (text, maxChars = DEFAULT_CHUNK_CHARS) => {
    const normalized = normalizeForSpeech(text);
    if (!normalized) return [];
    if (normalized.length <= maxChars) return [normalized];

    const chunks = [];
    let remaining = normalized;
    while (remaining.length > maxChars) {
        let splitIndex = remaining.lastIndexOf(". ", maxChars);
        if (splitIndex < Math.floor(maxChars * 0.4)) {
            splitIndex = remaining.lastIndexOf(" ", maxChars);
        }
        if (splitIndex <= 0) splitIndex = maxChars;
        const includePeriod = remaining[splitIndex] === ".";
        const chunk = remaining.slice(0, splitIndex + (includePeriod ? 1 : 0)).trim();
        if (chunk) chunks.push(chunk);
        remaining = remaining.slice(splitIndex + (includePeriod ? 1 : 0)).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
};

const canCreateAudioElement = () => {
    if (typeof window === "undefined" || typeof Audio === "undefined") return false;
    try {
        return Boolean(new Audio());
    } catch {
        return false;
    }
};

const isAutoplayBlock = (error) => {
    const message = String(error?.name || error?.message || error || "");
    return /notallowed|not allowed|denied permission/i.test(message);
};

export const useVoicePlayback = ({ remoteStream = null } = {}) => {
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState(null);
    const audioRef = useRef(null);
    const objectUrlsRef = useRef([]);
    const chunksRef = useRef([]);
    const chunkIndexRef = useRef(0);
    const playbackIdRef = useRef(0);
    const remoteStreamRef = useRef(remoteStream);
    remoteStreamRef.current = remoteStream;

    const isSupported = canCreateAudioElement();

    const revokeObjectUrls = useCallback(() => {
        objectUrlsRef.current.forEach((url) => {
            try {
                URL.revokeObjectURL(url);
            } catch {
                // ignore
            }
        });
        objectUrlsRef.current = [];
    }, []);

    const clearAudio = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.onended = null;
            audio.onerror = null;
            audio.onpause = null;
            audio.onplay = null;
            try {
                audio.pause();
            } catch {
                // ignore
            }
            audio.removeAttribute("src");
            audio.load();
        }
        audioRef.current = null;
        revokeObjectUrls();
    }, [revokeObjectUrls]);

    const stop = useCallback(() => {
        playbackIdRef.current += 1;
        chunksRef.current = [];
        chunkIndexRef.current = 0;
        clearAudio();
        setError(null);
        setStatus("idle");
    }, [clearAudio]);

    const playChunk = useCallback(async (playbackId, chunkIndex) => {
        const stream = remoteStreamRef.current;
        const chunkText = chunksRef.current[chunkIndex];
        if (typeof stream !== "function" || !chunkText) {
            setStatus("idle");
            return;
        }
        setStatus("loading");
        const sourceUrl = await stream(chunkText);
        if (playbackId !== playbackIdRef.current) return;

        const resolvedUrl = String(sourceUrl || "").trim();
        if (!resolvedUrl) {
            throw new Error("Voice playback did not return audio.");
        }
        if (resolvedUrl.startsWith("blob:")) {
            objectUrlsRef.current.push(resolvedUrl);
        }

        let audio = audioRef.current;
        if (!audio) {
            audio = new Audio();
            audio.playsInline = true;
            audio.preload = "auto";
            audioRef.current = audio;
        }

        audio.onended = () => {
            if (playbackId !== playbackIdRef.current) return;
            const nextIndex = chunkIndexRef.current + 1;
            if (nextIndex < chunksRef.current.length) {
                chunkIndexRef.current = nextIndex;
                playChunk(playbackId, nextIndex).catch((playError) => {
                    if (playbackId !== playbackIdRef.current) return;
                    setError(playError?.message || "Could not continue reading the lesson.");
                    setStatus("error");
                });
                return;
            }
            setStatus("idle");
        };
        audio.onerror = () => {
            if (playbackId !== playbackIdRef.current) return;
            setError("Could not play the lesson audio.");
            setStatus("error");
        };

        audio.src = resolvedUrl;
        await audio.play();
        if (playbackId !== playbackIdRef.current) return;
        setStatus("playing");
    }, []);

    const play = useCallback(async (text) => {
        const chunks = splitLessonVoiceChunks(text);
        if (chunks.length === 0) {
            setError("No explanation text available to read.");
            setStatus("error");
            return false;
        }
        if (!isSupported || typeof remoteStreamRef.current !== "function") {
            setError("Voice playback is unavailable in this browser.");
            setStatus("unsupported");
            return false;
        }

        playbackIdRef.current += 1;
        const playbackId = playbackIdRef.current;
        clearAudio();
        chunksRef.current = chunks;
        chunkIndexRef.current = 0;
        setError(null);

        const audio = new Audio();
        audio.playsInline = true;
        audio.preload = "auto";
        audioRef.current = audio;
        try {
            audio.muted = true;
            audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
            await audio.play();
            audio.pause();
        } catch {
            // Unlock is best-effort; the real clip still starts from this click.
        }
        audio.muted = false;

        try {
            await playChunk(playbackId, 0);
            return playbackId === playbackIdRef.current;
        } catch (playError) {
            if (playbackId !== playbackIdRef.current) return false;
            setError(
                isAutoplayBlock(playError)
                    ? "Audio was blocked by your browser. Tap Play again."
                    : (playError?.message || "Could not read this lesson aloud."),
            );
            setStatus("error");
            return false;
        }
    }, [clearAudio, isSupported, playChunk]);

    const pause = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || audio.paused) return;
        audio.pause();
        setStatus("paused");
    }, []);

    const resume = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio) return false;
        try {
            await audio.play();
            setStatus("playing");
            return true;
        } catch (playError) {
            setError(
                isAutoplayBlock(playError)
                    ? "Audio was blocked by your browser. Tap Play again."
                    : (playError?.message || "Could not resume playback."),
            );
            setStatus("error");
            return false;
        }
    }, []);

    const primeVoicePlayback = useCallback(() => {}, []);

    useEffect(() => () => {
        playbackIdRef.current += 1;
        clearAudio();
    }, [clearAudio]);

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
        primeVoicePlayback,
    };
};

export default useVoicePlayback;
