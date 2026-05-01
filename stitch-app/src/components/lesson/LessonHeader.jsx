import React from 'react';
import { Link } from 'react-router-dom';

const LessonHeader = ({
    courseTitle,
    courseHref,
    title,
    readingMinutes,
    statusBadge,
    bestScore,
    primaryAction,
    secondaryActions = [],
    onOpenSettings,
    onOpenReExplain,
}) => {
    return (
        <header className="sticky top-0 z-30 bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-xl border-b border-border-subtle dark:border-border-subtle-dark shadow-[0_1px_0_rgba(0,0,0,0.02)]">
            <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-3 lg:py-4">
                {/* Breadcrumb + actions row */}
                <div className="flex items-center justify-between gap-3 mb-2">
                    <nav className="flex items-center gap-2 min-w-0 text-caption text-text-sub-light dark:text-text-sub-dark" aria-label="Breadcrumb">
                        <Link
                            to={courseHref || '/dashboard'}
                            className="inline-flex items-center gap-1 px-2 h-8 rounded-lg hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors shrink-0 font-semibold"
                            aria-label="Back to course"
                        >
                            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                            <span className="hidden sm:inline">Back</span>
                        </Link>
                        <span className="text-text-faint-light dark:text-text-faint-dark" aria-hidden="true">·</span>
                        <Link
                            to={courseHref || '/dashboard'}
                            className="truncate font-medium hover:text-primary transition-colors max-w-[160px] sm:max-w-xs"
                        >
                            {courseTitle || 'Course'}
                        </Link>
                        <span className="text-text-faint-light dark:text-text-faint-dark" aria-hidden="true">/</span>
                        <span className="truncate font-semibold text-text-main-light dark:text-text-main-dark max-w-[140px] sm:max-w-md">
                            {title}
                        </span>
                    </nav>
                    <div className="flex items-center gap-1 shrink-0">
                        {onOpenReExplain && (
                            <button
                                type="button"
                                onClick={onOpenReExplain}
                                className="hidden md:inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-caption font-semibold text-text-sub-light dark:text-text-sub-dark hover:text-primary hover:bg-primary-50/60 dark:hover:bg-primary-900/20 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                                Re-explain
                            </button>
                        )}
                        {onOpenSettings && (
                            <button
                                type="button"
                                onClick={onOpenSettings}
                                className="btn-icon w-9 h-9"
                                aria-label="Lesson settings"
                            >
                                <span className="material-symbols-outlined text-[18px]">settings</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Title + description */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
                    <div className="min-w-0">
                        <h1 className="text-display-sm md:text-display-md text-text-main-light dark:text-text-main-dark tracking-tight leading-tight line-clamp-1">
                            {title}
                        </h1>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap text-caption text-text-sub-light dark:text-text-sub-dark">
                            <span className="inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">schedule</span>
                                {readingMinutes} min read
                            </span>
                            {statusBadge && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${statusBadge.className}`}>
                                        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>{statusBadge.icon}</span>
                                        {statusBadge.label}
                                    </span>
                                </>
                            )}
                            {bestScore != null && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">emoji_events</span>
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
                                    <span className="material-symbols-outlined text-[16px]">{action.icon}</span>
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
                                    <span className="material-symbols-outlined text-[16px]">{primaryAction.icon}</span>
                                    {primaryAction.label}
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    onClick={primaryAction.onClick}
                                    disabled={primaryAction.disabled}
                                    className="btn-primary text-body-sm"
                                >
                                    <span className="material-symbols-outlined text-[16px]">{primaryAction.icon}</span>
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
