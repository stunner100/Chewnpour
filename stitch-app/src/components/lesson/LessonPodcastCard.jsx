import React from 'react';

/**
 * Podcast generation is parked during the Supabase hard cutover.
 * Keep a Convex-free placeholder so live lesson imports never pull convex/react.
 */
const LessonPodcastCard = () => (
    <div className="rounded-3xl border border-dashed border-border-subtle bg-surface-soft px-5 py-6 text-body-sm text-text-secondary">
        Podcast generation is temporarily unavailable.
    </div>
);

export default LessonPodcastCard;
