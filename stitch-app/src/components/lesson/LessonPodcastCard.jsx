import React from 'react';
import TopicPodcastPanel from '../TopicPodcastPanel';

// One chrome layer: violet header strip with intro copy, white body for the
// actual podcast panel (which already styles itself).
const LessonPodcastCard = ({ topicId }) => {
    if (!topicId) return null;
    return (
        <section className="rounded-3xl overflow-hidden border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark shadow-soft">
            <div className="bg-gradient-to-br from-[#1c1234] via-[#2c1c4a] to-[#3a1f5e] text-white px-5 md:px-6 py-5 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/12 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>podcasts</span>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">Audio lesson</p>
                    <h3 className="text-display-sm font-semibold leading-tight mt-1">Listen to this lesson as a podcast</h3>
                    <p className="text-body-sm text-white/75 mt-1.5">
                        Generate an audio explanation you can revise while walking, commuting, or resting.
                    </p>
                </div>
            </div>
            <div className="px-5 md:px-6 py-5">
                <TopicPodcastPanel topicId={topicId} />
            </div>
        </section>
    );
};

export default LessonPodcastCard;
