import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import { useUploadReadinessPoll } from '../hooks/useUploadReadinessPoll';
import { watermelonToast } from '../components/watermelon/watermelonToast';
import { isUploadStudyReady } from '../lib/uploadReadiness';

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
    ['audio/mp4', 'm4a'],
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
    'wav',
    'webm',
    'ogg',
    'aac',
    'flac',
]);

const ACCEPTED_FILE_TYPES = '.pdf,.pptx,.docx,.mp3,.m4a,.wav,.webm,.ogg,.aac,.flac';
const ACCEPTED_FILE_TYPE_COPY = 'PDF, PPTX, DOCX, MP3, M4A, WAV, WEBM, OGG, AAC, FLAC';
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
    if (!Number.isFinite(value) || value <= 0) return 'just now';
    const deltaMs = Date.now() - value;
    const minutes = Math.round(deltaMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
};

const getStatusConfig = (status, extractionStatus) => {
    const normalized = String(status || '').toLowerCase();
    const extraction = String(extractionStatus || '').toLowerCase();
    if (normalized === 'ready' && extraction === 'complete') {
        return {
            label: 'Extracted',
            icon: 'check_circle',
            className: 'bg-success-soft text-success',
            isProcessing: false,
            isError: false,
        };
    }
    if (normalized === 'error' || extraction === 'failed' || extraction === 'deferred') {
        return {
            label: 'Failed',
            icon: 'error',
            className: 'bg-error-soft text-error',
            isProcessing: false,
            isError: true,
        };
    }
    if (normalized === 'extracting' || extraction === 'running') {
        return {
            label: 'Extracting',
            icon: 'sync',
            className: 'bg-info-soft text-info',
            isProcessing: true,
            isError: false,
        };
    }
    return {
        label: 'Processing',
        icon: 'sync',
        className: 'bg-info-soft text-info',
        isProcessing: true,
        isError: false,
    };
};

const getProcessingText = (upload) => {
    const step = String(upload.processingStep || upload.extractionStatus || '').replaceAll('_', ' ');
    if (!step) return 'Preparing material...';
    return `${step.charAt(0).toUpperCase()}${step.slice(1)}...`;
};

const isInternalQaUpload = (upload) => {
    const normalized = `${upload?.fileName || ''} ${upload?.title || ''}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    return /\b(?:prod(?:uction)?\s+)?objective\s+probe\b/.test(normalized)
        || /\bprobe\s+\d{6,}\b/.test(normalized)
        || /\bqa\s+probe\b/.test(normalized);
};

const fetchUploads = async () => {
    const response = await fetch('/api/uploads', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || `Failed to load uploads (${response.status})`);
    }
    return Array.isArray(payload.uploads) ? payload.uploads : [];
};

const initUpload = async ({ fileName, fileType, fileSize, contentType }) => {
    const response = await fetch('/api/uploads/init', {
        method: 'POST',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName, fileType, fileSize, contentType }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload?.error || `Upload init failed (${response.status})`);
        error.status = response.status;
        error.code = payload?.code;
        throw error;
    }
    return payload;
};

const finalizeUpload = async (uploadId) => {
    const response = await fetch(`/api/uploads/${encodeURIComponent(uploadId)}/finalize`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload?.error || `Upload finalize failed (${response.status})`);
        error.status = response.status;
        error.code = payload?.code;
        throw error;
    }
    return payload.upload;
};

const UploadMaterials = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [uploads, setUploads] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const userId = user?.id || '';

    const refreshUploads = useCallback(async ({ silent = false } = {}) => {
        if (!userId) {
            setUploads([]);
            if (!silent) setIsLoading(false);
            return { uploads: [] };
        }
        if (!silent) setIsLoading(true);
        try {
            const nextUploads = await fetchUploads();
            setUploads(nextUploads);
            return { uploads: nextUploads };
        } catch (error) {
            console.error('Failed to load uploads:', error);
            if (!silent) setUploadError(error.message || 'Could not load uploads.');
            return { uploads: [] };
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        refreshUploads();
    }, [refreshUploads]);

    useUploadReadinessPoll({
        enabled: Boolean(userId),
        refresh: refreshUploads,
        uploads,
        onNewlyReady: (readyItems) => {
            const first = readyItems[0];
            if (!first) return;
            watermelonToast(`${first.title} is ready to study`, {
                type: 'success',
                duration: 8000,
                action: {
                    label: 'Open lessons',
                    onClick: () => navigate(first.lessonsHref),
                },
            });
        },
    });

    const recentUploads = useMemo(
        () => (uploads || []).filter((upload) => !isInternalQaUpload(upload)).slice(0, 3),
        [uploads],
    );

    const handleFile = useCallback(async (file) => {
        if (!file) return;
        setUploadError('');

        if (!userId) {
            setUploadError('Please log in to upload files.');
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
            const init = await initUpload({
                fileName: file.name,
                fileType: uploadFileType,
                fileSize: file.size,
                contentType: file.type || 'application/octet-stream',
            });

            const putResponse = await fetch(init.signedUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type || 'application/octet-stream',
                },
                body: file,
            });
            if (!putResponse.ok) {
                throw new Error(`Storage responded with ${putResponse.status}`);
            }

            const finalized = await finalizeUpload(init.upload.id);
            setUploads((current) => {
                const without = (current || []).filter((item) => item.id !== finalized.id);
                return [finalized, ...without];
            });
            if (isUploadStudyReady(finalized)) {
                watermelonToast(`${finalized.fileName || 'Your material'} is ready to study`, {
                    type: 'success',
                    duration: 8000,
                    action: {
                        label: 'Open lessons',
                        onClick: () => navigate(
                            finalized.courseId
                                ? `/dashboard/lessons?courseId=${encodeURIComponent(finalized.courseId)}`
                                : '/dashboard/library',
                        ),
                    },
                });
            }
        } catch (err) {
            console.error('Upload failed:', err);
            if (err?.status === 402 || err?.code === 'UPLOAD_CREDITS_EXHAUSTED') {
                navigate('/subscription?from=%2Fdashboard%2Fupload&reason=upload_limit', {
                    state: {
                        paywallMessage: err.message || 'No upload credits remaining. Top up to continue.',
                    },
                });
                return;
            }
            setUploadError(String(err?.message || 'Upload failed. Please try again.'));
        } finally {
            setIsUploading(false);
        }
    }, [navigate, userId]);

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
        <div className="min-h-[calc(100vh-4rem)] bg-background-light px-4 py-8 md:px-8 md:py-10">
            <div className="mx-auto max-w-5xl">
                <div className="mb-8">
                    <h1 className="font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
                        Add to your workspace
                    </h1>
                    <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
                        Upload PDF, DOCX, or PPTX files. ChewnPour extracts text and prepares lessons and quizzes.
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
                    className={`relative flex flex-col items-center justify-center overflow-hidden rounded-[28px] border-2 border-dashed px-6 py-12 text-center outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-primary-soft focus-visible:ring-offset-2 md:px-12 md:py-16 ${
                        isDragging
                            ? 'border-primary bg-primary-subtle'
                            : 'border-border-default bg-surface hover:bg-surface-soft'
                    } ${isUploading ? 'cursor-wait opacity-90' : 'cursor-pointer'}`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_FILE_TYPES}
                        onChange={handleInputChange}
                        className="hidden"
                        disabled={isUploading}
                    />
                    <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary-subtle text-primary md:size-20">
                        <AppIcon name={isUploading ? 'sync' : 'folder'} className={`text-[32px] md:text-[40px] ${isUploading ? 'animate-spin' : ''}`} />
                    </div>
                    <h3 className="font-display text-display-sm font-bold text-text-primary md:text-display-md">
                        {isUploading
                            ? 'Uploading your material...'
                            : isDragging
                                ? 'Drop to upload'
                                : 'Drop PDF, DOCX, or PPTX files here'}
                    </h3>
                    <p className="mt-2 max-w-md text-body-sm text-text-secondary md:text-body-md">
                        {isUploading
                            ? 'Hold tight while we prepare your material for processing.'
                            : `Supported formats: ${ACCEPTED_FILE_TYPE_COPY}. Max 50MB.`}
                    </p>
                    <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); openFilePicker(); }}
                        disabled={isUploading}
                        className="btn-primary z-10 mt-8 inline-flex min-h-11 items-center gap-2 text-body-sm disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        <AppIcon name={isUploading ? 'sync' : 'add'} className="text-[18px]" />
                        {isUploading ? 'Uploading…' : 'Upload Material'}
                    </button>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                        {[
                            ['picture_as_pdf', 'PDF'],
                            ['slideshow', 'PPTX'],
                            ['description', 'DOCX'],
                            ['graphic_eq', 'Audio'],
                        ].map(([icon, label]) => (
                            <span
                                key={label}
                                className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-soft px-3 py-1.5 text-caption font-semibold text-text-secondary"
                            >
                                <AppIcon name={icon} className="text-[14px] text-primary" />
                                {label}
                            </span>
                        ))}
                    </div>
                </div>

                {uploadError && (
                    <div
                        role="alert"
                        className="mt-5 flex items-start gap-3 rounded-[16px] border border-error/30 bg-error-soft px-4 py-3"
                    >
                        <AppIcon name="error" className="text-error" />
                        <p className="text-body-sm text-error">{uploadError}</p>
                    </div>
                )}

                <div className="mt-12">
                    <div className="mb-5 flex items-end justify-between gap-3">
                        <h2 className="font-display text-display-sm font-bold text-text-primary">Recent Uploads</h2>
                        <Link className="text-body-sm font-semibold text-primary hover:text-primary-hover" to="/dashboard/library">
                            View all
                        </Link>
                    </div>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[0, 1, 2].map((item) => (
                                <div key={item} className="h-24 animate-pulse rounded-[20px] border border-border-subtle bg-surface" />
                            ))}
                        </div>
                    ) : recentUploads.length > 0 ? (
                        <div className="space-y-3">
                            {recentUploads.map((upload) => {
                                const config = typeConfig[resolveFileKind(upload.fileType, upload.fileName)] || typeConfig.docx;
                                const statusConfig = getStatusConfig(upload.status, upload.extractionStatus);
                                return (
                                    <div
                                        key={upload.id}
                                        className="flex flex-col gap-4 rounded-[20px] border border-border-subtle bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"
                                    >
                                        <div className="flex min-w-0 items-start gap-3 sm:items-center">
                                            <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${config.color}`}>
                                                <AppIcon name={config.icon} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="truncate font-semibold text-text-primary">
                                                        {upload.fileName || 'Untitled material'}
                                                    </h3>
                                                    <span className={`${statusConfig.className} inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-semibold`}>
                                                        <AppIcon name={statusConfig.icon} className={`text-[14px] ${statusConfig.isProcessing ? 'animate-spin' : ''}`} />
                                                        {statusConfig.label}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-body-sm text-text-secondary">
                                                    Uploaded {formatRelativeTime(upload.createdAt)} · {formatFileSize(upload.fileSize)}
                                                </p>
                                                {statusConfig.isError && upload.errorMessage && (
                                                    <p className="mt-2 text-caption text-error">{upload.errorMessage}</p>
                                                )}
                                                {statusConfig.isProcessing && (
                                                    <div className="mt-3 max-w-xs">
                                                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-soft">
                                                            <div className="h-full w-[55%] rounded-full bg-info animate-pulse" />
                                                        </div>
                                                        <p className="mt-1 text-caption text-text-muted">{getProcessingText(upload)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {!statusConfig.isProcessing && !statusConfig.isError && (
                                            <Link
                                                to="/dashboard/library"
                                                className="btn-secondary inline-flex min-h-10 shrink-0 self-start text-body-sm sm:self-center"
                                            >
                                                Open
                                            </Link>
                                        )}
                                        {statusConfig.isError && (
                                            <Link
                                                to="/dashboard/upload"
                                                className="btn-secondary inline-flex min-h-10 shrink-0 self-start text-body-sm sm:self-center"
                                            >
                                                Try again
                                            </Link>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-[20px] border border-dashed border-border-default bg-surface px-5 py-10 text-center">
                            <p className="text-body-sm text-text-secondary">
                                Your recent uploads will appear here after you add material.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UploadMaterials;
