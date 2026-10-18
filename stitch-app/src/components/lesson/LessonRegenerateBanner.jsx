import React, { useEffect, useState } from 'react';
import AppIcon from '../AppIcon';
import { GENERATION_POLL_MS, isTopicRewriting, requestTopicRegenerate } from '../../lib/courseGeneration';

const fetchTopicState = async (topicId) => {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    return payload.course ? { course: payload.course, updatedAt: payload.topic?.updatedAt ?? null } : null;
};

// Shown on a lesson whose core sections could not all be matched to the
// upload (grounding.needsReview), and while a lesson is being rewritten.
// Regenerate rewrites it in the background from its part of the file; the
// lesson reloads when the rewrite is done. A rewrite that could not be
// written leaves the lesson as it was and says so.
export default function LessonRegenerateBanner({ topic, onReload }) {
    // The lesson's updatedAt when Regenerate was pressed, or null.
    const [requested, setRequested] = useState(null);
    const [error, setError] = useState('');
    const topicId = topic?.id || topic?._id || '';
    const rewriting = requested !== null || isTopicRewriting(topicId, topic?.course);
    const needsReview = Boolean(topic?.grounding?.needsReview);

    useEffect(() => {
        if (!rewriting || !topicId) return undefined;
        let cancelled = false;
        const timer = window.setInterval(async () => {
            const state = await fetchTopicState(topicId).catch(() => null);
            if (cancelled || !state || isTopicRewriting(topicId, state.course)) return;
            const unchanged = requested !== null && state.updatedAt === requested;
            setRequested(null);
            if (unchanged) {
                setError('We couldn\u2019t rewrite this lesson this time. Try again later.');
                return;
            }
            onReload?.();
        }, GENERATION_POLL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [rewriting, requested, topicId, onReload]);

    if (!needsReview && !rewriting && !error) return null;

    const regenerate = async () => {
        setError('');
        try {
            await requestTopicRegenerate(topicId);
            setRequested(topic?.updatedAt ?? 0);
        } catch (err) {
            setError(err.message || 'Could not start rewriting this lesson.');
        }
    };

    return (
        <div role="status" aria-live="polite" className="mb-6 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-body-sm">
            {rewriting ? (
                <p className="flex items-center gap-2 text-text-primary">
                    <AppIcon name="refresh" className="text-[18px] text-warning" />
                    Rewriting this lesson from your file. It updates here when it&apos;s done.
                </p>
            ) : (
                <>
                    <p className="flex items-start gap-2 text-text-primary">
                        <AppIcon name="error" className="mt-0.5 shrink-0 text-[18px] text-warning" />
                        Parts of this lesson couldn&apos;t be matched to your file, so check them against your notes.
                    </p>
                    <button
                        type="button"
                        className="btn-secondary mt-3 inline-flex min-h-10 items-center gap-1.5 text-body-sm"
                        onClick={regenerate}
                    >
                        <AppIcon name="refresh" className="text-[16px]" />
                        Regenerate lesson
                    </button>
                    {error ? <p className="mt-2 text-caption text-error">{error}</p> : null}
                </>
            )}
        </div>
    );
}
