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
    // Failed flush retries, stored per user to avoid cross-user leakage.
    const pendingMinutesByUserRef = useRef(new Map());
    // Timestamp when the current "visible" interval began (null → paused).
    const intervalStartRef = useRef(null);
    const userIdRef = useRef(userId || '');

    const getPendingMinutesForUser = useCallback((uid) => {
        if (!uid) return 0;
        const value = pendingMinutesByUserRef.current.get(uid);
        return Number.isFinite(value) ? Math.max(0, value) : 0;
    }, []);

    const setPendingMinutesForUser = useCallback((uid, minutes) => {
        if (!uid) return;
        const normalizedMinutes = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
        if (normalizedMinutes <= 0) {
            pendingMinutesByUserRef.current.delete(uid);
            return;
        }
        pendingMinutesByUserRef.current.set(uid, normalizedMinutes);
    }, []);

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
    const flushForUser = useCallback((uid) => {
        markElapsed();
        const normalizedUserId = typeof uid === 'string' ? uid.trim() : '';
        if (!normalizedUserId) return;

        const minutes = accMinutesRef.current + getPendingMinutesForUser(normalizedUserId);
        if (minutes >= MIN_FLUSH_MINUTES) {
            accMinutesRef.current = 0;
            setPendingMinutesForUser(normalizedUserId, 0);
            // Fire-and-forget; don't await — avoids blocking unmount.
            addStudyTime({ userId: normalizedUserId, minutes }).catch(() => {
                // Retry failed minutes for the same user only.
                const currentPending = getPendingMinutesForUser(normalizedUserId);
                setPendingMinutesForUser(normalizedUserId, currentPending + minutes);
            });
        }
    }, [addStudyTime, getPendingMinutesForUser, markElapsed, setPendingMinutesForUser]);

    const flush = useCallback(() => {
        flushForUser(userIdRef.current);
    }, [flushForUser]);

    useEffect(() => {
        userIdRef.current = userId || '';
    }, [userId]);

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
