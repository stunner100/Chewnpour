import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../AppIcon';
import { describeGenerationStage } from '../../lib/generationStages';
import GenerationStageList from './GenerationStageList';

const typeIcons = {
    pdf: { icon: 'picture_as_pdf', color: 'bg-error-soft text-error' },
    pptx: { icon: 'slideshow', color: 'bg-mastery-soft text-mastery' },
    docx: { icon: 'description', color: 'bg-info-soft text-info' },
    audio: { icon: 'graphic_eq', color: 'bg-primary-soft text-primary' },
    image: { icon: 'image', color: 'bg-success-soft text-success' },
    notes: { icon: 'description', color: 'bg-info-soft text-info' },
};

const StatusPill = ({ tone, icon, spin, children }) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold ${tone}`}>
        <AppIcon name={icon} className={`text-[14px] ${spin ? 'animate-spin' : ''}`} />
        {children}
    </span>
);

const MaterialCard = ({
    material,
    busyDownload,
    onDownloadOriginal,
    onDownloadTransformed,
    onDelete,
}) => {
    const [moreOpen, setMoreOpen] = useState(false);
    const typeConfig = typeIcons[material.kind] || typeIcons.notes;
    const exporting = busyDownload?.id === material.uploadId && busyDownload?.kind === 'export';
    const fetchingOriginal = busyDownload?.id === material.uploadId && busyDownload?.kind === 'original';
    const lessonLabel = material.lessons === 1 ? 'lesson' : 'lessons';
    const quizLabel = material.quizzes === 1 ? 'quiz ready' : 'quizzes ready';

    return (
        <article className="flex h-full flex-col overflow-hidden rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className={`flex size-11 items-center justify-center rounded-xl ${typeConfig.color}`}>
                    <AppIcon name={typeConfig.icon} className="text-[22px]" />
                </div>
                {material.failed ? (
                    <StatusPill tone="bg-error-soft text-error" icon="error">Failed</StatusPill>
                ) : material.studyReady ? (
                    <StatusPill tone="bg-success-soft text-success" icon="check_circle">Course generated</StatusPill>
                ) : (
                    <StatusPill tone="bg-warning-soft text-warning" icon="sync" spin>
                        {describeGenerationStage(material.stageIndex)}
                    </StatusPill>
                )}
            </div>

            <h2 className="line-clamp-2 font-display text-display-sm font-bold text-text-primary">
                {material.title}
            </h2>
            <p className="mt-1 text-caption font-medium text-text-muted">
                {material.studyReady
                    ? 'Chewnpour turned this file into a course.'
                    : material.failed
                        ? 'This upload could not be turned into a course.'
                        : `Uploaded ${material.uploadedLabel}`}
            </p>

            {material.studyReady ? (
                <div className="mt-4 flex gap-4 border-t border-border-subtle pt-4">
                    <div>
                        <p className="font-semibold text-text-primary">{material.lessons}</p>
                        <p className="text-caption text-text-muted">{lessonLabel}</p>
                    </div>
                    <div className="w-px bg-border-subtle" />
                    <div>
                        <p className="font-semibold text-text-primary">{material.quizzes}</p>
                        <p className="text-caption text-text-muted">{quizLabel}</p>
                    </div>
                </div>
            ) : null}

            {material.processing && !material.failed ? (
                <GenerationStageList stageIndex={Math.max(0, material.stageIndex)} />
            ) : null}

            <div className="mt-auto flex flex-col gap-2 pt-5">
                {material.failed ? (
                    <Link
                        to="/dashboard/upload"
                        className="btn-primary inline-flex w-full min-h-11 items-center justify-center gap-2 text-body-sm"
                    >
                        Try again
                    </Link>
                ) : material.studyReady ? (
                    <Link
                        to={material.continueHref}
                        className="btn-primary inline-flex w-full min-h-11 items-center justify-center gap-2 text-body-sm"
                    >
                        Continue studying
                    </Link>
                ) : (
                    <button
                        type="button"
                        disabled
                        className="btn-primary inline-flex w-full min-h-11 items-center justify-center gap-2 text-body-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Preparing course
                    </button>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm font-semibold">
                    {material.courseHref ? (
                        <Link to={material.courseHref} className="text-text-secondary hover:text-primary">
                            View course
                        </Link>
                    ) : null}
                    <button
                        type="button"
                        className="text-text-secondary hover:text-primary disabled:opacity-50"
                        disabled={Boolean(busyDownload)}
                        aria-busy={fetchingOriginal}
                        onClick={() => onDownloadOriginal(material.uploadId)}
                    >
                        {fetchingOriginal ? 'Opening original...' : 'Download original'}
                    </button>
                    <div className="relative">
                        <button
                            type="button"
                            className="text-text-secondary hover:text-primary"
                            aria-expanded={moreOpen}
                            aria-haspopup="menu"
                            onClick={() => setMoreOpen((value) => !value)}
                        >
                            More
                        </button>
                        {moreOpen ? (
                            <div
                                role="menu"
                                className="absolute right-0 z-20 mt-1 min-w-[12rem] rounded-xl border border-border-subtle bg-surface p-1 shadow-sm"
                            >
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-caption text-text-secondary hover:bg-surface-soft disabled:opacity-50"
                                    disabled={!material.canExport || Boolean(busyDownload)}
                                    aria-busy={exporting}
                                    onClick={() => {
                                        setMoreOpen(false);
                                        onDownloadTransformed(material.uploadId, material.title);
                                    }}
                                >
                                    <AppIcon name="download" className="text-[14px]" />
                                    {exporting ? 'Downloading...' : 'Download lessons'}
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-caption text-error hover:bg-error-soft"
                                    onClick={() => {
                                        setMoreOpen(false);
                                        onDelete(material.uploadId);
                                    }}
                                >
                                    <AppIcon name="delete" className="text-[14px]" />
                                    Delete
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </article>
    );
};

export default MaterialCard;
