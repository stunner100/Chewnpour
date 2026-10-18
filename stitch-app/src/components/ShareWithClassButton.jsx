import React, { useState } from 'react';
import AppIcon from './AppIcon';
import { FUNNEL_EVENTS, trackFunnelEvent } from '../lib/funnelEvents';

/**
 * Turns on the course's read-only share link and hands it to the phone's
 * share sheet (WhatsApp, Telegram…), or copies it where there is none.
 */
const ShareWithClassButton = ({ courseId, courseTitle, placement }) => {
    const [state, setState] = useState('idle'); // idle | busy | copied
    const [error, setError] = useState('');

    if (!courseId) return null;

    const share = async () => {
        setState('busy');
        setError('');
        try {
            const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}/share`, {
                method: 'POST',
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.course?.shareUrl) throw new Error(payload.error || 'Could not create a share link');
            const url = `${window.location.origin}${payload.course.shareUrl}`;
            const text = `I'm studying ${courseTitle || 'this course'} on ChewnPour. Here are the lessons:`;
            trackFunnelEvent(FUNNEL_EVENTS.courseShared, { placement });
            if (typeof navigator.share === 'function') {
                try {
                    await navigator.share({ title: courseTitle || 'ChewnPour course', text, url });
                    setState('idle');
                    return;
                } catch (shareError) {
                    if (shareError?.name === 'AbortError') {
                        setState('idle');
                        return;
                    }
                }
            }
            await navigator.clipboard.writeText(`${text} ${url}`);
            setState('copied');
            window.setTimeout(() => setState('idle'), 2000);
        } catch (err) {
            setError(err.message || 'Could not share the course');
            setState('idle');
        }
    };

    return (
        <div className="flex flex-col items-center">
            <button
                type="button"
                onClick={share}
                disabled={state === 'busy'}
                className="btn-secondary inline-flex min-h-11 items-center gap-2 text-body-sm disabled:opacity-60"
            >
                <AppIcon name="share" className="text-[16px]" aria-hidden="true" />
                {state === 'copied' ? 'Link copied' : state === 'busy' ? 'Creating link…' : 'Share with your class'}
            </button>
            {error && <p role="alert" className="mt-1 text-caption text-error">{error}</p>}
        </div>
    );
};

export default ShareWithClassButton;
