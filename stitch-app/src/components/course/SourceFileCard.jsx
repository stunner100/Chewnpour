import React, { useCallback, useRef, useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';

const ACCEPTED_FILE_TYPES = '.pdf,.pptx,.docx';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const FILE_TYPE_ICONS = {
    pdf: 'picture_as_pdf',
    pptx: 'slideshow',
    docx: 'description',
};

const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const STATUS_CONFIG = {
    processing: {
        icon: 'sync',
        className: 'text-amber-500',
        label: 'Processing',
        spin: true,
    },
    error: {
        icon: 'error',
        className: 'text-red-500',
        label: 'Error',
    },
    ready: {
        icon: 'check_circle',
        className: 'text-emerald-500',
        label: 'Ready',
    },
};

const SourceFileCard = ({ courseId, userId }) => {
    const sources = useQuery(
        api.courses.getCourseSources,
        courseId ? { courseId } : 'skip',
    );
    const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
    const createUpload = useMutation(api.uploads.createUpload);
    const addUploadToCourse = useMutation(api.courses.addUploadToCourse);
    const addSourceAction = useAction(api.ai.addSourceToCourse);
    const removeSource = useMutation(api.courses.removeSourceFromCourse);

    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [confirmRemove, setConfirmRemove] = useState(null);

    const handleAddSource = useCallback(
        async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            e.target.value = '';

            if (file.size > MAX_FILE_SIZE) {
                setUploadError('File must be under 50MB.');
                return;
            }
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (!['pdf', 'pptx', 'docx'].includes(ext)) {
                setUploadError('Only PDF, PPTX, and DOCX files are supported.');
                return;
            }

            setIsUploading(true);
            setUploadError('');
            try {
                const uploadUrl = await generateUploadUrl();
                const result = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': file.type },
                    body: file,
                });
                const { storageId } = await result.json();

                const uploadId = await createUpload({
                    userId,
                    fileName: file.name,
                    fileType: ext,
                    fileSize: file.size,
                    storageId,
                });

                await addUploadToCourse({ courseId, uploadId, userId });

                addSourceAction({ uploadId, courseId, userId }).catch((err) => {
                    console.error('Add source processing failed:', err);
                });
            } catch (err) {
                setUploadError(err.message || 'Upload failed. Please try again.');
            } finally {
                setIsUploading(false);
            }
        },
        [
            courseId,
            userId,
            generateUploadUrl,
            createUpload,
            addUploadToCourse,
            addSourceAction,
        ],
    );

    const handleRemoveSource = useCallback(
        async (uploadId) => {
            setConfirmRemove(null);
            try {
                await removeSource({ courseId, uploadId, userId });
            } catch (err) {
                console.error('Remove source failed:', err);
            }
        },
        [courseId, userId, removeSource],
    );

    const sourceList = Array.isArray(sources) ? sources : [];

    return (
        <section className="card-base p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark inline-flex items-center gap-2">
                    <span className="material-symbols-outlined text-text-faint-light dark:text-text-faint-dark text-[18px]">
                        folder_open
                    </span>
                    Source files
                </h3>
                {sourceList.length > 0 && (
                    <span className="text-caption text-text-faint-light dark:text-text-faint-dark">
                        {sourceList.length} file{sourceList.length === 1 ? '' : 's'}
                    </span>
                )}
            </div>

            {sourceList.length === 0 ? (
                <p className="text-caption text-text-sub-light dark:text-text-sub-dark">
                    Add a PDF, slide deck, or document to expand this course.
                </p>
            ) : (
                <ul className="space-y-1.5">
                    {sourceList.map((source) => {
                        const icon = FILE_TYPE_ICONS[source.fileType] || 'insert_drive_file';
                        const status = STATUS_CONFIG[source.status] || STATUS_CONFIG.ready;
                        return (
                            <li
                                key={source.uploadId}
                                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors group"
                            >
                                <span className="material-symbols-outlined text-[18px] text-text-faint-light dark:text-text-faint-dark">
                                    {icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-caption font-medium text-text-main-light dark:text-text-main-dark truncate">
                                        {source.fileName}
                                    </p>
                                    {source.fileSize && (
                                        <p className="text-[11px] text-text-faint-light dark:text-text-faint-dark">
                                            {formatFileSize(source.fileSize)} · {status.label}
                                        </p>
                                    )}
                                </div>
                                <span
                                    className={`material-symbols-outlined text-[16px] ${status.className} ${
                                        status.spin ? 'animate-spin' : ''
                                    }`}
                                >
                                    {status.icon}
                                </span>
                                {confirmRemove === source.uploadId ? (
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveSource(source.uploadId)}
                                            className="text-caption text-red-500 hover:text-red-600 font-semibold px-1"
                                        >
                                            Remove
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmRemove(null)}
                                            className="text-caption text-text-faint-light dark:text-text-faint-dark px-1"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmRemove(source.uploadId)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity btn-icon !p-1"
                                        aria-label="Remove source"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="mt-3 flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-dashed border-border-light dark:border-border-dark hover:border-primary hover:bg-primary/5 transition-colors text-body-sm text-text-sub-light dark:text-text-sub-dark hover:text-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <span className="material-symbols-outlined text-[18px]">
                    {isUploading ? 'sync' : 'add'}
                </span>
                {isUploading ? 'Uploading…' : 'Add source'}
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleAddSource}
                className="hidden"
            />
            {uploadError && (
                <p className="mt-2 text-caption text-red-500">{uploadError}</p>
            )}
        </section>
    );
};

export default SourceFileCard;
