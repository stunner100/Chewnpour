import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopicNotesPanel from '../TopicNotesPanel';
import TopicChatPanel from '../TopicChatPanel';
import HighlightExplainPopover from '../HighlightExplainPopover';
import MobileLessonActions from '../lesson/MobileLessonActions';
import LessonTOC from '../lesson/LessonTOC';
import StudyModeSelector from '../StudyModeSelector';
import SourcePanel from '../SourcePanel';
import TopicSettingsModal from '../TopicSettingsModal';
import TopicReExplainModal from '../TopicReExplainModal';
import TopicContentPanel from './TopicContentPanel';
import TopicQuizPanel from './TopicQuizPanel';
import { buildTopicQuizRoute } from '../../lib/topicLessonHelpers';
import { formatCourseTitle } from '../../lib/courseTitle';
import AppIcon from '../AppIcon';

export const TopicEmptyState = ({ title, description, action }) => (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-center max-w-sm px-6">
            <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">{title}</h2>
            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">{description}</p>
            {action}
        </div>
    </div>
);

export const TopicLoadingState = () => (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-center">
            <div className="animate-spin rounded-full size-10 border-2 border-border-light dark:border-border-dark border-t-primary mx-auto mb-4" />
            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Loading lesson…</p>
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
        examTopicId,
        handleLessonStepChange,
        handleTermsStarred,
        heroTopicTitle,
        isPaused,
        isPlaying,
        isTopicQuizRoute,
        isVoiceSupported,
        mainRef,
        lessonSteps,
        normalizedContent,
        objectiveExamRoute,
        openChat,
        openSource,
        parsed,
        pauseVoice,
        playVoice,
        podcastEnabled,
        postLessonPrompt,
        practiceDescription,
        practicePrimary,
        practiceSecondary,
        practiceTertiary,
        resolvedTopicTitle,
        resumeVoice,
        shouldAnimateBlocks,
        speechText,
        stopVoice,
        topic,
        topicId,
        showTopicIllustration,
        topicIllustrationUrl,
        topicProgress,
        voicePlaybackError,
        voiceStatus,
        wordBankTerms,
    } = controller;

    return (
        <main ref={mainRef} className="min-w-0 space-y-10">
            <TopicContentPanel
                cleanInline={cleanInline}
                cleanLine={cleanLine}
                contentLines={contentLines}
                contentRef={contentRef}
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
            <TopicQuizPanel
                examTopicId={examTopicId}
                isTopicQuizRoute={isTopicQuizRoute}
                openChat={openChat}
                postLessonPrompt={postLessonPrompt}
                practiceDescription={practiceDescription}
                practicePrimary={practicePrimary}
                practiceSecondary={practiceSecondary}
                practiceTertiary={practiceTertiary}
                resolvedTopicTitle={resolvedTopicTitle}
                topicId={topicId}
                topicProgress={topicProgress}
                wordBankTerms={wordBankTerms}
            />
        </main>
    );
};

export const TopicLessonPanels = ({ controller }) => {
    const {
        activeSectionId,
        chatInitialPrompt,
        chatOpen,
        clearSelection,
        closeChat,
        closeNotes,
        closeSource,
        isVoiceSupported,
        mobileActionItems,
        notesAppendText,
        notesOpen,
        openNotes,
        parsed,
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
        stopVoice,
        studyToolSecondary,
        topic,
        topicId,
        toggleVoiceMode,
        user,
        voiceModeEnabled,
        voiceSaving,
        voiceSettingsError,
        handleReExplain,
        scrollToTop,
    } = controller;
    const [tocOpen, setTocOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const toc = Array.isArray(parsed?.toc) ? parsed.toc : [];

    const barItems = [
        ...mobileActionItems.slice(0, 3),
        {
            id: 'm-toc',
            icon: 'list',
            label: 'Contents',
            onClick: () => { setMoreOpen(false); setTocOpen(true); },
        },
        {
            id: 'm-more',
            icon: moreOpen ? 'close' : 'more_horiz',
            label: 'More',
            onClick: () => { setTocOpen(false); setMoreOpen((value) => !value); },
        },
    ];

    return (
        <>
            <TopicNotesPanel
                topicId={topicId}
                open={notesOpen}
                onClose={closeNotes}
                appendText={notesAppendText}
            />

            <TopicChatPanel
                topicId={topicId}
                topicTitle={topic?.title || ''}
                open={chatOpen}
                onClose={closeChat}
                initialPrompt={chatInitialPrompt}
            />

            <SourcePanel
                open={sourceOpen}
                onClose={closeSource}
                passages={sourcePassages}
            />

            {user && !chatOpen && !notesOpen && (
                <MobileLessonActions items={barItems} />
            )}

            {tocOpen && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-[55] border-0 bg-black/40 lg:hidden"
                        aria-label="Close lesson contents"
                        onClick={() => setTocOpen(false)}
                    />
                    <div
                        role="dialog"
                        aria-label="Lesson contents"
                        className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] inset-x-0 z-[60] max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t border-border-subtle bg-surface px-4 py-4 shadow-lg lg:hidden"
                    >
                        <LessonTOC toc={toc} activeId={activeSectionId} onNavigate={() => setTocOpen(false)} />
                    </div>
                </>
            )}

            {moreOpen && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-[55] border-0 bg-black/40 lg:hidden"
                        aria-label="Close study tools"
                        onClick={() => setMoreOpen(false)}
                    />
                    <div
                        role="menu"
                        aria-label="More lesson tools"
                        className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] inset-x-0 z-[60] rounded-t-2xl border-t border-border-subtle bg-surface px-3 py-3 shadow-lg lg:hidden"
                    >
                        {mobileActionItems.slice(3).concat(studyToolSecondary).map((tool) => (
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
            )}

            {showScrollTop && !notesOpen && !chatOpen && (
                <button
                    onClick={scrollToTop}
                    className="btn-icon fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-4 z-30 size-10 border border-border-subtle bg-surface shadow-sm md:bottom-6"
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
                />
            )}

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

export const TopicLessonBreadcrumbs = ({ courseTitle, courseHref, topicTitle }) => (
    <nav aria-label="Breadcrumb" className="text-body-sm text-text-secondary">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
                <Link to="/dashboard/lessons" className="transition-colors hover:text-primary">Lessons</Link>
            </li>
            <li aria-hidden="true" className="text-text-muted">/</li>
            <li>
                <Link to={courseHref || '/dashboard/lessons'} className="transition-colors hover:text-primary">
                    {courseTitle || 'Course'}
                </Link>
            </li>
            <li aria-hidden="true" className="text-text-muted">/</li>
            <li className="line-clamp-1 font-semibold text-text-primary">{topicTitle}</li>
        </ol>
    </nav>
);

export const TopicMetaBadges = ({ topicProgress }) => {
    const completed = Boolean(topicProgress?.completedAt);
    const bestScore = Number(topicProgress?.bestScore ?? 0);
    let masteryLabel = 'In progress';
    if (completed && bestScore >= 80) masteryLabel = 'Mastered';
    else if (completed) masteryLabel = 'Reviewing';

    return (
        <p className="text-caption font-medium text-text-muted">
            {masteryLabel}
        </p>
    );
};

export const TopicSummaryCard = ({ description }) => {
    if (!description) return null;
    return (
        <p className="max-w-[68ch] text-body-md leading-relaxed text-text-secondary">
            {description}
        </p>
    );
};

export const TopicLessonNav = ({ prevTopic, nextTopic, examTopicId }) => {
    const navigate = useNavigate();
    if (!prevTopic && !nextTopic && !examTopicId) return null;
    const goTo = (topicId) => () => navigate(`/dashboard/topic/${topicId}`);
    const prevTitle = prevTopic?.title || 'Previous lesson';
    const nextTitle = nextTopic?.title || 'Next lesson';
    return (
        <div className="flex items-center justify-between gap-4 border-t border-border-subtle pt-6">
            {prevTopic ? (
                <button
                    type="button"
                    onClick={goTo(prevTopic.id || prevTopic._id)}
                    className="btn-secondary inline-flex min-h-11 max-w-[46%] items-center gap-2 text-body-sm"
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
                    className="btn-secondary inline-flex min-h-11 max-w-[46%] items-center gap-2 text-body-sm"
                >
                    <span className="line-clamp-1">{nextTitle}</span>
                    <AppIcon name="arrow_forward" className="shrink-0 text-[18px]" />
                </button>
            ) : examTopicId ? (
                <Link
                    to={buildTopicQuizRoute(examTopicId)}
                    className="btn-secondary inline-flex min-h-11 items-center gap-2 text-body-sm"
                >
                    <span>Start quiz</span>
                    <AppIcon name="arrow_forward" className="text-[18px]" />
                </Link>
            ) : (
                <span aria-hidden="true" />
            )}
        </div>
    );
};


const STUDY_ASSISTANT_PROMPTS = [
    'Explain this lesson in simpler terms',
    'Give me a real-world example',
    'Quiz me on this topic',
];

export const TopicStudyAssistantCard = ({ topicTitle, onOpenChat, onAsk }) => {
    const openTutor = () => onOpenChat?.();
    return (
        <aside className="space-y-3">
            <div className="flex items-center gap-2">
                <AppIcon name="smart_toy" className="text-[18px] text-primary" />
                <div>
                    <p className="text-body-sm font-semibold text-text-primary">AI Tutor</p>
                    <p className="text-caption text-text-muted">Ask about this lesson</p>
                </div>
            </div>
            <p className="text-caption leading-relaxed text-text-secondary">
                {`Grounded answers for ${topicTitle || 'this lesson'}.`}
            </p>
            <div className="flex flex-col gap-0.5">
                {STUDY_ASSISTANT_PROMPTS.map((prompt) => (
                    <button
                        key={prompt}
                        type="button"
                        onClick={() => (onAsk ? onAsk(prompt) : openTutor())}
                        className="rounded-lg px-2 py-1.5 text-left text-caption text-text-muted transition-colors hover:bg-surface hover:text-primary"
                    >
                        {prompt}
                    </button>
                ))}
            </div>
            <button
                type="button"
                onClick={openTutor}
                className="btn-ghost inline-flex min-h-9 w-full items-center justify-start gap-2 px-2 text-body-sm"
            >
                <AppIcon name="chat" className="text-[16px]" />
                Open AI Tutor
            </button>
        </aside>
    );
};

export const TopicLessonShell = ({ controller }) => {
    const {
        activeSectionId,
        cleanedDescription,
        courseHref,
        examTopicId,
        handleAskTutor,
        headerPrimaryAction,
        objectiveExamRoute,
        openChat,
        parsed,
        resolvedTopicTitle,
        setReExplainOpen,
        setSettingsOpen,
        topic,
        topicId,
        topicProgress,
    } = controller;

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
    const sourceLabel = courseTitle;
    const quizHref = headerPrimaryAction?.href || objectiveExamRoute;
    const quizLabel = headerPrimaryAction?.label || 'Start Quiz';
    const quizDisabled = Boolean(headerPrimaryAction?.disabled) || !quizHref;
    const toc = Array.isArray(parsed?.toc) ? parsed.toc : [];

    return (
        <div className="min-h-[calc(100dvh-4rem)] bg-background-light pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-text-primary lg:pb-0">
            <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-6 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8 lg:px-8 lg:py-8">
                <div className="min-w-0 space-y-5">
                    <TopicLessonBreadcrumbs
                        courseTitle={courseTitle}
                        courseHref={courseHref}
                        topicTitle={resolvedTopicTitle}
                    />
                    <header className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-2">
                            <TopicMetaBadges sourceLabel={sourceLabel} topicProgress={topicProgress} />
                            <h1 className="font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
                                {resolvedTopicTitle}
                            </h1>
                            <TopicSummaryCard description={cleanedDescription} />
                        </div>
                        <div className="hidden shrink-0 items-center gap-2 lg:flex">
                            <button
                                type="button"
                                onClick={() => setSettingsOpen(true)}
                                className="btn-icon size-10 border border-border-subtle bg-surface"
                                aria-label="Voice settings"
                            >
                                <AppIcon name="settings" className="text-[18px]" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setReExplainOpen(true)}
                                className="btn-secondary inline-flex min-h-10 items-center gap-1.5 text-body-sm"
                            >
                                <AppIcon name="lightbulb" className="text-[16px]" />
                                Re-explain
                            </button>
                            {quizDisabled ? (
                                <button type="button" disabled className="btn-primary inline-flex min-h-10 items-center gap-1.5 text-body-sm opacity-50">
                                    <AppIcon name="hourglass_top" className="text-[16px]" />
                                    {quizLabel}
                                </button>
                            ) : (
                                <Link to={quizHref} className="btn-primary inline-flex min-h-10 items-center gap-1.5 text-body-sm">
                                    <AppIcon name="quiz" className="text-[16px]" />
                                    {quizLabel}
                                </Link>
                            )}
                        </div>
                    </header>
                    <TopicLessonMainColumn controller={controller} />
                    <TopicLessonNav
                        prevTopic={prevTopic}
                        nextTopic={nextTopic}
                        examTopicId={examTopicId}
                    />
                </div>
                <div className="hidden lg:block">
                    <div className="sticky top-4 max-h-[calc(100dvh-6rem)] space-y-6 overflow-y-auto">
                        <LessonTOC toc={toc} activeId={activeSectionId} />
                        <TopicStudyAssistantCard
                            topicTitle={resolvedTopicTitle}
                            onOpenChat={openChat}
                            onAsk={handleAskTutor}
                        />
                    </div>
                </div>
            </div>

            <TopicLessonPanels controller={controller} />
        </div>
    );
};
