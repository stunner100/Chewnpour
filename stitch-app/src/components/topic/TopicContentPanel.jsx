import React from 'react';
import TopicSidebar from '../TopicSidebar';
import TopicVoiceToolbar from './TopicVoiceToolbar';
import LessonPodcastCard from '../lesson/LessonPodcastCard';
import LessonSectionStepper from '../lesson/LessonSectionStepper';
import AppIcon from '../AppIcon';

const TopicContentPanel = ({
    cleanInline,
    cleanLine,
    contentLines,
    contentRef,
    handleAskTutor,
    handleLessonStepChange,
    handleTermsStarred,
    heroTopicTitle,
    isPaused,
    isPlaying,
    isVoiceSupported,
    lessonSteps,
    normalizedContent,
    objectiveExamRoute,
    openSource,
    parsed,
    pauseVoice,
    playVoice,
    podcastEnabled = false,
    resolvedTopicTitle,
    resumeVoice,
    shouldAnimateBlocks,
    showTopicIllustration = false,
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

        {showTopicIllustration && topicIllustrationUrl ? (
            <div className="overflow-hidden rounded-xl">
                <img
                    src={topicIllustrationUrl}
                    alt={`${heroTopicTitle} illustration`}
                    loading="lazy"
                    className="h-28 w-full object-cover md:h-32"
                />
            </div>
        ) : null}

        <article className="max-w-[65ch] py-2" ref={contentRef}>
            {normalizedContent ? (
                <LessonSectionStepper
                    key={topicId || 'topic-lesson'}
                    steps={lessonSteps}
                    topicId={topicId}
                    lessonChecks={topicProgress?.lessonChecks}
                    quizHref={objectiveExamRoute}
                    quizLabel="Start topic quiz"
                    onStepChange={handleLessonStepChange}
                    cleanInline={cleanInline}
                    onViewSource={openSource}
                    onAskTutor={handleAskTutor}
                    wordBankTerms={wordBankTerms}
                    starredTerms={topicProgress?.termsStarred}
                    onTermsStarred={handleTermsStarred}
                    shouldAnimateBlocks={shouldAnimateBlocks}
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

        {podcastEnabled && topicId ? (
            <LessonPodcastCard topicId={topicId} topicTitle={resolvedTopicTitle || heroTopicTitle} />
        ) : null}
    </>
);

export default TopicContentPanel;
