import React from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../AppIcon';
import StudyProgress from './StudyProgress';

/**
 * Quiet study-mode top bar. Replaces the global dashboard chrome while a
 * learner is inside a lesson: course exit on the left, lesson progress in the
 * center, study tools (notes / AI tutor / more) on the right.
 */
const StudyTopBar = ({
    courseTitle,
    courseHref,
    topicTitle,
    sectionIndex,
    sectionCount,
    percent,
    onOpenNotes,
    onOpenChat,
    onOpenMore,
    chatOpen = false,
    notesOpen = false,
}) => (
    <div className="sticky top-0 z-40 border-b border-border-subtle bg-background-light/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-2 px-4 md:gap-4 md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <Link
                    to={courseHref || '/dashboard/lessons'}
                    aria-label={courseTitle ? `Back to ${courseTitle}` : 'Back to lessons'}
                    className="btn-icon size-9 shrink-0 border border-border-subtle bg-surface"
                >
                    <AppIcon name="arrow_back" className="text-[16px]" />
                </Link>
                <div className="hidden min-w-0 sm:block">
                    <p className="line-clamp-1 text-caption font-medium text-text-muted">
                        {courseTitle || 'Lessons'}
                    </p>
                    <p className="line-clamp-1 text-body-sm font-semibold text-text-primary">
                        {topicTitle}
                    </p>
                </div>
            </div>

            <StudyProgress
                index={sectionIndex}
                total={sectionCount}
                percent={percent}
                className="w-full max-w-[280px] shrink"
            />

            <div className="flex flex-1 items-center justify-end gap-1">
                {onOpenNotes ? (
                    <button
                        type="button"
                        onClick={onOpenNotes}
                        aria-label="Open notes"
                        aria-pressed={notesOpen}
                        className={`btn-icon size-9 border ${notesOpen ? 'border-primary/40 bg-primary-subtle text-primary' : 'border-border-subtle bg-surface'}`}
                    >
                        <AppIcon name="edit_note" className="text-[17px]" />
                    </button>
                ) : null}
                {onOpenChat ? (
                    <button
                        type="button"
                        onClick={onOpenChat}
                        aria-label="Open AI Tutor"
                        aria-pressed={chatOpen}
                        className={`btn-icon size-9 border ${chatOpen ? 'border-primary/40 bg-primary-subtle text-primary' : 'border-border-subtle bg-surface'}`}
                    >
                        <AppIcon name="smart_toy" className="text-[17px]" />
                    </button>
                ) : null}
                {onOpenMore ? (
                    <button
                        type="button"
                        onClick={onOpenMore}
                        aria-label="More study tools"
                        className="btn-icon size-9 border border-border-subtle bg-surface"
                    >
                        <AppIcon name="more_horiz" className="text-[17px]" />
                    </button>
                ) : null}
            </div>
        </div>
    </div>
);

export default StudyTopBar;
