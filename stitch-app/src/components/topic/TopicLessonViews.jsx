import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopicSidebar from '../TopicSidebar';
import TopicNotesPanel from '../TopicNotesPanel';
import TopicChatPanel from '../TopicChatPanel';
import HighlightExplainPopover from '../HighlightExplainPopover';
import MobileLessonActions from '../lesson/MobileLessonActions';
import FloatingStudyTools from '../lesson/FloatingStudyTools';
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
    courseId,
    headerTopicTitle,
    onSelect,
    onSkip,
    onStartExam,
    timedExamAvailable = false,
}) => (
    <div className="bg-background-light dark:bg-background-dark font-body antialiased text-text-main-light dark:text-text-main-dark min-h-screen flex flex-col overflow-x-hidden">
        <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl border-b border-border-light dark:border-border-dark">
            <div className="flex items-center gap-2 min-w-0">
                <Link
                    to={courseId ? `/dashboard/course/${courseId}` : '/dashboard'}
                    aria-label="Go back"
                    className="btn-icon size-8 shrink-0"
                >
                    <AppIcon name="arrow_back" className="text-[18px]" />
                </Link>
                <span className="text-body-sm font-medium text-text-sub-light dark:text-text-sub-dark truncate max-w-[200px] sm:max-w-sm">
                    {headerTopicTitle}
                </span>
            </div>
        </header>

        <main className="flex-1 pt-14">
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
        displayBlocks,
        examTopicId,
        filteredBlocks,
        handleAskTutor,
        handleTermsStarred,
        heroTopicTitle,
        isPaused,
        isPlaying,
        isTopicQuizRoute,
        isVoiceSupported,
        mainRef,
        normalizedContent,
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
        topicIllustrationUrl,
        topicProgress,
        voicePlaybackError,
        voiceStatus,
        wordBankTerms,
    } = controller;

    return (
        <main ref={mainRef} className="min-w-0 space-y-6">
            <TopicContentPanel
                cleanInline={cleanInline}
                cleanLine={cleanLine}
                contentLines={contentLines}
                contentRef={contentRef}
                displayBlocks={displayBlocks}
                filteredBlocks={filteredBlocks}
                handleAskTutor={handleAskTutor}
                handleTermsStarred={handleTermsStarred}
                heroTopicTitle={heroTopicTitle}
                isPaused={isPaused}
                isPlaying={isPlaying}
                isVoiceSupported={isVoiceSupported}
                normalizedContent={normalizedContent}
                openSource={openSource}
                parsed={parsed}
                pauseVoice={pauseVoice}
                playVoice={playVoice}
                podcastEnabled={podcastEnabled}
                resolvedTopicTitle={resolvedTopicTitle}
                resumeVoice={resumeVoice}
                shouldAnimateBlocks={shouldAnimateBlocks}
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
                <MobileLessonActions items={mobileActionItems} />
            )}

            <FloatingStudyTools
                hidden={chatOpen || notesOpen}
                tools={studyToolSecondary.map((tool) => ({ ...tool }))}
            />

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

export const TopicMetaBadges = ({ sourceLabel, topicProgress }) => {
    const completed = Boolean(topicProgress?.completedAt);
    const bestScore = Number(topicProgress?.bestScore ?? 0);
    let masteryLabel = 'In progress';
    if (completed && bestScore >= 80) masteryLabel = 'Mastered';
    else if (completed) masteryLabel = 'Reviewing';

    const parts = [sourceLabel || null, masteryLabel].filter(Boolean);
    if (parts.length === 0) return null;

    return (
        <p className="text-caption font-medium text-text-muted">
            {parts.join(' · ')}
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
                    className="btn-primary inline-flex min-h-11 max-w-[46%] items-center gap-2 text-body-sm"
                >
                    <span className="line-clamp-1">{nextTitle}</span>
                    <AppIcon name="arrow_forward" className="shrink-0 text-[18px]" />
                </button>
            ) : examTopicId ? (
                <Link
                    to={buildTopicQuizRoute(examTopicId)}
                    className="btn-primary inline-flex min-h-11 items-center gap-2 text-body-sm"
                >
                    <span>Take the quiz</span>
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

export const TopicStudyAssistantCard = ({ topicId, topicTitle }) => {
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [pendingExchange, setPendingExchange] = useState(null);
    const [messages, setMessages] = useState([]);
    const transcriptRef = useRef(null);
    const messageList = Array.isArray(messages) ? messages : [];
    const visibleMessages = messageList.slice(-4);
    const latestMessageId = messageList.at(-1)?.id || messageList.at(-1)?._id || '';
    const pendingQuestion = pendingExchange?.question || '';
    const hasSavedPendingQuestion = pendingExchange
        ? messageList.filter((message) =>
            message.role === 'user'
            && String(message.content || '').trim() === pendingExchange.question
        ).length > pendingExchange.baselineQuestionCount
        : false;
    const shouldShowPendingQuestion = Boolean(pendingQuestion) && !hasSavedPendingQuestion;
    const hasTranscript = visibleMessages.length > 0 || shouldShowPendingQuestion || sending || Boolean(error);

    useEffect(() => {
        if (!topicId) {
            setMessages([]);
            return undefined;
        }
        let cancelled = false;
        (async () => {
            try {
                const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/chat`, {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload?.error || 'Failed to load chat');
                if (!cancelled) setMessages(Array.isArray(payload.messages) ? payload.messages : []);
            } catch {
                if (!cancelled) setMessages([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [topicId]);

    useEffect(() => {
        if (!hasTranscript || !transcriptRef.current) return undefined;
        const frame = requestAnimationFrame(() => {
            const transcript = transcriptRef.current;
            if (!transcript) return;
            transcript.scrollTo({
                top: transcript.scrollHeight,
                behavior: 'smooth',
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [hasTranscript, pendingQuestion, sending, visibleMessages.length, latestMessageId]);

    const sendQuestion = async (rawQuestion) => {
        const question = String(rawQuestion || '').trim();
        if (!question || !topicId || sending) return;
        const baselineQuestionCount = messageList.filter((message) =>
            message.role === 'user'
            && String(message.content || '').trim() === question
        ).length;
        setDraft('');
        setSending(true);
        setError('');
        setPendingExchange({ question, baselineQuestionCount });
        try {
            const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/chat`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload?.error || 'Could not get a response.');
            setMessages(Array.isArray(payload.messages) ? payload.messages : []);
        } catch (err) {
            setDraft(question);
            setError(err?.message || 'Could not get a response. Please try again.');
        } finally {
            setPendingExchange(null);
            setSending(false);
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        sendQuestion(draft);
    };

    return (
        <aside className="sticky top-6 flex max-h-[calc(100vh-8rem)] min-h-0 flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-soft/60 p-4">
            <header className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                    <AppIcon name="smart_toy" className="text-[18px]" />
                </span>
                <div>
                    <p className="text-body-sm font-semibold text-text-primary">Study Assistant</p>
                    <p className="text-caption text-text-muted">Ask about this lesson</p>
                </div>
            </header>
            {!hasTranscript && (
                <p className="text-body-sm leading-relaxed text-text-secondary">
                    {`Ask anything about ${topicTitle || 'this lesson'} — answers stay grounded in your material.`}
                </p>
            )}
            {hasTranscript && (
                <div ref={transcriptRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto py-1">
                    {visibleMessages.map((message) => {
                        const isUser = message.role === 'user';
                        return (
                            <div key={message.id || message._id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                <p className={`max-w-[92%] rounded-2xl px-3 py-2 text-body-sm leading-relaxed ${
                                    isUser
                                        ? 'bg-primary text-on-primary'
                                        : 'bg-surface text-text-primary'
                                }`}>
                                    {message.content}
                                </p>
                            </div>
                        );
                    })}
                    {(shouldShowPendingQuestion || sending) && (
                        <>
                            {shouldShowPendingQuestion && (
                                <div className="flex justify-end">
                                    <p className="max-w-[92%] rounded-2xl bg-primary px-3 py-2 text-body-sm leading-relaxed text-on-primary">
                                        {pendingQuestion}
                                    </p>
                                </div>
                            )}
                            <div className="flex justify-start">
                                <p className="max-w-[92%] rounded-2xl bg-surface px-3 py-2 text-caption text-text-secondary">
                                    Preparing an answer...
                                </p>
                            </div>
                        </>
                    )}
                    {error && (
                        <p className="rounded-2xl border border-error/20 bg-error-soft px-3 py-2 text-body-sm text-error">
                            {error}
                        </p>
                    )}
                </div>
            )}
            {!hasTranscript && (
                <div className="flex flex-col gap-1">
                    {STUDY_ASSISTANT_PROMPTS.map((prompt) => (
                        <button
                            key={prompt}
                            type="button"
                            onClick={() => sendQuestion(prompt)}
                            disabled={sending}
                            className="rounded-lg px-2 py-2 text-left text-caption font-medium text-text-secondary transition-colors hover:bg-surface hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-2xl border border-border-subtle bg-surface px-3 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-soft">
                <input
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Ask a question..."
                    disabled={sending}
                    className="flex-1 bg-transparent text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                />
                <button
                    type="submit"
                    aria-label="Send"
                    disabled={sending || !draft.trim()}
                    className="flex size-8 items-center justify-center rounded-full bg-cta text-cta-foreground transition-colors hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <AppIcon name="send" className="text-[18px]" />
                </button>
            </form>
        </aside>
    );
};

export const TopicLessonShell = ({ controller }) => {
    const {
        cleanedDescription,
        courseHref,
        examTopicId,
        headerPrimaryAction,
        objectiveExamRoute,
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

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background-light pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-text-primary lg:pb-0">
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
                    <TopicStudyAssistantCard
                        topicId={topicId}
                        topicTitle={resolvedTopicTitle}
                    />
                </div>
            </div>

            <TopicLessonPanels controller={controller} />
        </div>
    );
};
