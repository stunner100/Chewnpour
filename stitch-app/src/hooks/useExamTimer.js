import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Exam timer hook that only triggers a state update when the displayed
 * minute:second value changes, rather than every second via setInterval.
 *
 * Returns { timeRemaining, formattedTime, isLowTime, setTimeRemaining }.
 */
export function useExamTimer(durationSeconds, examStarted, onTimeUp) {
  const [displayTime, setDisplayTime] = useState(0);
  const endTimeRef = useRef(null);
  const onTimeUpRef = useRef(onTimeUp);
  const timeUpFiredRef = useRef(false);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  const setTimeRemaining = useCallback((nextSeconds) => {
    const safeSeconds = Math.max(0, Math.round(Number(nextSeconds) || 0));
    endTimeRef.current = Date.now() + safeSeconds * 1000;
    timeUpFiredRef.current = false;
    setDisplayTime(safeSeconds);
  }, []);

  useEffect(() => {
    if (!examStarted) {
      endTimeRef.current = null;
      timeUpFiredRef.current = false;
      return undefined;
    }

    const safeSeconds = Math.max(0, Math.round(Number(durationSeconds) || 0));
    if (!Number.isFinite(endTimeRef.current) || endTimeRef.current <= 0) {
      endTimeRef.current = Date.now() + safeSeconds * 1000;
      timeUpFiredRef.current = false;
    }

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((endTimeRef.current - Date.now()) / 1000),
      );
      setDisplayTime((prev) => (prev === remaining ? prev : remaining));
      if (remaining <= 0 && !timeUpFiredRef.current) {
        timeUpFiredRef.current = true;
        onTimeUpRef.current?.();
      }
    };

    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [examStarted, durationSeconds]);

  const shownTime = examStarted
    ? displayTime
    : Math.max(0, Math.round(Number(durationSeconds) || 0));
  const mins = Math.floor(shownTime / 60);
  const secs = shownTime % 60;
  const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return {
    timeRemaining: shownTime,
    formattedTime,
    isLowTime: shownTime < 300 && shownTime > 0,
    setTimeRemaining,
  };
}
