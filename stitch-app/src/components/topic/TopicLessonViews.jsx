import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopicNotesPanel from '../TopicNotesPanel';
import TopicChatPanel from '../TopicChatPanel';
import SourcePanel from '../SourcePanel';
import HighlightExplainPopover from '../HighlightExplainPopover';
import MobileLessonActions from '../lesson/MobileLessonActions';
import StudyModeSelector from '../StudyModeSelector';
import TopicSettingsModal from '../TopicSettingsModal';
import TopicReExplainModal from '../TopicReExplainModal';
import TopicContentPanel from './TopicContentPanel';
import StudyShell from '../study/StudyShell';
import StudyTopBar from '../study/StudyTopBar';
import { formatCourseTitle } from '../../lib/courseTitle';
import AppIcon from '../AppIcon';

export const TopicEmptyState = ({ title, description, action }) => (
    <div className="min-h-screen flex items-center justify-center bg-background-light">
        <div className="text-center max-w-sm px-6">
            <h2 className="text-body-lg font-semibold text-text-primary mb-2">{title}</h2>
            <p className="text-body-sm text-text-secondary mb-6">{description}</p>
            {action}
        </div>
    </div>
);

export const TopicLoadingState = () => (
    <div className="min-h-screen flex items-center justify-center bg-background-light">
        <div className="text-center">
            <div className="animate-spin rounded-full size-10 border-2 border-border-subtle border-t-primary mx-auto mb-4" />
            <p className="text-body-sm text-text-secondary">Loading lesson…</p>
        </div>
    </div>
);

export const TopicStudyModeView = ({
    headerTopicTitle,
    onSelect,
    onSkip,
    onStartExam,
    timedExamAvailable = false,
}) => (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-background-light font-body text-text-primary antialiased">
        <div className="px-4 pt-4">
            <Link
                to="/dashboard/lessons"
                aria-label="Back to lessons"
                className="inline-flex min-h-11 items-center gap-1.5 text-body-sm font-semibold text-primary hover:text-primary-hover"
            >
                <AppIcon name="arrow_back" className="text-[18px]" />
                Back to lessons
            </Link>
        </div>

        <main className="flex-1">
            <StudyModeSelector
                topicTitle={headerTopicTitle}
                onSelect={onSelect}
                onSkip={onSkip}
                onStartExam={timedExamAvailable ? onStartExam : undefined}
            />
        </main>
    </div>
);

export const TopicLessonMainColumn = ({ controller }) => {
    const {
        cleanInline,
        cleanLine,
        contentLines,
        contentRef,
        handleFinishLesson,
        handleLessonStepChange,
        handleTermsStarred,
        heroTopicTitle,
        isPaused,
        isPlaying,
        isVoiceSupported,
        mainRef,
        lessonSteps,
        normalizedContent,
        objectiveExamRoute,
        openSource,
        parsed,
        pauseVoice,
        playVoice,
        podcastEnabled,
        progressLoaded,
        resolvedTopicTitle,
        resumeVoice,
        shouldAnimateBlocks,
        showTopicIllustration,
        speechText,
        stopVoice,
        topic,
        topicId,
        topicIllustrationUrl,
        topicProgress,
        voicePlaybackError,
        voiceStatus,
        wordBankTerms,
    } = controller;

    return (
        <main ref={mainRef} className="min-w-0">
            <TopicContentPanel
                cleanInline={cleanInline}
                cleanLine={cleanLine}
                contentLines={contentLines}
                contentRef={contentRef}
                handleFinishLesson={handleFinishLesson}
                handleLessonStepChange={handleLessonStepChange}
                handleTermsStarred={handleTermsStarred}
                heroTopicTitle={heroTopicTitle}
                isPaused={isPaused}
                isPlaying={isPlaying}
                isVoiceSupported={isVoiceSupported}
                lessonSteps={lessonSteps}
                normalizedContent={normalizedContent}
                objectiveExamRoute={objectiveExamRoute}
                openSource={openSource}
                parsed={parsed}
                pauseVoice={pauseVoice}
                playVoice={playVoice}
                podcastEnabled={podcastEnabled}
                progressLoaded={progressLoaded}
                resolvedTopicTitle={resolvedTopicTitle}
                resumeVoice={resumeVoice}
                shouldAnimateBlocks={shouldAnimateBlocks}
                showTopicIllustration={showTopicIllustration}
                speechText={speechText}
                stopVoice={stopVoice}
                topic={topic}
                topicId={topicId}
                topicIllustrationUrl={topicIllustrationUrl}
                topicProgress={topicProgress}
                voicePlaybackError={voicePlaybackError}
                voiceStatus={voiceStatus}
                wordBankTerms={wordBankTerms}
            />
        </main>
    );
};

export const TopicLessonPanels = ({ controller }) => {
    const {
        chatInitialPrompt,
        chatOpen,
        clearSelection,
        closeChat,
        closeNotes,
        closeSource,
        handleSaveSelectionToNotes,
        hasQuizCta,
        hasSourcePassages,
        isVoiceSupported,
        mobileActionItems,
        notesAppendText,
        notesOpen,
        objectiveExamRoute,
        openNotes,
        playVoice,
        reExplainError,
        reExplainLoading,
        reExplainOpen,
        reExplainStyle,
        selection,
        setNotesAppendText,
        setReExplainOpen,
        setReExplainStyle,
        setSettingsOpen,
        settingsOpen,
        showScrollTop,
        sourceOpen,
        sourcePassages,
        studyContext,
        stopVoice,
        topic,
        topicId,
        topicProgress,
        toggleVoiceMode,
        user,
        voiceModeEnabled,
        voiceSaving,
        voiceSettingsError,
        handleReExplain,
        scrollToTop,
    } = controller;

    return (
        <>
            <div className="lg:hidden">
                <TopicNotesPanel
                    topicId={topicId}
                    open={notesOpen}
                    onClose={closeNotes}
                    appendText={notesAppendText}
                />
            </div>

            {hasSourcePassages ? (
                <SourcePanel
                    open={sourceOpen}
                    onClose={closeSource}
                    passages={sourcePassages}
                />
            ) : null}

            {/* Mobile tutor sheet (desktop uses the in-flow study rail) */}
            <div className="lg:hidden">
                <TopicChatPanel
                    topicId={topicId}
                    topicTitle={topic?.title || ''}
                    open={chatOpen}
                    onClose={closeChat}
                    initialPrompt={chatInitialPrompt}
                    studyContext={studyContext}
                />
            </div>

            {user && !chatOpen && !notesOpen && (
                <MobileLessonActions items={mobileActionItems} />
            )}

            {showScrollTop && !notesOpen && !chatOpen && (
                <button
                    onClick={scrollToTop}
                    className="btn-icon fixed bottom-[calc(var(--cp-mobile-lesson-bar)+env(safe-area-inset-bottom)+0.75rem+var(--keyboard-inset,0px))] left-4 z-30 size-10 border border-border-subtle bg-surface shadow-sm lg:bottom-6"
                    aria-label="Scroll to top"
                >
                    <AppIcon name="arrow_upward" className="text-[18px]" />
                </button>
            )}

            {selection && (
                <HighlightExplainPopover
                    selection={selection}
                    topicId={topicId}
                    onClose={clearSelection}
                    onCopyToNotes={(text) => {
                        setNotesAppendText(text);
                        openNotes();
                        clearSelection();
                    }}
                    onSaveSelection={(text) => {
                        handleSaveSelectionToNotes(text);
                    }}
                />
            )}

            {/* Compact quiz dock so the assessment stays one tap away while studying. */}
            {hasQuizCta && !chatOpen && !notesOpen ? (
                <div className="fixed bottom-3 right-3 z-30 md:bottom-5 md:right-5">
                    <Link
                        to={objectiveExamRoute}
                        className="btn-primary inline-flex min-h-11 items-center gap-1.5 text-body-sm shadow-elevated"
                    >
                        <AppIcon name="quiz" className="text-[16px]" />
                        {topicProgress?.bestScore != null ? 'Retry quiz' : 'Start quiz'}
                    </Link>
                </div>
            ) : null}

            <TopicSettingsModal
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                voiceModeEnabled={voiceModeEnabled}
                onToggleVoiceMode={toggleVoiceMode}
                voiceSaving={voiceSaving}
                voiceSettingsError={voiceSettingsError}
                isVoiceSupported={isVoiceSupported}
                stopVoice={stopVoice}
                playVoice={playVoice}
            />

            <TopicReExplainModal
                open={reExplainOpen}
                onClose={() => setReExplainOpen(false)}
                selectedStyle={reExplainStyle}
                onStyleChange={setReExplainStyle}
                loading={reExplainLoading}
                error={reExplainError}
                onReExplain={handleReExplain}
            />
        </>
    );
};

export const TopicLessonNav = ({ prevTopic, nextTopic }) => {
    const navigate = useNavigate();
    if (!prevTopic && !nextTopic) return null;
    const goTo = (topicId) => () => navigate(`/dashboard/topic/${topicId}`);
    const prevTitle = prevTopic?.title || 'Previous lesson';
    const nextTitle = nextTopic?.title || 'Next lesson';
    return (
        <div className="flex items-center justify-between gap-4 border-t border-border-subtle pt-6">
            {prevTopic ? (
                <button
                    type="button"
                    onClick={goTo(prevTopic.id || prevTopic._id)}
                    className="btn-ghost inline-flex min-h-11 max-w-[46%] items-center gap-2 text-body-sm"
                >
                    <AppIcon name="arrow_back" className="shrink-0 text-[18px]" />
                    <span className="line-clamp-1 text-left">{prevTitle}</span>
                </button>
            ) : (
                <span aria-hidden="true" />
            )}
            {nextTopic ? (
                <button
                    type="button"
                    onClick={goTo(nextTopic.id || nextTopic._id)}
                    className="btn-ghost inline-flex min-h-11 max-w-[46%] items-center gap-2 text-body-sm"
                >
                    <span className="line-clamp-1">{nextTitle}</span>
                    <AppIcon name="arrow_forward" className="shrink-0 text-[18px]" />
                </button>
            ) : (
                <span aria-hidden="true" />
            )}
        </div>
    );
};


export const TopicLessonShell = ({ controller }) => {
    const {
        chatInitialPrompt,
        chatOpen,
        closeChat,
        closeNotes,
        courseHref,
        currentStepIndex,
        lessonSteps,
        notesAppendText,
        notesOpen,
        openChat,
        openNotes,
        resolvedTopicTitle,
        studyContext,
        topic,
        topicId,
    } = controller;
    const [moreOpen, setMoreOpen] = useState(false);

    const [coursePayload, setCoursePayload] = useState(null);

    useEffect(() => {
        const courseId = topic?.courseId;
        if (!courseId) {
            setCoursePayload(null);
            return undefined;
        }
        let cancelled = false;
        (async () => {
            try {
                const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}`, {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload?.error || 'Failed to load course');
                if (!cancelled) setCoursePayload(payload.course || null);
            } catch {
                if (!cancelled) setCoursePayload(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [topic?.courseId]);

    const courseTitle = formatCourseTitle(coursePayload?.title) || coursePayload?.title || '';
    const courseTopics = Array.isArray(coursePayload?.topics) ? coursePayload.topics : [];
    const currentIndex = courseTopics.findIndex((entry) => String(entry.id || entry._id) === String(topicId));
    const prevTopic = currentIndex > 0 ? courseTopics[currentIndex - 1] : null;
    const nextTopic = currentIndex >= 0 && currentIndex < courseTopics.length - 1
        ? courseTopics[currentIndex + 1]
        : null;
    const sectionCount = Array.isArray(lessonSteps) ? lessonSteps.length : 0;

    return (
        <div className="mobile-lesson-safe-bottom lg:!pb-0">
            <StudyShell
                topBar={(
                    <StudyTopBar
                        courseTitle={courseTitle}
                        courseHref={courseHref}
                        topicTitle={resolvedTopicTitle}
                        sectionIndex={currentStepIndex}
                        sectionCount={sectionCount}
                        onOpenNotes={openNotes}
                        onOpenChat={openChat}
                        onOpenMore={() => setMoreOpen(true)}
                        chatOpen={chatOpen}
                        notesOpen={notesOpen}
                    />
                )}
                tutorOpen={chatOpen}
                tutor={(
                    <TopicChatPanel
                        inline
                        topicId={topicId}
                        topicTitle={topic?.title || ''}
                        open={chatOpen}
                        onClose={closeChat}
                        initialPrompt={chatInitialPrompt}
                        studyContext={studyContext}
                    />
                )}
                notesOpen={notesOpen}
                notes={(
                    <TopicNotesPanel
                        inline
                        topicId={topicId}
                        open={notesOpen}
                        onClose={closeNotes}
                        appendText={notesAppendText}
                    />
                )}
            >
                <TopicLessonMainColumn controller={controller} />
                <TopicLessonNav prevTopic={prevTopic} nextTopic={nextTopic} />
            </StudyShell>

            <TopicLessonPanels controller={controller} />

            {moreOpen ? (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-[55] border-0 bg-black/40"
                        aria-label="Close study tools"
                        onClick={() => setMoreOpen(false)}
                    />
                    <div
                        role="menu"
                        aria-label="More study tools"
                        className="fixed bottom-3 inset-x-3 z-[70] rounded-2xl border border-border-subtle bg-surface px-3 py-3 shadow-lg sm:inset-x-auto sm:right-4 sm:w-72"
                    >
                        {(controller.studyToolSecondary || []).map((tool) => (
                            <button
                                key={tool.id}
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    tool.onClick?.();
                                    setMoreOpen(false);
                                }}
                                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-body-sm font-medium text-text-primary hover:bg-surface-soft"
                            >
                                <AppIcon name={tool.icon} className="text-[20px] text-primary" />
                                {tool.label}
                            </button>
                        ))}
                    </div>
                </>
            ) : null}
        </div>
    );
};
