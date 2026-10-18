import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from './AppIcon';
import { FUNNEL_EVENTS, trackFunnelEvent } from '../lib/funnelEvents';

/**
 * Opens the student's copy of the ready-made sample course, creating it on
 * first use. Shown before the first upload and while an upload is processing.
 */
const SampleCourseCard = ({ placement, compact = false }) => {
    const navigate = useNavigate();
    const [opening, setOpening] = useState(false);
    const [error, setError] = useState('');

    const open = async () => {
        setOpening(true);
        setError('');
        try {
            const response = await fetch('/api/courses/sample', {
                method: 'POST',
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.courseId) throw new Error(payload.error || 'Could not open the sample course');
            trackFunnelEvent(FUNNEL_EVENTS.sampleCourseOpened, { placement, created: Boolean(payload.created) });
            navigate(`/dashboard/lessons?courseId=${encodeURIComponent(payload.courseId)}`);
        } catch (err) {
            setError(err.message || 'Could not open the sample course');
            setOpening(false);
        }
    };

    return (
        <div className={`flex min-w-0 flex-col gap-3 rounded-[20px] border border-border-subtle bg-surface text-left shadow-sm sm:flex-row sm:items-center sm:justify-between ${compact ? 'p-4' : 'p-5 md:p-6'}`}>
            <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                    <AppIcon name="school" className="text-[20px]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <p className="font-semibold text-text-primary">
                        {compact ? 'While you wait, try a sample lesson' : 'No file handy? Try a sample course'}
                    </p>
                    <p className="mt-0.5 text-body-sm text-text-secondary">
                        Three short lessons on how to study for exams, with quizzes.
                    </p>
                    {error && <p role="alert" className="mt-1 text-caption text-error">{error}</p>}
                </div>
            </div>
            <button
                type="button"
                onClick={open}
                disabled={opening}
                className="btn-secondary inline-flex min-h-11 shrink-0 items-center gap-2 text-body-sm disabled:opacity-60"
            >
                {opening ? 'Opening…' : 'Open sample'}
                {!opening && <AppIcon name="arrow_forward" className="text-[16px]" aria-hidden="true" />}
            </button>
        </div>
    );
};

export default SampleCourseCard;
