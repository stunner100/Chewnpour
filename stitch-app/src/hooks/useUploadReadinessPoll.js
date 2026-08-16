import { useEffect, useRef } from 'react';
import { watermelonToast } from '../components/watermelon/watermelonToast';
import {
  UPLOAD_READINESS_POLL_MS,
  findNewlyStudyReadyUploads,
  listNeedsReadinessPoll,
} from '../lib/uploadReadiness';

/**
 * Poll while any upload is non-terminal or not study-ready.
 * @param {object} options
 * @param {() => Promise<{uploads?: array, courses?: array}|void>} options.refresh
 * @param {array} options.uploads
 * @param {array} [options.courses]
 * @param {boolean} [options.enabled]
 * @param {number} [options.intervalMs]
 * @param {(readyItems: array) => void} [options.onNewlyReady]
 */
export function useUploadReadinessPoll({
  refresh,
  uploads = [],
  courses = [],
  enabled = true,
  intervalMs = UPLOAD_READINESS_POLL_MS,
  onNewlyReady,
} = {}) {
  const snapshotRef = useRef({ uploads: [], courses: [] });
  const refreshRef = useRef(refresh);
  const onNewlyReadyRef = useRef(onNewlyReady);
  const shouldPoll = enabled && listNeedsReadinessPoll(uploads, courses);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    onNewlyReadyRef.current = onNewlyReady;
  }, [onNewlyReady]);

  // Seed snapshot from the latest known lists without treating them as a transition.
  useEffect(() => {
    snapshotRef.current = { uploads, courses };
  }, [uploads, courses]);

  useEffect(() => {
    if (!shouldPoll || typeof refreshRef.current !== 'function') return undefined;

    const timer = window.setInterval(() => {
      void (async () => {
        const previous = snapshotRef.current;
        const result = await refreshRef.current?.({ silent: true });
        if (!result) return;
        const nextUploads = Array.isArray(result.uploads) ? result.uploads : previous.uploads;
        const nextCourses = Array.isArray(result.courses) ? result.courses : previous.courses;
        const newlyReady = findNewlyStudyReadyUploads({
          previousUploads: previous.uploads,
          nextUploads,
          previousCourses: previous.courses,
          nextCourses,
        });
        snapshotRef.current = { uploads: nextUploads, courses: nextCourses };
        if (newlyReady.length === 0) return;
        if (typeof onNewlyReadyRef.current === 'function') {
          onNewlyReadyRef.current(newlyReady);
          return;
        }
        const first = newlyReady[0];
        watermelonToast(`${first.title} is ready to study`, {
          type: 'success',
          duration: 8000,
          action: {
            label: 'Open lessons',
            onClick: () => {
              if (typeof window !== 'undefined' && first.lessonsHref) {
                window.location.assign(first.lessonsHref);
              }
            },
          },
        });
      })();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [shouldPoll, intervalMs]);
}
