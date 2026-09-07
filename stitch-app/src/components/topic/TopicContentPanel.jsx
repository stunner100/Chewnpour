import React from 'react';
import TopicVoiceToolbar from './TopicVoiceToolbar';
import LessonSectionStepper from '../lesson/LessonSectionStepper';

const TopicContentPanel = ({
    cleanInline,
    contentRef,
    explanationView = 'original',
    handleAskTutor,
    handleFinishLesson,
    handleLessonStepChange,
    handleTermsStarred,
    hasReexplainedLesson = false,
    heroTopicTitle,
    isPaused,
    isPlaying,
    isVoiceSupported,
    lessonSteps,
    normalizedContent,
    objectiveExamRoute,
    pauseVoice,
    playVoice,
    progressLoaded = true,
    requestedSectionIndex = null,
    onRequestConsumed,
    resolvedTopicTitle,
    setExplanationView,
    resumeVoice,
    shouldAnimateBlocks,
    showTopicIllustration = false,
    speechText,
    stopVoice,
    topicId,
    topicIllustrationUrl,
    topicProgress,
    voicePlaybackError,
    voiceStatus,
    wordBankTerms,
}) => (
    <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
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
        </div>

        <div className="mx-auto w-full max-w-[720px]">
            {hasReexplainedLesson && setExplanationView ? (
                <div className="mb-6 inline-flex rounded-full border border-border-subtle bg-surface p-1" role="tablist" aria-label="Lesson explanation">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={explanationView !== 'simplified'}
                        onClick={() => setExplanationView('original')}
                        className={`rounded-full px-3 py-1.5 text-caption font-semibold ${
                            explanationView !== 'simplified'
                                ? 'bg-cta text-cta-foreground'
                                : 'text-text-secondary'
                        }`}
                    >
                        Original
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={explanationView === 'simplified'}
                        onClick={() => setExplanationView('simplified')}
                        className={`rounded-full px-3 py-1.5 text-caption font-semibold ${
                            explanationView === 'simplified'
                                ? 'bg-cta text-cta-foreground'
                                : 'text-text-secondary'
                        }`}
                    >
                        Simplified
                    </button>
                </div>
            ) : null}
            {normalizedContent && progressLoaded ? (
                <LessonSectionStepper
                    key={`${topicId || 'topic-lesson'}:${explanationView}`}
                    steps={lessonSteps}
                    topicId={topicId}
                    topicTitle={resolvedTopicTitle || heroTopicTitle}
                    lessonChecks={topicProgress?.lessonChecks}
                    quizHref={objectiveExamRoute}
                    quizLabel="Start quiz"
                    onStepChange={handleLessonStepChange}
                    cleanInline={cleanInline}
                    wordBankTerms={wordBankTerms}
                    starredTerms={topicProgress?.termsStarred}
                    onTermsStarred={handleTermsStarred}
                    shouldAnimateBlocks={shouldAnimateBlocks}
                    contentRef={contentRef}
                    onFinishLesson={handleFinishLesson}
                    lessonCompleted={Boolean(topicProgress?.completedAt)}
                    initialIndex={topicProgress?.studyPosition?.sectionIndex ?? 0}
                    initialFinished={Boolean(
                        topicProgress?.studyPosition?.finished && topicProgress?.completedAt
                    )}
                    onAskTutor={handleAskTutor}
                    requestedIndex={requestedSectionIndex}
                    onRequestConsumed={onRequestConsumed}
                />
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 flex size-10 animate-spin rounded-full border-2 border-border-subtle border-t-primary" />
                    <h3 className="font-display text-display-sm font-bold text-text-primary">Loading your place</h3>
                    <p className="mt-1 max-w-xs text-body-sm text-text-secondary">
                        Restoring the section you left off on.
                    </p>
                </div>
            )}
        </div>
    </div>
);

export default TopicContentPanel;
