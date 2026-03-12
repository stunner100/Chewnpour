import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Exam timer hook that only triggers a state update when the displayed
 * minute:second value changes, rather than every second via setInterval.
 * This eliminates ~2700 unnecessary full component re-renders during a 45-min exam.
 *
 * Returns { timeRemaining, formattedTime, isLowTime }.
 */
export function useExamTimer(durationSeconds, examStarted, onTimeUp) {
    const [displayTime, setDisplayTime] = useState(durationSeconds);
    const endTimeRef = useRef(null);
    const onTimeUpRef = useRef(onTimeUp);

    useEffect(() => {
        onTimeUpRef.current = onTimeUp;
    }, [onTimeUp]);

    const setTimeRemaining = useCallback((nextSeconds) => {
        const safeSeconds = Math.max(0, Math.round(Number(nextSeconds) || 0));
        endTimeRef.current = Date.now() + safeSeconds * 1000;
        setDisplayTime(safeSeconds);
    }, []);

    useEffect(() => {
        if (examStarted) {
            if (!Number.isFinite(endTimeRef.current) || endTimeRef.current <= 0) {
                endTimeRef.current = Date.now() + displayTime * 1000;
            }
            return;
        }
        endTimeRef.current = null;
    }, [examStarted, displayTime]);

    useEffect(() => {
        if (!examStarted) return;

        const tick = () => {
            const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
            setDisplayTime((prev) => {
                // Only update state when the value actually changes
                if (prev === remaining) return prev;
                return remaining;
            });
            if (remaining <= 0) {
                onTimeUpRef.current?.();
                return;
            }
        };

        // Use 250ms interval to catch second boundaries accurately
        // without the cost of updating state every tick
        const timer = setInterval(tick, 250);
        return () => clearInterval(timer);
    }, [examStarted]);

    const mins = Math.floor(displayTime / 60);
    const secs = displayTime % 60;
    const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    return {
        timeRemaining: displayTime,
        formattedTime,
        isLowTime: displayTime < 300,
        setTimeRemaining,
    };
}
