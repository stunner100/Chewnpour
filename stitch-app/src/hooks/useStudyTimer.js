import { useEffect, useRef, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

/**
 * Tracks time spent on a page and periodically flushes it to the backend.
 *
 * - Starts counting when the component mounts and is visible.
 * - Pauses when the tab is hidden (visibility API).
 * - Flushes accumulated minutes on unmount and every FLUSH_INTERVAL_MS.
 * - Only flushes if at least MIN_FLUSH_MINUTES have been accumulated.
 *
 * @param {string|null|undefined} userId — skip tracking if falsy.
 */
const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // flush every 5 min
const MIN_FLUSH_MINUTES = 0.25;           // ignore < 15 s

export function useStudyTimer(userId) {
    const addStudyTime = useMutation(api.profiles.addStudyTime);

    // Accumulated minutes not yet flushed.
    const accMinutesRef = useRef(0);
    // Timestamp when the current "visible" interval began (null → paused).
    const intervalStartRef = useRef(null);
    const userIdRef = useRef(userId);
    userIdRef.current = userId;

    // Collect elapsed time since last mark.
    const markElapsed = useCallback(() => {
        if (intervalStartRef.current !== null) {
            const now = Date.now();
            const elapsedMin = (now - intervalStartRef.current) / 60_000;
            accMinutesRef.current += elapsedMin;
            intervalStartRef.current = now; // reset for next interval
        }
    }, []);

    // Flush accumulated minutes to the backend.
    const flush = useCallback(() => {
        markElapsed();
        const minutes = accMinutesRef.current;
        const uid = userIdRef.current;
        if (minutes >= MIN_FLUSH_MINUTES && uid) {
            accMinutesRef.current = 0;
            // Fire-and-forget; don't await — avoids blocking unmount.
            addStudyTime({ userId: uid, minutes }).catch(() => {
                // If the flush fails, add it back so the next flush retries.
                accMinutesRef.current += minutes;
            });
        }
    }, [addStudyTime, markElapsed]);

    useEffect(() => {
        if (!userId) return;

        // Start tracking.
        intervalStartRef.current = Date.now();

        // Pause/resume on visibility change.
        const onVisibility = () => {
            if (document.hidden) {
                markElapsed();
                intervalStartRef.current = null; // pause
            } else {
                intervalStartRef.current = Date.now(); // resume
            }
        };

        // Periodic flush.
        const timer = setInterval(flush, FLUSH_INTERVAL_MS);

        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            clearInterval(timer);
            flush(); // final flush on unmount
        };
    }, [userId, markElapsed, flush]);
}
