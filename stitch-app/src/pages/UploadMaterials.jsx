import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const typeConfig = {
    pdf: { icon: 'picture_as_pdf', color: 'bg-error-soft text-error' },
    pptx: { icon: 'slideshow', color: 'bg-warning-soft text-warning' },
    docx: { icon: 'description', color: 'bg-info-soft text-info' },
    audio: { icon: 'graphic_eq', color: 'bg-primary-soft text-primary' },
    image: { icon: 'image', color: 'bg-success-soft text-success' },
    txt: { icon: 'textsms', color: 'bg-surface-soft text-text-secondary' },
};

const resolveFileKind = (fileType = '', fileName = '') => {
    const source = `${fileType} ${fileName}`.toLowerCase();
    if (source.includes('pdf')) return 'pdf';
    if (source.includes('ppt') || source.includes('presentation')) return 'pptx';
    if (source.includes('doc')) return 'docx';
    if (source.includes('audio') || /\.(mp3|wav|m4a|aac)\b/.test(source)) return 'audio';
    if (source.includes('image') || /\.(png|jpe?g|webp)\b/.test(source)) return 'image';
    if (source.includes('text') || /\.(txt|md)\b/.test(source)) return 'txt';
    return 'docx';
};

const formatFileSize = (bytes) => {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return 'Size unavailable';
    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const size = value / Math.pow(1024, unitIndex);
    return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
};

const formatRelativeTime = (timestamp) => {
    const value = Number(timestamp || 0);
    if (!Number.isFinite(value) || value <= 0) return 'recently';
    const diffMs = Date.now() - value;
    const minutes = Math.max(1, Math.round(diffMs / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
};

const getStatusConfig = (status) => {
    const normalized = String(status || 'processing').toLowerCase();
    if (normalized === 'ready') {
        return {
            label: 'Ready',
            icon: 'check_circle',
            className: 'bg-success-soft text-success',
            isProcessing: false,
        };
    }
    if (normalized === 'error') {
        return {
            label: 'Failed',
            icon: 'error',
            className: 'bg-error-soft text-error',
            isProcessing: false,
        };
    }
    return {
        label: 'Processing',
        icon: 'sync',
        className: 'bg-info-soft text-info',
        isProcessing: true,
    };
};

const getProcessingText = (upload) => {
    const step = String(upload.processingStep || upload.extractionStatus || '').replaceAll('_', ' ');
    if (!step) return 'Preparing material...';
    return `${step.charAt(0).toUpperCase()}${step.slice(1)}...`;
};

const UploadMaterials = () => {
    const uploads = useQuery(api.uploads.getUserUploads, {});
    const recentUploads = useMemo(() => (uploads || []).slice(0, 3), [uploads]);
    const isLoading = uploads === undefined;

    return (
        <div className="flex-1 flex flex-col md:ml-0 h-full overflow-hidden">
            <main className="flex-1 overflow-y-auto p-space-4 md:p-space-10 pb-32 md:pb-space-10 pt-16">
                <div className="max-w-[1000px] mx-auto">
                    {/* Page Header */}
                    <div className="mb-space-8">
                        <h1 className="font-display-lg text-display-lg text-text-primary mb-space-2">Add to your workspace</h1>
                        <p className="font-body-lg text-body-lg text-text-secondary">
                            Upload your course materials to generate instant study guides, flashcards, and quizzes.
                        </p>
                    </div>

                    {/* Upload Area */}
                    <div className="border-2 border-dashed border-border-strong bg-surface-soft hover:bg-surface-muted transition-colors duration-300 rounded-[24px] p-space-12 flex flex-col items-center justify-center text-center cursor-pointer group relative overflow-hidden">
                        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white opacity-40 rounded-full blur-2xl"></div>
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary-soft opacity-40 rounded-full blur-2xl"></div>
                        <div className="w-24 h-24 bg-white rounded-full shadow-sm flex items-center justify-center mb-space-6 group-hover:scale-105 transition-transform duration-300 z-10">
                            <span className="material-symbols-outlined text-[48px] text-primary">cloud_upload</span>
                        </div>
                        <h3 className="font-headline-md text-headline-md text-text-primary mb-space-2 z-10">
                            Drop your PDFs, slides, or notes here
                        </h3>
                        <p className="font-body-base text-body-base text-text-secondary mb-space-8 z-10 max-w-md">
                            Our AI will automatically process your files, extract key concepts, and prepare them for study generation.
                        </p>
                        <button className="bg-primary text-on-primary rounded-xl px-space-6 py-space-3 font-label-md text-label-md hover:bg-primary-hover transition-colors shadow-sm flex items-center gap-2 z-10">
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            Upload Material
                        </button>
                        <div className="mt-space-6 flex items-center gap-space-4 font-label-xs text-label-xs text-text-muted z-10 flex-wrap justify-center">
                            <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-border-subtle">
                                <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span> PDF
                            </span>
                            <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-border-subtle">
                                <span className="material-symbols-outlined text-[14px]">slideshow</span> PPTX
                            </span>
                            <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-border-subtle">
                                <span className="material-symbols-outlined text-[14px]">description</span> DOCX
                            </span>
                            <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-border-subtle">
                                <span className="material-symbols-outlined text-[14px]">textsms</span> TXT
                            </span>
                        </div>
                    </div>

                    {/* Recent Uploads */}
                    <div className="mt-space-16">
                        <div className="flex justify-between items-end mb-space-6">
                            <h4 className="font-headline-sm text-headline-sm text-text-primary">Recent Uploads</h4>
                            <Link className="font-label-md text-label-md text-primary hover:text-primary-hover transition-colors" to="/dashboard/library">
                                View all
                            </Link>
                        </div>
                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-5">
                                {[0, 1, 2].map((item) => (
                                    <div
                                        key={item}
                                        className="bg-surface rounded-xl shadow-sm border border-border-subtle p-space-5 h-52 animate-pulse"
                                    >
                                        <div className="flex justify-between items-start mb-space-8">
                                            <div className="w-10 h-10 rounded-lg bg-surface-soft" />
                                            <div className="h-7 w-20 rounded-md bg-surface-soft" />
                                        </div>
                                        <div className="h-5 w-4/5 rounded bg-surface-soft mb-3" />
                                        <div className="h-4 w-2/3 rounded bg-surface-soft" />
                                    </div>
                                ))}
                            </div>
                        ) : recentUploads.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-5">
                                {recentUploads.map((upload) => {
                                    const config = typeConfig[resolveFileKind(upload.fileType, upload.fileName)] || typeConfig.docx;
                                    const statusConfig = getStatusConfig(upload.status);
                                    const progress = Math.max(8, Math.min(100, Number(upload.processingProgress || 0)));
                                    return (
                                        <div
                                            key={upload._id}
                                            className="bg-surface rounded-xl shadow-sm border border-border-subtle p-space-5 hover:shadow-md transition-shadow cursor-pointer group flex flex-col h-full"
                                        >
                                            <div className="flex justify-between items-start mb-space-4">
                                                <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center`}>
                                                    <span className="material-symbols-outlined">{config.icon}</span>
                                                </div>
                                                <span className={`${statusConfig.className} px-2 py-1 rounded-md font-label-xs text-label-xs flex items-center gap-1`}>
                                                    <span className={`material-symbols-outlined text-[12px] ${statusConfig.isProcessing ? 'animate-spin' : ''}`}>
                                                        {statusConfig.icon}
                                                    </span>
                                                    {statusConfig.label}
                                                </span>
                                            </div>
                                            <h5 className="font-label-md text-label-md text-text-primary mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                                                {upload.fileName || 'Untitled material'}
                                            </h5>
                                            <p className="font-body-sm text-body-sm text-text-secondary mb-space-4">
                                                Uploaded {formatRelativeTime(upload._creationTime)} &bull; {formatFileSize(upload.fileSize)}
                                            </p>
                                            {!statusConfig.isProcessing ? (
                                                <div className="mt-auto pt-space-4 border-t border-border-subtle flex gap-2">
                                                    <Link
                                                        to="/dashboard/library"
                                                        className="flex-1 bg-surface-soft text-text-primary rounded-lg py-2 font-label-xs text-label-xs hover:bg-surface-variant transition-colors text-center"
                                                    >
                                                        Generate
                                                    </Link>
                                                    <button className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-soft hover:text-text-primary transition-colors">
                                                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="mt-auto pt-space-4 border-t border-border-subtle">
                                                    <div className="w-full bg-surface-muted rounded-full h-1.5 mb-1">
                                                        <div className="bg-info h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                                    </div>
                                                    <p className="font-label-xs text-label-xs text-text-muted text-right">{getProcessingText(upload)}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-border-strong bg-surface-soft p-space-8 text-center">
                                <p className="font-body-sm text-body-sm text-text-secondary">
                                    Your recent uploads will appear here after you add material.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default UploadMaterials;
