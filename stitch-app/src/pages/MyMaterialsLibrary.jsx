import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import { useUploadReadinessPoll } from '../hooks/useUploadReadinessPoll';
import { watermelonToast } from '../components/watermelon/watermelonToast';
import { formatCourseTitle } from '../lib/courseTitle';
import { downloadAuthenticatedFile } from '../lib/downloadFile';

const filterTabs = [
    { label: 'All', value: 'all' },
    { label: 'PDFs', value: 'pdf' },
    { label: 'Notes', value: 'notes' },
    { label: 'Processing', value: 'processing' },
];

const typeIcons = {
    pdf: { icon: 'picture_as_pdf', color: 'bg-error-soft text-error' },
    pptx: { icon: 'slideshow', color: 'bg-mastery-soft text-mastery' },
    docx: { icon: 'description', color: 'bg-info-soft text-info' },
    audio: { icon: 'graphic_eq', color: 'bg-primary-soft text-primary' },
    image: { icon: 'image', color: 'bg-success-soft text-success' },
    notes: { icon: 'description', color: 'bg-info-soft text-info' },
};

const resolveFileKind = (fileType = '', fileName = '') => {
    const source = `${fileType} ${fileName}`.toLowerCase();
    if (source.includes('pdf')) return 'pdf';
    if (source.includes('ppt') || source.includes('presentation')) return 'pptx';
    if (source.includes('doc')) return 'docx';
    if (source.includes('audio') || /\.(mp3|wav|m4a|aac)\b/.test(source)) return 'audio';
    if (source.includes('image') || /\.(png|jpe?g|webp)\b/.test(source)) return 'image';
    return 'notes';
};

const formatUploadedAt = (timestamp) => {
    const value = Number(timestamp || 0);
    if (!Number.isFinite(value) || value <= 0) return 'recently';
    const diffMs = Date.now() - value;
    const minutes = Math.max(1, Math.round(diffMs / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
};

const MaterialsSkeleton = () => (
    <div className="min-h-[calc(100vh-4rem)] animate-pulse bg-background-light px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="h-16 rounded-[20px] bg-surface-soft" />
            <div className="h-11 max-w-xl rounded-full bg-surface-soft" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-64 rounded-[24px] bg-surface-soft" />
                ))}
            </div>
        </div>
    </div>
);

const MyMaterialsLibrary = () => {
    const { user } = useAuth();
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [uploads, setUploads] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyDownload, setBusyDownload] = useState(null);

    const loadLibrary = useCallback(async ({ silent = false } = {}) => {
        if (!user?.id) {
            setUploads([]);
            setCourses([]);
            if (!silent) setLoading(false);
            return { uploads: [], courses: [] };
        }
        if (!silent) {
            setLoading(true);
            setError('');
        }
        try {
            const [uploadsRes, coursesRes] = await Promise.all([
                fetch('/api/uploads', { credentials: 'include', headers: { Accept: 'application/json' } }),
                fetch('/api/courses', { credentials: 'include', headers: { Accept: 'application/json' } }),
            ]);
            const uploadsPayload = await uploadsRes.json().catch(() => ({}));
            const coursesPayload = await coursesRes.json().catch(() => ({}));
            if (!uploadsRes.ok) throw new Error(uploadsPayload.error || 'Failed to load uploads');
            if (!coursesRes.ok) throw new Error(coursesPayload.error || 'Failed to load courses');
            const nextUploads = Array.isArray(uploadsPayload.uploads) ? uploadsPayload.uploads : [];
            const nextCourses = Array.isArray(coursesPayload.courses) ? coursesPayload.courses : [];
            setUploads(nextUploads);
            setCourses(nextCourses);
            return { uploads: nextUploads, courses: nextCourses };
        } catch (err) {
            if (!silent) setError(err.message || 'Could not load library');
            return { uploads: [], courses: [] };
        } finally {
            if (!silent) setLoading(false);
        }
    }, [user?.id]);

    const handleDownloadTransformed = useCallback(async (uploadId, title) => {
        if (!uploadId) return;
        setError('');
        setBusyDownload({ id: uploadId, kind: 'export' });
        try {
            await downloadAuthenticatedFile(
                `/api/uploads/${encodeURIComponent(uploadId)}/export`,
                `${title || 'material'}-chewnpour.zip`,
            );
        } catch (err) {
            setError(err.message || 'Could not download transformed content');
        } finally {
            setBusyDownload(null);
        }
    }, []);

    const handleDownloadOriginal = useCallback(async (uploadId) => {
        if (!uploadId) return;
        setError('');
        setBusyDownload({ id: uploadId, kind: 'original' });
        try {
            const response = await fetch(`/api/uploads/${encodeURIComponent(uploadId)}/original`, {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Could not download original file');
            if (!payload.url) throw new Error('Original file is not available');
            window.open(payload.url, '_blank', 'noopener,noreferrer');
        } catch (err) {
            setError(err.message || 'Could not download original file');
        } finally {
            setBusyDownload(null);
        }
    }, []);

    useEffect(() => {
        loadLibrary();
    }, [loadLibrary]);

    useUploadReadinessPoll({
        enabled: Boolean(user?.id),
        refresh: loadLibrary,
        uploads,
        courses,
        onNewlyReady: (readyItems) => {
            const first = readyItems[0];
            if (!first) return;
            watermelonToast(`${first.title} is ready to download`, {
                type: 'success',
                duration: 8000,
                action: {
                    label: 'Download',
                    onClick: () => handleDownloadTransformed(first.uploadId, first.title),
                },
            });
        },
    });

    const materials = useMemo(() => {
        return uploads.map((upload) => {
            const course = courses.find((item) => String(item.uploadId || '') === String(upload.id))
                || (upload.courseId ? courses.find((item) => item.id === upload.courseId) : null);
            const topicCount = Number(course?.topicCount || upload.topicCount || 0);
            const quizzesReady = Number(course?.quizzesReady || upload.quizzesReady || 0);
            const extractionStatus = String(upload.extractionStatus || '').toLowerCase();
            const isComplete = upload.status === 'ready' && extractionStatus === 'complete';
            return {
                uploadId: upload.id,
                courseId: course?.id || upload.courseId || null,
                firstQuizTopicId: course?.firstQuizTopicId || upload.firstQuizTopicId || null,
                title: formatCourseTitle(course?.title || upload.fileName) || course?.title || upload.fileName,
                fileName: upload.fileName,
                kind: resolveFileKind(upload.fileType, upload.fileName),
                status: upload.status,
                extractionStatus,
                errorMessage: upload.errorMessage || '',
                processingProgress: isComplete ? 100 : (upload.status === 'error' ? 0 : 35),
                processingStep: upload.processingStep || '',
                createdAt: upload.createdAt,
                lessons: topicCount,
                quizzes: quizzesReady,
                topicCount,
                canExport: Boolean(upload.canExport) || (isComplete && Number(upload.charCount || 0) > 0),
            };
        });
    }, [courses, uploads]);

    const handleDelete = useCallback(async (uploadId) => {
        if (!uploadId) return;
        const confirmed = window.confirm('Delete this material and its generated lessons? This cannot be undone.');
        if (!confirmed) return;
        setError('');
        try {
            const response = await fetch(`/api/uploads/${encodeURIComponent(uploadId)}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Failed to delete upload');
            await loadLibrary();
        } catch (err) {
            setError(err.message || 'Could not delete material');
        }
    }, [loadLibrary]);

    const filteredMaterials = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return materials.filter((material) => {
            const matchesFilter = activeFilter === 'all'
                || material.kind === activeFilter
                || (activeFilter === 'processing' && material.status !== 'ready' && material.status !== 'error')
                || (activeFilter === 'notes' && ['notes', 'docx', 'pptx'].includes(material.kind));
            const matchesSearch = !normalizedSearch
                || String(material.title || '').toLowerCase().includes(normalizedSearch)
                || String(material.fileName || '').toLowerCase().includes(normalizedSearch);
            return matchesFilter && matchesSearch;
        });
    }, [activeFilter, materials, searchTerm]);

    if (loading) return <MaterialsSkeleton />;

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background-light px-4 py-8 md:px-8 md:py-10">
            <div className="mx-auto max-w-6xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
                            My Materials
                        </h1>
                        <p className="mt-2 max-w-xl text-pretty text-body-md text-text-secondary">
                            Download lessons and quizzes from every upload.
                        </p>
                    </div>
                    <div className="flex w-full items-center gap-2 rounded-full border border-border-subtle bg-surface px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-primary-soft md:w-72">
                        <AppIcon name="search" className="text-[18px] text-text-muted" />
                        <input
                            className="w-full border-none bg-transparent p-0 text-body-sm outline-none placeholder:text-text-muted focus:ring-0"
                            placeholder="Search materials..."
                            type="search"
                            aria-label="Search materials"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>
                </div>

                {error && (
                    <div role="alert" className="mt-5 rounded-[16px] border border-error/30 bg-error-soft px-4 py-3 text-body-sm text-error">
                        {error}
                    </div>
                )}

                <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
                    {filterTabs.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setActiveFilter(tab.value)}
                            className={`whitespace-nowrap rounded-full px-4 py-2 text-body-sm font-semibold transition-all ${
                                activeFilter === tab.value
                                    ? 'bg-cta text-cta-foreground shadow-sm'
                                    : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-soft'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredMaterials.map((material) => {
                        const typeConfig = typeIcons[material.kind] || typeIcons.notes;
                        const isProcessing = material.status !== 'ready' && material.status !== 'error';
                        const exporting = busyDownload?.id === material.uploadId && busyDownload?.kind === 'export';
                        const fetchingOriginal = busyDownload?.id === material.uploadId && busyDownload?.kind === 'original';
                        return (
                            <article
                                key={material.uploadId}
                                className="flex h-full flex-col overflow-hidden rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm"
                            >
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className={`flex size-11 items-center justify-center rounded-xl ${typeConfig.color}`}>
                                        <AppIcon name={typeConfig.icon} className="text-[22px]" />
                                    </div>
                                    {material.canExport ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-caption font-semibold text-success">
                                            <span className="size-1.5 rounded-full bg-success" />
                                            Ready to download
                                        </span>
                                    ) : isProcessing ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-caption font-semibold text-warning">
                                            <AppIcon name="sync" className="animate-spin text-[14px]" />
                                            Processing
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-error-soft px-2.5 py-1 text-caption font-semibold text-error">
                                            <AppIcon name="error" className="text-[14px]" />
                                            Failed
                                        </span>
                                    )}
                                </div>
                                <h2 className="line-clamp-2 font-display text-display-sm font-bold text-text-primary">
                                    {material.title}
                                </h2>
                                <p className="mt-1 text-caption font-medium text-text-muted">
                                    Uploaded {formatUploadedAt(material.createdAt)}
                                </p>
                                {!material.canExport && material.errorMessage && (
                                    <p className="mt-2 text-caption text-error">{material.errorMessage}</p>
                                )}

                                <div className="mt-auto pt-5">
                                    <div className="mb-4 flex gap-4 border-t border-border-subtle pt-4">
                                        <div>
                                            <p className="font-semibold text-text-primary">{material.topicCount}</p>
                                            <p className="text-caption text-text-muted">Lessons</p>
                                        </div>
                                        <div className="w-px bg-border-subtle" />
                                        <div>
                                            <p className="font-semibold text-text-primary">{material.canExport ? 'Yes' : 'No'}</p>
                                            <p className="text-caption text-text-muted">Source text</p>
                                        </div>
                                        <div className="w-px bg-border-subtle" />
                                        <div>
                                            <p className="font-semibold text-text-primary">{material.quizzes}</p>
                                            <p className="text-caption text-text-muted">Quizzes</p>
                                        </div>
                                    </div>
                                    {isProcessing && (
                                        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-soft">
                                            <div
                                                className="h-full animate-pulse rounded-full bg-warning"
                                                style={{ width: `${Math.max(8, material.processingProgress || 20)}%` }}
                                            />
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-2">
                                        <button
                                            type="button"
                                            className="btn-primary inline-flex w-full min-h-11 items-center justify-center gap-2 text-body-sm disabled:cursor-not-allowed disabled:opacity-60"
                                            disabled={!material.canExport || Boolean(busyDownload)}
                                            aria-busy={exporting}
                                            aria-label={`Download transformed content for ${material.title}`}
                                            onClick={() => handleDownloadTransformed(material.uploadId, material.title)}
                                        >
                                            <AppIcon name={exporting ? 'pending' : 'download'} className="text-[16px]" />
                                            {exporting
                                                ? 'Downloading...'
                                                : material.canExport
                                                    ? (material.topicCount > 0 ? 'Download lessons' : 'Download extracted text')
                                                    : 'Download when ready'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-secondary inline-flex w-full min-h-10 items-center justify-center gap-2 text-body-sm disabled:cursor-not-allowed disabled:opacity-60"
                                            disabled={Boolean(busyDownload)}
                                            aria-busy={fetchingOriginal}
                                            aria-label={`Download original file for ${material.title}`}
                                            onClick={() => handleDownloadOriginal(material.uploadId)}
                                        >
                                            <AppIcon name={fetchingOriginal ? 'pending' : 'description'} className="text-[16px]" />
                                            {fetchingOriginal ? 'Opening original...' : 'Download original'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(material.uploadId)}
                                            className="inline-flex w-full min-h-10 items-center justify-center gap-2 text-body-sm font-semibold text-text-muted hover:text-error"
                                        >
                                            <AppIcon name="delete" className="text-[16px]" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>

                {filteredMaterials.length === 0 && (
                    <div className="mx-auto mt-10 flex w-full max-w-xl flex-col items-center rounded-[28px] border border-dashed border-border-default bg-surface px-6 py-12 text-center shadow-sm">
                        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-soft text-text-muted">
                            <AppIcon name="search_off" className="text-[28px]" />
                        </div>
                        <h2 className="font-display text-display-sm font-bold text-text-primary">
                            {materials.length === 0 ? 'No downloads yet' : 'No matching materials'}
                        </h2>
                        <p className="mt-2 max-w-sm text-body-sm text-text-secondary">
                            {materials.length === 0
                                ? 'Upload a PDF, DOCX, or PPTX. Lessons appear here to download.'
                                : 'Try a different search or clear your filters to see more files.'}
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            {(searchTerm || activeFilter !== 'all') && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setActiveFilter('all');
                                    }}
                                    className="btn-secondary inline-flex min-h-11 text-body-sm"
                                >
                                    Clear Filters
                                </button>
                            )}
                            <Link
                                to="/dashboard/upload"
                                className="btn-primary inline-flex min-h-11 items-center gap-2 text-body-sm"
                            >
                                <AppIcon name="cloud_upload" className="text-[18px]" />
                                Upload New
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyMaterialsLibrary;
