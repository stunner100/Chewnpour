import React from 'react';
import TopicSidebar from '../TopicSidebar';
import LessonContentRenderer from '../LessonContentRenderer';
import GuidedStudyPath from '../GuidedStudyPath';
import TopicVoiceToolbar from './TopicVoiceToolbar';
import AppIcon from '../AppIcon';

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
    podcastEnabled: _podcastEnabled,
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
            <div className="overflow-hidden rounded-[24px] border border-border-subtle shadow-sm">
                <img
                    src={topicIllustrationUrl}
                    alt={`${heroTopicTitle} illustration`}
                    loading="lazy"
                    className="h-44 w-full object-cover md:h-56"
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

        <article className="rounded-[28px] border border-border-subtle bg-surface px-5 py-6 shadow-sm md:p-8" ref={contentRef}>
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
                    <div className="mb-4 flex size-14 animate-pulse items-center justify-center rounded-2xl bg-primary-subtle">
                        <AppIcon name="auto_stories" className="text-[26px] text-primary" />
                    </div>
                    <h3 className="font-display text-display-sm font-bold text-text-primary">Preparing your lesson</h3>
                    <p className="mt-1 max-w-xs text-body-sm text-text-secondary">
                        ChewnPour is organizing this topic into key ideas, examples, checks, and study tools.
                    </p>
                </div>
            )}
        </article>

        <details className="group rounded-[24px] border border-border-subtle bg-surface px-5 shadow-sm md:px-6">
            <summary className="flex cursor-pointer list-none items-center gap-3 py-4 [&::-webkit-details-marker]:hidden">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-subtle">
                    <AppIcon name="route" className="text-[18px] text-primary" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-body-md font-semibold leading-tight text-text-primary">Guided study path</span>
                    <span className="mt-0.5 block text-caption text-text-muted">A section-by-section walkthrough of this lesson.</span>
                </span>
                <AppIcon name="expand_more" className="text-[20px] text-text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="pb-5 pt-1">
                <GuidedStudyPath
                    topicTitle={resolvedTopicTitle}
                    blocks={filteredBlocks}
                    onAskTutor={handleAskTutor}
                />
            </div>
        </details>
    </>
);

export default TopicContentPanel;
