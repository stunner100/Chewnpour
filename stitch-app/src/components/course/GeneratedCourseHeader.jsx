import React from 'react';

const SOURCE_LABEL = {
    pdf: 'PDF',
    pptx: 'PPTX',
    ppt: 'PPT',
    docx: 'DOCX',
    doc: 'DOC',
};

const SOURCE_DESCRIPTOR = {
    pdf: 'uploaded PDF',
    pptx: 'uploaded presentation',
    ppt: 'uploaded presentation',
    docx: 'uploaded document',
    doc: 'uploaded document',
};

const formatRelative = (timestamp) => {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const GeneratedCourseHeader = ({
    title,
    sourceFileType,
    topicsReady,
    quizzesReady,
    estimatedMinutes,
    lastStudiedAt,
    isGenerating,
    onContinue,
    onGeneratePodcast,
    primaryDisabled,
    podcastReady,
}) => {
    const sourceType = sourceFileType ? sourceFileType.toLowerCase() : '';
    const sourceLabel = SOURCE_LABEL[sourceType] || (sourceType ? sourceType.toUpperCase() : 'Document');
    const sourceDescriptor = SOURCE_DESCRIPTOR[sourceType] || 'uploaded source';

    const metaParts = [];
    if (typeof topicsReady === 'number') {
        metaParts.push(`${topicsReady} topic${topicsReady === 1 ? '' : 's'} ready`);
    }
    if (typeof quizzesReady === 'number' && quizzesReady > 0) {
        metaParts.push(`${quizzesReady} quiz${quizzesReady === 1 ? '' : 'zes'} ready`);
    }
    if (estimatedMinutes) {
        metaParts.push(`${estimatedMinutes} min estimated study time`);
    }

    return (
        <section className="relative overflow-hidden rounded-3xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark p-6 md:p-8">
            <div
                className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-primary/30 via-violet-400/20 to-transparent blur-3xl"
                aria-hidden="true"
            />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0 max-w-2xl space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/15 text-[10px] font-bold uppercase tracking-wider">
                            <span
                                className="material-symbols-outlined text-[12px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                                auto_awesome
                            </span>
                            AI generated course
                        </span>
                        {sourceFileType && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-hover-light dark:bg-surface-hover-dark text-text-sub-light dark:text-text-sub-dark text-[10px] font-bold uppercase tracking-wider">
                                <span className="material-symbols-outlined text-[12px]">description</span>
                                {sourceLabel}
                            </span>
                        )}
                        {isGenerating && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 text-[10px] font-bold uppercase tracking-wider">
                                <span className="material-symbols-outlined text-[12px] animate-spin">sync</span>
                                Still generating
                            </span>
                        )}
                    </div>

                    <h1 className="text-display-md md:text-display-lg font-semibold text-text-main-light dark:text-text-main-dark tracking-tight">
                        {title || 'Your Course'}
                    </h1>

                    <p className="text-body-sm md:text-body-base text-text-sub-light dark:text-text-sub-dark">
                        Generated from your {sourceDescriptor}.
                        {metaParts.length > 0 && (
                            <span className="text-text-faint-light dark:text-text-faint-dark">
                                {' · '}
                                {metaParts.join(' · ')}
                            </span>
                        )}
                    </p>

                    {lastStudiedAt && (
                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            Last studied {formatRelative(lastStudiedAt)}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:shrink-0">
                    <button
                        type="button"
                        onClick={onContinue}
                        disabled={primaryDisabled}
                        className="btn-primary text-body-sm md:text-body-base h-11 px-5 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <span
                            className="material-symbols-outlined text-[18px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                            play_arrow
                        </span>
                        Continue learning
                    </button>
                    <button
                        type="button"
                        onClick={onGeneratePodcast}
                        className="btn-secondary text-body-sm md:text-body-base h-11 px-5"
                    >
                        <span className="material-symbols-outlined text-[18px]">graphic_eq</span>
                        {podcastReady ? 'Open podcast' : 'Generate podcast'}
                    </button>
                </div>
            </div>
        </section>
    );
};

export default GeneratedCourseHeader;
