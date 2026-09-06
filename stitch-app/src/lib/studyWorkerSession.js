// Legacy localStorage cleanup utility.
// The tutor now persists messages in Postgres via /api/topics/:id/chat.
// This module is retained only to clean up stale Eve session data that may
// still sit in users' browsers after the migration.

const storageKey = (userId, topicId) =>
    `chewnpour-study-worker:${String(userId || 'anon')}:${String(topicId || '')}`;

export const clearStudyWorkerSession = (userId, topicId) => {
    if (typeof window === 'undefined' || !topicId) return;
    try {
        window.localStorage.removeItem(storageKey(userId, topicId));
    } catch {
        // Ignore
    }
};

// Bulk cleanup: remove all Eve session keys from localStorage.
export const clearAllStudyWorkerSessions = () => {
    if (typeof window === 'undefined') return;
    try {
        const keysToRemove = [];
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith('chewnpour-study-worker:')) {
                keysToRemove.push(key);
            }
        }
        for (const key of keysToRemove) {
            window.localStorage.removeItem(key);
        }
    } catch {
        // Ignore
    }
};
