import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../AppIcon';
import LiveTutorOrb from './LiveTutorOrb';
import useGeminiLiveTutor from '../../hooks/useGeminiLiveTutor';
import { questionProgress } from '@/lib/liveTutorCaptions';

const DEFAULT_QUESTION_TARGET = 5;

const liveStatusLabel = (status) => {
    switch (status) {
        case 'idle':
            return 'Ready when you are';
        case 'connecting':
            return 'Connecting…';
        case 'listening':
            return 'Listening for your answer…';
        case 'speaking':
            return 'Tutor is speaking…';
        case 'ended':
            return 'Review complete';
        case 'error':
            return 'Could not start';
        default: {
            const _exhaustive = status;
            return _exhaustive;
        }
    }
};

const TranscriptLine = ({ role, text, live = false }) => {
    const isUser = role === 'user';
    return (
        <li
            className={`flex flex-col gap-0.5 rounded-xl px-3 py-2 text-body-sm leading-6 ${
                isUser
                    ? 'ml-6 bg-surface-variant text-text-primary'
                    : 'mr-6 border border-border-subtle bg-surface text-text-primary'
            } ${live ? 'opacity-80' : ''}`}
            {...(live ? { 'data-live-caption': '', 'aria-live': 'polite' } : {})}
        >
            <span className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                {isUser ? 'You' : 'Tutor'}
            </span>
            <span>{text}</span>
        </li>
    );
};

const LiveTutorPanel = ({ topicId, quizHref, onStartQuiz }) => {
    const {
        status,
        error,
        micBlocked,
        transcript,
        liveCaption,
        questionTarget,
        endedSummary,
        confirmingEnd,
        voiceLevelRef,
        start,
        requestEnd,
        confirmEnd,
        cancelEnd,
        loadSavedReview,
    } = useGeminiLiveTutor({ topicId });
    const historyRef = useRef(null);
    const sessionActive = status === 'connecting' || status === 'listening' || status === 'speaking';
    const [savedReview, setSavedReview] = useState(null);
    const [showSaved, setShowSaved] = useState(false);

    const target = questionTarget || DEFAULT_QUESTION_TARGET;
    const progress = useMemo(
        () => questionProgress(transcript, sessionActive || status === 'ended' ? target : 0),
        [transcript, sessionActive, status, target],
    );

    // Reload the saved review whenever a session starts or ends.
    useEffect(() => {
        setSavedReview(loadSavedReview());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    useEffect(() => {
        const node = historyRef.current;
        if (!node) return;
        node.scrollTop = node.scrollHeight;
    }, [transcript, liveCaption]);

    return (
        <section
            className="mx-auto mt-8 max-w-md rounded-2xl border border-border-subtle bg-surface p-4 text-left shadow-sm"
            aria-label="Live oral review"
        >
            <p className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                Live oral review
            </p>
            <p className="mt-1 text-body-sm text-text-secondary">
                Talk through {target} spoken questions about this lesson before the written quiz.
            </p>

            <div className="mt-4">
                <LiveTutorOrb status={status} levelRef={voiceLevelRef} />
                <p className="mt-2 text-center text-caption text-text-muted" aria-live="polite">
                    {liveStatusLabel(status)}
                </p>
                {progress && (sessionActive || status === 'ended') ? (
                    <p
                        className="mt-1 text-center text-caption font-semibold text-text-secondary"
                        data-question-progress=""
                    >
                        Question {progress.current} of {progress.total}
                    </p>
                ) : null}
            </div>

            {error ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-error-soft px-3 py-2" role="alert">
                    <AppIcon
                        name={micBlocked ? 'biotech' : 'error'}
                        className="mt-0.5 shrink-0 text-[16px] text-error"
                    />
                    <p className="text-caption text-error">{error}</p>
                </div>
            ) : null}

            {transcript.length > 0 || liveCaption ? (
                <ol
                    ref={historyRef}
                    className="mt-4 max-h-48 space-y-2 overflow-y-auto text-left"
                >
                    {transcript.map((entry) => (
                        <TranscriptLine key={entry.id} role={entry.role} text={entry.text} />
                    ))}
                    {liveCaption ? (
                        <TranscriptLine key="live-tutor" role="assistant" text={liveCaption} live />
                    ) : null}
                </ol>
            ) : null}

            {status === 'ended' && endedSummary ? (
                <div
                    className="mt-4 rounded-xl border border-success/30 bg-success-soft px-4 py-3"
                    data-review-summary=""
                >
                    <p className="text-body-sm font-semibold text-text-primary">
                        {endedSummary.outcome === 'completed'
                            ? 'Oral review complete — nice work.'
                            : `Review ended after ${endedSummary.answered} answer${endedSummary.answered === 1 ? '' : 's'}.`}
                    </p>
                    <p className="mt-1 text-caption text-text-secondary">
                        {endedSummary.outcome === 'completed'
                            ? 'Your conversation is saved below. Ready for the written quiz?'
                            : 'Your conversation so far is saved. Restart anytime, or head to the quiz.'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {quizHref ? (
                            <a
                                href={quizHref}
                                className="btn-primary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                                onClick={() => onStartQuiz?.()}
                            >
                                <AppIcon name="quiz" className="text-[16px]" />
                                Start quiz
                            </a>
                        ) : null}
                        <button
                            type="button"
                            className="btn-secondary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                            onClick={() => void start()}
                        >
                            <AppIcon name="refresh" className="text-[16px]" />
                            Restart review
                        </button>
                    </div>
                </div>
            ) : null}

            {confirmingEnd ? (
                <div
                    className="mt-4 rounded-xl border border-border-subtle bg-surface-variant px-4 py-3"
                    role="alertdialog"
                    aria-label="End review confirmation"
                >
                    <p className="text-body-sm font-semibold text-text-primary">
                        End the review early?
                    </p>
                    <p className="mt-1 text-caption text-text-secondary">
                        Your conversation so far will be saved.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            className="btn-secondary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                            onClick={cancelEnd}
                        >
                            Keep going
                        </button>
                        <button
                            type="button"
                            className="btn-primary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                            onClick={confirmEnd}
                        >
                            <AppIcon name="stop" className="text-[16px]" />
                            End review
                        </button>
                    </div>
                </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
                {sessionActive ? (
                    confirmingEnd ? null : (
                        <button
                            type="button"
                            className="btn-secondary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                            onClick={requestEnd}
                        >
                            <AppIcon name="stop" className="text-[16px]" />
                            End review
                        </button>
                    )
                ) : status === 'error' ? (
                    <button
                        type="button"
                        className="btn-primary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                        onClick={() => void start()}
                    >
                        <AppIcon name="refresh" className="text-[16px]" />
                        {micBlocked ? 'Try again after enabling the mic' : 'Try again'}
                    </button>
                ) : status !== 'ended' ? (
                    <button
                        type="button"
                        className="btn-primary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                        onClick={() => void start()}
                    >
                        <AppIcon name="record_voice_over" className="text-[16px]" />
                        Start oral review
                    </button>
                ) : null}
            </div>
            {!sessionActive && savedReview && transcript.length === 0 ? (
                <div className="mt-4 border-t border-border-subtle pt-3">
                    <button
                        type="button"
                        className="flex items-center gap-1.5 text-caption font-semibold text-text-secondary"
                        onClick={() => setShowSaved((value) => !value)}
                        aria-expanded={showSaved}
                    >
                        <AppIcon name={showSaved ? 'expand_less' : 'expand_more'} className="text-[16px]" />
                        {showSaved ? 'Hide last review' : 'Show last review'}
                    </button>
                    {showSaved ? (
                        <ol
                            className="mt-3 max-h-48 space-y-2 overflow-y-auto text-left"
                            data-saved-review=""
                        >
                            {savedReview.entries.map((entry, index) => (
                                <TranscriptLine key={`saved-${index}`} role={entry.role} text={entry.text} />
                            ))}
                        </ol>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
};

export default LiveTutorPanel;
