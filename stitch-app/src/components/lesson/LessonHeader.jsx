import React from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../AppIcon';

const EMPTY_ARRAY = [];

const LessonHeader = ({
    courseTitle,
    courseHref,
    title,
    readingMinutes,
    statusBadge,
    bestScore,
    primaryAction,
    secondaryActions = EMPTY_ARRAY,
    onOpenSettings,
    onOpenReExplain,
}) => {
    return (
        <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface/95 shadow-sm backdrop-blur-xl">
            <div className="mx-auto max-w-[1400px] px-4 py-3 md:px-6 lg:px-8 lg:py-4">
                {/* Breadcrumb + actions row */}
                <div className="mb-2 flex items-center justify-between gap-3">
                    <nav className="flex min-w-0 items-center gap-2 text-caption text-text-secondary" aria-label="Breadcrumb">
                        <Link
                            to={courseHref || '/dashboard'}
                            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 font-semibold transition-colors hover:bg-surface-soft"
                            aria-label="Back to course"
                        >
                            <AppIcon name="arrow_back" className="text-[16px]" />
                            <span className="hidden sm:inline">Back</span>
                        </Link>
                        <span className="text-text-muted" aria-hidden="true">·</span>
                        <Link
                            to={courseHref || '/dashboard'}
                            className="max-w-[160px] truncate font-medium transition-colors hover:text-primary sm:max-w-xs"
                        >
                            {courseTitle || 'Course'}
                        </Link>
                        <span className="text-text-muted" aria-hidden="true">/</span>
                        <span className="max-w-[140px] truncate font-semibold text-text-primary sm:max-w-md">
                            {title}
                        </span>
                    </nav>
                    <div className="flex shrink-0 items-center gap-1">
                        {onOpenReExplain && (
                            <button
                                type="button"
                                onClick={onOpenReExplain}
                                className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-caption font-semibold text-text-secondary transition-colors hover:bg-primary-subtle hover:text-primary md:inline-flex"
                            >
                                <AppIcon name="lightbulb" className="text-[16px]" />
                                Re-explain
                            </button>
                        )}
                        {onOpenSettings && (
                            <button
                                type="button"
                                onClick={onOpenSettings}
                                className="btn-icon size-9"
                                aria-label="Lesson settings"
                            >
                                <AppIcon name="settings" className="text-[18px]" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Title + description */}
                <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                        <h1 className="line-clamp-1 font-display text-display-sm tracking-tight text-text-primary md:text-display-md">
                            {title}
                        </h1>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-caption text-text-secondary">
                            <span className="inline-flex items-center gap-1">
                                <AppIcon name="schedule" className="text-[14px]" />
                                {readingMinutes} min read
                            </span>
                            {statusBadge && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadge.className}`}>
                                        <AppIcon name={statusBadge.icon} className="text-[12px]" />
                                        {statusBadge.label}
                                    </span>
                                </>
                            )}
                            {bestScore != null && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1">
                                        <AppIcon name="emoji_events" className="text-[14px]" />
                                        Best {bestScore}%
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Header actions — desktop only; mobile uses sticky bottom bar */}
                    <div className="hidden lg:flex items-center gap-2 shrink-0">
                        {secondaryActions.map((action) => {
                            const Tag = action.href ? Link : 'button';
                            const tagProps = action.href ? { to: action.href, reloadDocument: action.reloadDocument } : { type: 'button', onClick: action.onClick };
                            return (
                                <Tag
                                    key={action.id}
                                    {...tagProps}
                                    disabled={action.disabled}
                                    className="btn-secondary text-body-sm"
                                >
                                    <AppIcon name={action.icon} className="text-[16px]" />
                                    {action.label}
                                </Tag>
                            );
                        })}
                        {primaryAction && (
                            (primaryAction.href ? (
                                <Link
                                    to={primaryAction.href}
                                    reloadDocument={primaryAction.reloadDocument}
                                    className="btn-primary text-body-sm"
                                >
                                    <AppIcon name={primaryAction.icon} className="text-[16px]" />
                                    {primaryAction.label}
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    onClick={primaryAction.onClick}
                                    disabled={primaryAction.disabled}
                                    className="btn-primary text-body-sm"
                                >
                                    <AppIcon name={primaryAction.icon} className="text-[16px]" />
                                    {primaryAction.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default LessonHeader;
