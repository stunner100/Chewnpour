import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const typeConfig = {
    pdf: { icon: 'picture_as_pdf', color: 'bg-error-soft text-error' },
    pptx: { icon: 'slideshow', color: 'bg-warning-soft text-warning' },
    docx: { icon: 'description', color: 'bg-info-soft text-info' },
    audio: { icon: 'graphic_eq', color: 'bg-primary-soft text-primary' },
    image: { icon: 'image', color: 'bg-success-soft text-success' },
    txt: { icon: 'textsms', color: 'bg-surface-soft text-text-secondary' },
};

const SUPPORTED_STUDY_MIME_TYPES = new Map([
    ['application/pdf', 'pdf'],
    ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
    ['audio/mpeg', 'mp3'],
    ['audio/mp3', 'mp3'],
    ['audio/mp4', 'mp4'],
    ['audio/x-m4a', 'm4a'],
    ['audio/wav', 'wav'],
    ['audio/x-wav', 'wav'],
    ['audio/webm', 'webm'],
    ['audio/ogg', 'ogg'],
    ['audio/aac', 'aac'],
    ['audio/flac', 'flac'],
]);

const SUPPORTED_STUDY_EXTENSIONS = new Set([
    'pdf',
    'pptx',
    'docx',
    'mp3',
    'm4a',
    'mp4',
    'wav',
    'webm',
    'ogg',
    'aac',
    'flac',
]);

const ACCEPTED_FILE_TYPES = '.pdf,.pptx,.docx,.mp3,.m4a,.mp4,.wav,.webm,.ogg,.aac,.flac,audio/*';
const ACCEPTED_FILE_TYPE_COPY = 'PDF, PPTX, DOCX, MP3, M4A, MP4, WAV, WEBM, OGG, AAC, FLAC';
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const resolveStudyUploadFileType = (file) => {
    const mimeType = String(file?.type || '').trim().toLowerCase().split(';')[0];
    if (SUPPORTED_STUDY_MIME_TYPES.has(mimeType)) {
        return SUPPORTED_STUDY_MIME_TYPES.get(mimeType);
    }
    const ext = String(file?.name || '').split('.').pop()?.toLowerCase() || '';
    return SUPPORTED_STUDY_EXTENSIONS.has(ext) ? ext : '';
};

const resolveFileKind = (fileType = '', fileName = '') => {
    const source = `${fileType} ${fileName}`.toLowerCase();
    if (source.includes('pdf')) return 'pdf';
    if (source.includes('ppt') || source.includes('presentation')) return 'pptx';
    if (source.includes('doc')) return 'docx';
    if (source.includes('audio') || /\.(mp3|wav|m4a|aac|flac|ogg|webm|mp4)\b/.test(source)) return 'audio';
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
            label: 'Not ready',
            icon: 'schedule',
            className: 'bg-surface-soft text-text-muted',
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

const stripExtension = (fileName) =>
    String(fileName || 'Untitled material').replace(
        /\.(pdf|pptx|docx|mp3|m4a|mp4|wav|webm|ogg|aac|flac)$/i,
        '',
    );

const isInternalQaUpload = (upload) => {
    const normalized = `${upload?.fileName || ''} ${upload?.title || ''}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    return /\b(?:prod(?:uction)?\s+)?objective\s+probe\b/.test(normalized)
        || /\bprobe\s+\d{6,}\b/.test(normalized)
        || /\bqa\s+probe\b/.test(normalized);
};

const UploadMaterials = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
    const uploads = useQuery(api.uploads.getUserUploads, {});
    const recentUploads = useMemo(
        () => (uploads || []).filter((upload) => !isInternalQaUpload(upload)).slice(0, 3),
        [uploads],
    );
    const isLoading = uploads === undefined;

    const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
    const createUpload = useMutation(api.uploads.createUpload);
    const createCourse = useMutation(api.courses.createCourse);
    const processUploadedFile = useAction(api.ai.processUploadedFile);

    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const userId = user?.id || user?._id || '';

    const handleFile = useCallback(async (file) => {
        if (!file) return;
        setUploadError('');

        if (!userId) {
            setUploadError('Please log in to upload files.');
            return;
        }
        if (!isConvexAuthenticated) {
            setUploadError('Connecting to your account. Please wait a moment and try again.');
            return;
        }

        const uploadFileType = resolveStudyUploadFileType(file);
        if (!uploadFileType) {
            setUploadError(`Please upload one of these supported file types: ${ACCEPTED_FILE_TYPE_COPY}.`);
            return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            setUploadError('File must be smaller than 50MB.');
            return;
        }

        setIsUploading(true);
        try {
            const uploadUrl = await generateUploadUrl();
            const result = await fetch(uploadUrl, {
                method: 'POST',
                headers: file.type ? { 'Content-Type': file.type } : undefined,
                body: file,
            });
            if (!result.ok) {
                throw new Error(`Storage responded with ${result.status}`);
            }
            const { storageId } = await result.json();

            const uploadId = await createUpload({
                fileName: file.name,
                fileType: uploadFileType,
                fileSize: file.size,
                storageId,
            });

            const courseId = await createCourse({
                title: stripExtension(file.name),
                description: 'Processing your study materials...',
                uploadId,
            });

            processUploadedFile({ uploadId, courseId, userId, extractedText: '' }).catch((err) => {
                console.error('AI processing dispatch failed:', err);
            });

            navigate('/dashboard/library');
        } catch (err) {
            console.error('Upload failed:', err);
            const message = err?.data?.message || err?.message || 'Upload failed. Please try again.';
            setUploadError(String(message));
        } finally {
            setIsUploading(false);
        }
    }, [
        userId,
        isConvexAuthenticated,
        generateUploadUrl,
        createUpload,
        createCourse,
        processUploadedFile,
        navigate,
    ]);

    const handleInputChange = useCallback((event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) handleFile(file);
    }, [handleFile]);

    const handleDrop = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        const file = event.dataTransfer?.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleDragOver = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    }, []);

    const openFilePicker = useCallback(() => {
        if (isUploading) return;
        fileInputRef.current?.click();
    }, [isUploading]);

    const handleKeyDown = useCallback((event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openFilePicker();
        }
    }, [openFilePicker]);

    return (
        <div className="flex-1 flex flex-col md:ml-0 h-full overflow-hidden">
            <main className="flex-1 overflow-y-auto px-space-4 py-space-5 md:p-space-10 pb-28 md:pb-space-10 pt-16">
                <div className="max-w-[1000px] mx-auto">
                    <div className="mb-space-5 md:mb-space-8">
                        <h1 className="font-display-lg text-display-md md:text-display-lg text-text-primary mb-space-2">Add to your workspace</h1>
                        <p className="font-body-lg text-body-md md:text-body-lg text-text-secondary">
                            Upload PDFs, slides, Word docs, or recordings to generate study guides, flashcards, and quizzes.
                        </p>
                    </div>

                    <div
                        role="button"
                        tabIndex={0}
                        aria-disabled={isUploading}
                        onClick={openFilePicker}
                        onKeyDown={handleKeyDown}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`border-2 border-dashed rounded-[24px] px-space-5 py-space-6 md:p-space-12 flex flex-col items-center justify-center text-center cursor-pointer group relative overflow-hidden transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                            isDragging
                                ? 'border-primary bg-primary-soft'
                                : 'border-border-strong bg-surface-soft hover:bg-surface-muted'
                        } ${isUploading ? 'cursor-wait opacity-90' : ''}`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={ACCEPTED_FILE_TYPES}
                            onChange={handleInputChange}
                            className="hidden"
                            disabled={isUploading}
                        />
                        <div className="absolute -top-10 -left-10 h-28 w-28 md:w-40 md:h-40 bg-white opacity-40 rounded-full blur-2xl"></div>
                        <div className="absolute -bottom-10 -right-10 h-28 w-28 md:w-40 md:h-40 bg-primary-soft opacity-40 rounded-full blur-2xl"></div>
                        <div className="w-14 h-14 md:w-24 md:h-24 bg-white rounded-full shadow-sm flex items-center justify-center mb-space-4 md:mb-space-6 group-hover:scale-105 transition-transform duration-300 z-10">
                            <span className={`material-symbols-outlined text-[30px] md:text-[48px] text-primary ${isUploading ? 'animate-spin' : ''}`}>
                                {isUploading ? 'sync' : 'cloud_upload'}
                            </span>
                        </div>
                        <h3 className="font-headline-md text-display-sm md:text-headline-md text-text-primary mb-space-2 z-10">
                            {isUploading
                                ? 'Uploading your material...'
                                : isDragging
                                    ? 'Drop to upload'
                                    : 'Drop PDFs, slides, docs, or audio here'}
                        </h3>
                        <p className="font-body-base text-body-sm md:text-body-base text-text-secondary mb-space-5 md:mb-space-8 z-10 max-w-md">
                            {isUploading
                                ? 'Hold tight while we prepare your material for processing.'
                                : `Supported formats: ${ACCEPTED_FILE_TYPE_COPY}. Max 50MB.`}
                        </p>
                        <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); openFilePicker(); }}
                            disabled={isUploading}
                            className="bg-primary text-on-primary rounded-xl px-space-5 md:px-space-6 py-space-3 font-label-md text-label-md hover:bg-primary-hover transition-colors shadow-sm flex items-center gap-2 z-10 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            <span className="material-symbols-outlined text-[18px]">
                                {isUploading ? 'sync' : 'add_circle'}
                            </span>
                            {isUploading ? 'Uploading…' : 'Upload Material'}
                        </button>
                        <div className="mt-space-4 md:mt-space-6 flex items-center gap-space-2 md:gap-space-4 font-label-xs text-label-xs text-text-muted z-10 flex-wrap justify-center">
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
                                <span className="material-symbols-outlined text-[14px]">graphic_eq</span> Audio
                            </span>
                        </div>
                    </div>

                    {uploadError && (
                        <div
                            role="alert"
                            className="mt-space-5 flex items-start gap-space-3 rounded-xl border border-error-soft bg-error-soft/40 p-space-4"
                        >
                            <span className="material-symbols-outlined text-error">error</span>
                            <p className="font-body-sm text-body-sm text-error">{uploadError}</p>
                        </div>
                    )}

                    <div className="mt-space-8 md:mt-space-16">
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
                                        <Link
                                            key={upload._id}
                                            to="/dashboard/library"
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
                                                <div className="mt-auto pt-space-4 border-t border-border-subtle flex gap-2 items-center">
                                                    <span className="flex-1 bg-surface-soft text-text-primary rounded-lg py-2 font-label-xs text-label-xs text-center">
                                                        Open in Library
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="mt-auto pt-space-4 border-t border-border-subtle">
                                                    <div className="w-full bg-surface-muted rounded-full h-1.5 mb-1">
                                                        <div className="bg-info h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                                    </div>
                                                    <p className="font-label-xs text-label-xs text-text-muted text-right">{getProcessingText(upload)}</p>
                                                </div>
                                            )}
                                        </Link>
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
