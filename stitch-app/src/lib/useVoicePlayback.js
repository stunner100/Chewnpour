/**
 * Voice playback is parked after the Convex cutover.
 * Keep a no-op remote stream path so lesson hooks stay Convex-free.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const normalizeForSpeech = (text) =>
    text
        .replace(/\s+/g, " ")
        .replace(/\s+([.,!?;:])/g, "$1")
        .trim();

export const useVoicePlayback = ({
    text = "",
    enabled = false,
} = {}) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const utteranceRef = useRef(null);
    const normalized = useMemo(() => normalizeForSpeech(text), [text]);

    const stop = useCallback(() => {
        if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        utteranceRef.current = null;
        setIsSpeaking(false);
    }, []);

    const speak = useCallback(() => {
        if (!enabled || !normalized || typeof window === "undefined") return;
        if (!window.speechSynthesis) return;
        stop();
        const utterance = new SpeechSynthesisUtterance(normalized);
        utteranceRef.current = utterance;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
    }, [enabled, normalized, stop]);

    useEffect(() => () => stop(), [stop]);

    return {
        isSpeaking,
        isSupported: typeof window !== "undefined" && Boolean(window.speechSynthesis),
        isRemoteAvailable: false,
        speak,
        stop,
        toggle: () => (isSpeaking ? stop() : speak()),
    };
};

export default useVoicePlayback;
