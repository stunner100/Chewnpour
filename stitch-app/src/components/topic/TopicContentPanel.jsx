import React from 'react';
import TopicSidebar from '../TopicSidebar';
import LessonContentRenderer from '../LessonContentRenderer';
import GuidedStudyPath from '../GuidedStudyPath';
import LessonPodcastCard from '../lesson/LessonPodcastCard';
import TopicVoiceToolbar from './TopicVoiceToolbar';

const TopicContentPanel = ({
    cleanInline,
    cleanLine,
    contentLines,
    contentRef,
    displayBlocks,
    filteredBlocks,
    handleAskTutor,
    handleTermsStarred,
    heroTopicTitle,
    isPaused,
    isPlaying,
    isVoiceSupported,
    normalizedContent,
    openSource,
    parsed,
    pauseVoice,
    playVoice,
    podcastEnabled,
    resolvedTopicTitle,
    resumeVoice,
    shouldAnimateBlocks,
    speechText,
    stopVoice,
    topic,
    topicId,
    topicIllustrationUrl,
    topicProgress,
    voicePlaybackError,
    voiceStatus,
    wordBankTerms,
}) => (
    <>
        <TopicSidebar
            normalizedContent={normalizedContent}
            contentLines={contentLines}
            toc={parsed.toc}
            cleanLine={cleanLine}
            topic={topic}
            mobileOnly
        />

        {topicIllustrationUrl ? (
            <div className="overflow-hidden rounded-2xl border border-border-subtle dark:border-border-subtle-dark">
                <img
                    src={topicIllustrationUrl}
                    alt={`${heroTopicTitle} illustration`}
                    loading="lazy"
                    className="h-44 md:h-56 w-full object-cover"
                />
            </div>
        ) : null}

        {isVoiceSupported && speechText ? (
            <TopicVoiceToolbar
                isPaused={isPaused}
                isPlaying={isPlaying}
                pauseVoice={pauseVoice}
                playVoice={playVoice}
                resumeVoice={resumeVoice}
                speechText={speechText}
                stopVoice={stopVoice}
                voicePlaybackError={voicePlaybackError}
                voiceStatus={voiceStatus}
            />
        ) : null}

        <article className="bg-white dark:!bg-[#161719] rounded-3xl border border-border-subtle shadow-soft px-5 py-6 md:p-8" ref={contentRef}>
            {normalizedContent ? (
                <LessonContentRenderer
                    blocks={displayBlocks}
                    shouldAnimateBlocks={shouldAnimateBlocks}
                    cleanInline={cleanInline}
                    onViewSource={openSource}
                    onAskTutor={handleAskTutor}
                    quickCheckPairs={parsed.quickCheckPairs}
                    wordBankTerms={wordBankTerms}
                    topicId={topicId}
                    starredTerms={topicProgress?.termsStarred}
                    onTermsStarred={handleTermsStarred}
                />
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="size-14 rounded-2xl bg-primary-soft flex items-center justify-center mb-4 animate-pulse">
                        <span className="material-symbols-outlined text-primary text-[26px]">auto_stories</span>
                    </div>
                    <h3 className="text-body-lg font-semibold text-text-primary">Preparing your lesson</h3>
                    <p className="text-body-sm text-text-secondary mt-1 max-w-xs">
                        ChewnPour is organizing this topic into key ideas, examples, checks, and study tools.
                    </p>
                </div>
            )}
        </article>

        <details className="group bg-white dark:!bg-[#161719] rounded-3xl border border-border-subtle px-5 md:px-6">
            <summary className="flex items-center gap-3 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="size-9 rounded-xl bg-primary-soft flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>route</span>
                </span>
                <span className="flex-1 min-w-0">
                    <span className="block text-body-md font-semibold text-text-primary leading-tight">Guided study path</span>
                    <span className="block text-caption text-text-muted mt-0.5">A section-by-section walkthrough of this lesson.</span>
                </span>
                <span className="material-symbols-outlined text-[20px] text-text-muted transition-transform group-open:rotate-180">expand_more</span>
            </summary>
            <div className="pb-5 pt-1">
                <GuidedStudyPath
                    topicTitle={resolvedTopicTitle}
                    blocks={filteredBlocks}
                    onAskTutor={handleAskTutor}
                />
            </div>
        </details>

        {podcastEnabled ? (
            <div id="topic-podcast">
                <LessonPodcastCard topicId={topicId} />
            </div>
        ) : null}
    </>
);

export default TopicContentPanel;
