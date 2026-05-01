import React from 'react';
import { Link } from 'react-router-dom';

const DashboardHero = ({
    uploading,
    uploadError,
    uploadQuota,
    uploadLimitMessage,
    onUploadClick,
    fileInputRef,
    onFileSelect,
    referralSlot,
    topUpHref = '/subscription',
}) => {
    const remaining = Number(uploadQuota?.remaining ?? 0);
    const total = Number(uploadQuota?.totalAllowed ?? 0);
    const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((remaining / total) * 100))) : 0;

    return (
        <section className="relative overflow-hidden rounded-3xl border border-border-subtle dark:border-border-subtle-dark bg-gradient-to-br from-primary-50 via-white to-white dark:from-primary-900/20 dark:via-surface-dark dark:to-surface-dark p-5 md:p-8 shadow-soft animate-fade-in">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-accent-teal/15 blur-3xl" aria-hidden="true" />

            <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
                <div className="space-y-5">
                    <span className="badge-primary">
                        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                        AI Powered
                    </span>
                    <h1 className="text-display-md md:text-display-lg lg:text-display-xl text-text-main-light dark:text-text-main-dark tracking-tight leading-tight">
                        Turn your documents into a <span className="text-primary">personal study system</span>
                    </h1>
                    <p className="text-body-md md:text-body-lg text-text-sub-light dark:text-text-sub-dark max-w-xl">
                        Upload PDFs, slides, or Word docs. ChewnPour creates lessons, summaries, quizzes, flashcards, podcasts, and weak-concept reviews automatically.
                    </p>

                    {uploadError && (
                        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40 text-body-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">error</span>
                            {uploadError}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-start gap-3">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.pptx,.docx"
                            className="hidden"
                            disabled={uploading}
                            onChange={onFileSelect}
                        />
                        <button
                            type="button"
                            onClick={onUploadClick}
                            disabled={uploading}
                            className="btn-primary h-12 px-6 text-body-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                {uploading ? 'hourglass_empty' : 'cloud_upload'}
                            </span>
                            {uploading ? 'Uploading…' : 'Upload Study Material'}
                        </button>
                        <span className="text-caption text-text-faint-light dark:text-text-faint-dark pt-1.5 sm:pt-3">
                            PDF, PPTX, DOCX · Max 50MB
                        </span>
                    </div>

                    {uploadQuota && (
                        <div className="max-w-sm space-y-1.5">
                            <div className="flex items-center justify-between text-caption">
                                <span className="text-text-sub-light dark:text-text-sub-dark">
                                    {remaining}/{total} uploads remaining
                                </span>
                                <Link to={topUpHref} className="font-semibold text-primary hover:text-primary-hover transition-colors">
                                    Top up
                                </Link>
                            </div>
                            <div className="w-full h-1.5 bg-border-subtle dark:bg-border-subtle-dark rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-[width] duration-500 ${
                                        remaining === 0 ? 'bg-red-500'
                                        : remaining <= 1 ? 'bg-amber-500'
                                        : 'bg-accent-emerald'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            {uploadLimitMessage && remaining === 0 && (
                                <p className="text-caption text-text-faint-light dark:text-text-faint-dark">{uploadLimitMessage}</p>
                            )}
                        </div>
                    )}

                    {referralSlot}
                </div>

                <div className="hidden lg:flex items-center justify-center">
                    <div className="relative w-full max-w-[280px] aspect-square">
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary to-accent-purple shadow-elevated" />
                        <div className="absolute inset-3 rounded-2xl bg-white/95 dark:bg-surface-dark/95 backdrop-blur-sm border border-white/40 dark:border-white/10 flex flex-col items-center justify-center p-6 text-center gap-3">
                            <span className="material-symbols-outlined text-primary text-[44px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                            <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Drop a file, get a course</p>
                            <p className="text-caption text-text-sub-light dark:text-text-sub-dark">Lessons · Quizzes · Flashcards · Podcasts</p>
                            <div className="flex gap-1.5 pt-1">
                                {['picture_as_pdf', 'slideshow', 'description'].map((icon) => (
                                    <span key={icon} className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary text-[16px]">{icon}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default DashboardHero;
