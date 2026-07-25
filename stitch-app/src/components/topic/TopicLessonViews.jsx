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
import { buildObjectiveExamRoute } from '../../lib/topicLessonHelpers';
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
                    className="fixed z-30 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-4 lg:bottom-6 lg:right-auto lg:left-6 btn-icon size-10 bg-surface-light dark:bg-surface-dark border border-border-subtle dark:border-border-subtle-dark shadow-card"
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
    <nav aria-label="Breadcrumb" className="font-body-sm text-body-sm text-text-secondary">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
                <Link to="/dashboard/lessons" className="hover:text-text-primary transition-colors">Lessons</Link>
            </li>
            <li aria-hidden="true" className="text-text-muted">/</li>
            <li>
                <Link to={courseHref || '/dashboard/lessons'} className="hover:text-text-primary transition-colors">
                    {courseTitle || 'Course'}
                </Link>
            </li>
            <li aria-hidden="true" className="text-text-muted">/</li>
            <li className="font-medium text-text-primary line-clamp-1">{topicTitle}</li>
        </ol>
    </nav>
);

export const TopicMetaBadges = ({ sourceLabel, topicProgress }) => {
    const completed = Boolean(topicProgress?.completedAt);
    const bestScore = Number(topicProgress?.bestScore ?? 0);
    let masteryLabel = 'In progress';
    let masteryClass = 'bg-surface-soft text-text-secondary border-border-subtle';
    let masteryIcon = 'auto_stories';
    if (completed && bestScore >= 80) {
        masteryLabel = 'Mastered';
        masteryClass = 'bg-success-soft text-success border-success/30';
        masteryIcon = 'check_circle';
    } else if (completed) {
        masteryLabel = 'Reviewing';
        masteryClass = 'bg-warning-soft text-warning border-warning/30';
        masteryIcon = 'event_repeat';
    }
    return (
        <div className="flex flex-wrap items-center gap-space-2">
            {sourceLabel ? (
                <span className="inline-flex items-center gap-space-2 rounded-full border border-border-subtle bg-surface px-space-3 py-space-1 font-label-xs text-label-xs text-text-secondary">
                    <AppIcon name="description" className="text-[16px] text-text-muted" />
                    <span>Source: {sourceLabel}</span>
                </span>
            ) : null}
            <span className={`inline-flex items-center gap-space-2 rounded-full border px-space-3 py-space-1 font-label-xs text-label-xs ${masteryClass}`}>
                <AppIcon name={masteryIcon} className="text-[16px]" />
                <span>{masteryLabel}</span>
            </span>
        </div>
    );
};

export const TopicSummaryCard = ({ description }) => {
    if (!description) return null;
    return (
        <section className="rounded-2xl border border-primary/15 bg-primary-subtle p-space-5">
            <div className="mb-space-2 flex items-center gap-space-2 text-primary">
                <AppIcon name="lightbulb" className="text-[20px]" />
                <h2 className="font-label-md text-label-md font-semibold">Topic Summary</h2>
            </div>
            <p className="font-body-md text-body-md leading-relaxed text-text-primary">{description}</p>
        </section>
    );
};

export const TopicLessonNav = ({ prevTopic, nextTopic, examTopicId }) => {
    const navigate = useNavigate();
    if (!prevTopic && !nextTopic && !examTopicId) return null;
    const goTo = (topicId) => () => navigate(`/dashboard/topic/${topicId}`);
    return (
        <div className="flex items-center justify-between gap-space-4 border-t border-border-subtle pt-space-6">
            {prevTopic ? (
                <button
                    type="button"
                    onClick={goTo(prevTopic.id || prevTopic._id)}
                    className="inline-flex items-center gap-space-2 rounded-xl border border-border-default bg-surface px-space-4 py-space-3 font-label-md text-label-md text-text-primary transition-colors hover:bg-surface-soft"
                >
                    <AppIcon name="arrow_back" className="text-[18px]" />
                    <span className="line-clamp-1 text-left">Previous Lesson</span>
                </button>
            ) : (
                <span aria-hidden="true" />
            )}
            {nextTopic ? (
                <button
                    type="button"
                    onClick={goTo(nextTopic.id || nextTopic._id)}
                    className="inline-flex items-center gap-space-2 rounded-xl bg-primary px-space-4 py-space-3 font-label-md text-label-md text-surface transition-colors hover:bg-primary-hover"
                >
                    <span className="line-clamp-1">Next Lesson</span>
                    <AppIcon name="arrow_forward" className="text-[18px]" />
                </button>
            ) : examTopicId ? (
                <Link
                    to={buildObjectiveExamRoute(examTopicId)}
                    className="inline-flex items-center gap-space-2 rounded-xl bg-primary px-space-4 py-space-3 font-label-md text-label-md text-surface transition-colors hover:bg-primary-hover"
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
        <aside className="sticky top-space-6 flex max-h-[calc(100vh-8rem)] min-h-0 flex-col gap-space-4 rounded-2xl border border-border-subtle bg-surface p-space-5 shadow-sm">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-space-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ai-soft text-ai">
                        <AppIcon name="smart_toy" className="text-[20px]" />
                    </span>
                    <div>
                        <p className="font-label-md text-label-md font-semibold text-text-primary">Study Assistant</p>
                        <p className="flex items-center gap-space-1 font-label-xs text-label-xs text-success">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" /> Online
                        </p>
                    </div>
                </div>
            </header>
            <div className="rounded-xl bg-ai-subtle p-space-4 font-body-sm text-body-sm leading-relaxed text-text-primary dark:!bg-[#212226] dark:text-text-primary">
                {`Hi! I noticed you're reading about ${topicTitle || 'this lesson'}. Ask me anything — I'll use your uploaded material to help you understand it.`}
            </div>
            {hasTranscript && (
                <div ref={transcriptRef} className="min-h-0 flex-1 space-y-space-3 overflow-y-auto rounded-xl border border-border-subtle bg-surface-soft/60 p-space-3 dark:!bg-[#111214]">
                    {visibleMessages.map((message) => {
                        const isUser = message.role === 'user';
                        return (
                            <div key={message.id || message._id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                <p className={`max-w-[92%] rounded-xl px-space-3 py-space-2 font-body-sm text-body-sm leading-relaxed ${
                                    isUser
                                        ? 'bg-primary text-on-primary'
                                        : 'border border-border-subtle bg-surface text-text-primary'
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
                                    <p className="max-w-[92%] rounded-xl bg-primary px-space-3 py-space-2 font-body-sm text-body-sm leading-relaxed text-on-primary">
                                        {pendingQuestion}
                                    </p>
                                </div>
                            )}
                            <div className="flex justify-start">
                                <p className="max-w-[92%] rounded-xl border border-border-subtle bg-surface px-space-3 py-space-2 font-label-xs text-label-xs text-text-secondary">
                                    Preparing an answer...
                                </p>
                            </div>
                        </>
                    )}
                    {error && (
                        <p className="rounded-lg border border-error/20 bg-error-soft px-space-3 py-space-2 font-body-sm text-body-sm text-error">
                            {error}
                        </p>
                    )}
                </div>
            )}
            {!hasTranscript && (
                <div className="flex flex-col gap-space-2">
                    {STUDY_ASSISTANT_PROMPTS.map((prompt) => (
                        <button
                            key={prompt}
                            type="button"
                            onClick={() => sendQuestion(prompt)}
                            disabled={sending}
                            className="rounded-full border border-border-subtle bg-surface px-space-3 py-space-2 text-left font-label-sm text-label-sm text-text-primary transition-colors hover:border-ai/40 hover:bg-ai-subtle disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-center gap-space-2 rounded-full border border-border-subtle bg-surface-soft px-space-3 py-space-2 focus-within:border-primary">
                <input
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Ask a question..."
                    disabled={sending}
                    className="flex-1 bg-transparent font-body-sm text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                />
                <button
                    type="submit"
                    aria-label="Send"
                    disabled={sending || !draft.trim()}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-surface transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
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
        resolvedTopicTitle,
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

    const courseTitle = coursePayload?.title || '';
    const courseTopics = Array.isArray(coursePayload?.topics) ? coursePayload.topics : [];
    const currentIndex = courseTopics.findIndex((entry) => String(entry.id || entry._id) === String(topicId));
    const prevTopic = currentIndex > 0 ? courseTopics[currentIndex - 1] : null;
    const nextTopic = currentIndex >= 0 && currentIndex < courseTopics.length - 1
        ? courseTopics[currentIndex + 1]
        : null;
    const sourceLabel = courseTitle;

    return (
        <div className="cp-theme min-h-screen bg-[#FAF8F3] font-body text-[#1F2933] dark:bg-[#0c0d10] dark:text-text-primary">
            <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-space-6 px-space-4 py-space-6 md:px-space-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-space-8 lg:px-space-8 lg:py-space-8">
                <div className="min-w-0 space-y-space-6">
                    <TopicLessonBreadcrumbs
                        courseTitle={courseTitle}
                        courseHref={courseHref}
                        topicTitle={resolvedTopicTitle}
                    />
                    <header className="space-y-space-3">
                        <TopicMetaBadges sourceLabel={sourceLabel} topicProgress={topicProgress} />
                        <h1 className="font-display-md text-display-md font-bold tracking-tight text-text-primary md:text-display-lg">
                            {resolvedTopicTitle}
                        </h1>
                    </header>
                    <TopicSummaryCard description={cleanedDescription} />
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
