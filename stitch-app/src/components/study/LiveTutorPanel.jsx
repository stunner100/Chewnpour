import React, { useEffect, useRef } from 'react';
import AppIcon from '../AppIcon';
import LiveTutorOrb from './LiveTutorOrb';
import useGeminiLiveTutor from '../../hooks/useGeminiLiveTutor';

const liveStatusLabel = (status) => {
    switch (status) {
        case 'idle':
            return 'Ready when you are';
        case 'connecting':
            return 'Connecting…';
        case 'listening':
            return 'Listening…';
        case 'speaking':
            return 'Asking a question…';
        case 'error':
            return 'Could not start';
        default: {
            const _exhaustive = status;
            return _exhaustive;
        }
    }
};

const TranscriptLine = ({ role, text, live = false }) => (
    <li
        className="text-body-sm leading-6 text-text-primary"
        {...(live ? { 'data-live-caption': '', 'aria-live': 'polite' } : {})}
    >
        <span className="font-semibold text-text-muted">
            {role === 'user' ? 'You' : 'Tutor'}
        </span>
        {' '}
        {text}
    </li>
);

const LiveTutorPanel = ({ topicId }) => {
    const { status, error, transcript, liveCaption, voiceLevelRef, start, stop } = useGeminiLiveTutor({
        topicId,
    });
    const historyRef = useRef(null);
    const sessionActive = status === 'connecting' || status === 'listening' || status === 'speaking';

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
                Talk through a few questions about this lesson before the written quiz.
            </p>

            <div className="mt-4">
                <LiveTutorOrb status={status} levelRef={voiceLevelRef} />
                <p className="mt-2 text-center text-caption text-text-muted" aria-live="polite">
                    {liveStatusLabel(status)}
                </p>
            </div>

            {error ? (
                <p className="mt-3 text-caption text-rose-500">{error}</p>
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

            <div className="mt-4 flex flex-wrap items-center gap-2">
                {sessionActive ? (
                    <button
                        type="button"
                        className="btn-secondary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                        onClick={() => void stop()}
                    >
                        <AppIcon name="stop" className="text-[16px]" />
                        End review
                    </button>
                ) : (
                    <button
                        type="button"
                        className="btn-primary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                        disabled={status === 'connecting'}
                        onClick={() => void start()}
                    >
                        <AppIcon name="record_voice_over" className="text-[16px]" />
                        Start oral review
                    </button>
                )}
            </div>
        </section>
    );
};

export default LiveTutorPanel;
