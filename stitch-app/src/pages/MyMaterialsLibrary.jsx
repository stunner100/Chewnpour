import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';

const filterTabs = [
    { label: 'All Files', value: 'all' },
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
    <div className="md:ml-0 pt-16 min-h-screen flex flex-col gap-space-6 p-space-6 md:p-space-8 pb-24 md:pb-space-8 animate-pulse">
        <div className="h-20 rounded-2xl bg-surface-soft" />
        <div className="h-12 rounded-xl bg-surface-soft max-w-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-space-6">
            {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-64 rounded-xl bg-surface-soft" />
            ))}
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

    const loadLibrary = useCallback(async () => {
        if (!user?.id) {
            setUploads([]);
            setCourses([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const [uploadsRes, coursesRes] = await Promise.all([
                fetch('/api/uploads', { credentials: 'include', headers: { Accept: 'application/json' } }),
                fetch('/api/courses', { credentials: 'include', headers: { Accept: 'application/json' } }),
            ]);
            const uploadsPayload = await uploadsRes.json().catch(() => ({}));
            const coursesPayload = await coursesRes.json().catch(() => ({}));
            if (!uploadsRes.ok) throw new Error(uploadsPayload.error || 'Failed to load uploads');
            if (!coursesRes.ok) throw new Error(coursesPayload.error || 'Failed to load courses');
            setUploads(Array.isArray(uploadsPayload.uploads) ? uploadsPayload.uploads : []);
            setCourses(Array.isArray(coursesPayload.courses) ? coursesPayload.courses : []);
        } catch (err) {
            setError(err.message || 'Could not load library');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        loadLibrary();
    }, [loadLibrary]);

    const materials = useMemo(() => {
        return uploads.map((upload) => {
            const course = courses.find((item) => String(item.uploadId || '') === String(upload.id))
                || (upload.courseId ? courses.find((item) => item.id === upload.courseId) : null);
            const topicCount = Number(course?.topicCount || upload.topicCount || 0);
            const quizzesReady = Number(course?.quizzesReady || upload.quizzesReady || 0);
            return {
                uploadId: upload.id,
                courseId: course?.id || upload.courseId || null,
                title: course?.title || upload.fileName,
                fileName: upload.fileName,
                kind: resolveFileKind(upload.fileType, upload.fileName),
                status: upload.status,
                processingProgress: upload.status === 'ready' ? 100 : 35,
                processingStep: upload.processingStep || '',
                createdAt: upload.createdAt,
                lessons: topicCount,
                quizzes: quizzesReady,
                topicCount,
            };
        });
    }, [courses, uploads]);

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
        <div className="md:ml-0 pt-16 min-h-screen flex flex-col gap-space-6 p-space-6 md:p-space-8 pb-24 md:pb-space-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-4">
                <div>
                    <h2 className="font-display-md text-display-md text-text-primary mb-1">My Materials</h2>
                    <p className="font-body-sm text-body-sm text-text-secondary">Manage and study your uploaded files and generated content.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-space-3 items-center">
                    <div className="flex items-center gap-2 bg-surface px-4 py-2.5 rounded-xl border border-border-default shadow-sm w-full sm:w-64 focus-within:ring-2 focus-within:ring-primary-soft transition-all">
                        <AppIcon name="search" className="text-[18px] text-text-muted" />
                        <input
                            className="bg-transparent border-none outline-none text-body-sm font-body-sm w-full placeholder:text-text-muted focus:ring-0 p-0"
                            placeholder="Search materials..."
                            type="text"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div role="alert" className="rounded-xl border border-error-soft bg-error-soft/40 p-space-4 text-body-sm text-error">
                    {error}
                </div>
            )}

            <div className="flex overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar gap-2">
                {filterTabs.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => setActiveFilter(tab.value)}
                        className={`whitespace-nowrap px-3.5 py-2 rounded-lg font-label-sm text-label-sm shadow-sm transition-all ${
                            activeFilter === tab.value
                                ? 'bg-text-primary text-on-primary'
                                : 'bg-surface border border-border-default text-text-secondary hover:bg-surface-soft'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-space-6">
                {filteredMaterials.map((material) => {
                    const typeConfig = typeIcons[material.kind] || typeIcons.notes;
                    const isProcessing = material.status !== 'ready' && material.status !== 'error';
                    const hasGeneratedContent = material.status === 'ready' && material.courseId && material.topicCount > 0;
                    const studyHref = hasGeneratedContent ? `/dashboard/lessons?courseId=${material.courseId}` : '';
                    return (
                        <article
                            key={material.uploadId}
                            className={`bg-surface border border-border-subtle rounded-xl p-space-4 shadow-sm flex flex-col h-full group relative overflow-hidden ${
                                hasGeneratedContent ? 'hover:shadow-md transition-shadow duration-300' : 'opacity-90'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className={`w-9 h-9 rounded-lg ${typeConfig.color} flex items-center justify-center`}>
                                    <AppIcon name={typeConfig.icon} className="text-[20px]" />
                                </div>
                                {hasGeneratedContent ? (
                                    <span className="bg-success-soft text-success px-2.5 py-1 rounded-md font-label-xs text-label-xs font-semibold flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                                        Ready
                                    </span>
                                ) : isProcessing ? (
                                    <span className="bg-warning-soft text-warning px-2.5 py-1 rounded-md font-label-xs text-label-xs font-semibold flex items-center gap-1">
                                        <AppIcon name="sync" className="text-[14px] animate-spin" />
                                        Processing
                                    </span>
                                ) : (
                                    <span className="bg-surface-soft text-text-muted px-2.5 py-1 rounded-md font-label-xs text-label-xs font-semibold flex items-center gap-1">
                                        <AppIcon name="schedule" className="text-[14px]" />
                                        Not ready
                                    </span>
                                )}
                            </div>
                            <h3 className="font-body-base text-body-base font-bold text-text-primary mb-1 line-clamp-2">{material.title}</h3>
                            <p className="text-caption font-medium text-text-muted mb-5">Uploaded {formatUploadedAt(material.createdAt)}</p>
                            <div className="mt-auto">
                                <div className="flex gap-3 mb-4 border-t border-border-subtle pt-3">
                                    <div className="flex flex-col">
                                        <span className="font-label-md text-label-md text-text-primary">{material.topicCount}</span>
                                        <span className="font-label-xs text-label-xs text-text-muted">Topics</span>
                                    </div>
                                    <div className="w-px h-full bg-border-subtle" />
                                    <div className="flex flex-col">
                                        <span className="font-label-md text-label-md text-text-primary">{material.quizzes}</span>
                                        <span className="font-label-xs text-label-xs text-text-muted">Quizzes</span>
                                    </div>
                                </div>
                                {hasGeneratedContent ? (
                                    <Link
                                        to={studyHref}
                                        className="w-full bg-primary text-on-primary py-2.5 rounded-lg font-label-sm text-label-sm hover:bg-primary-hover transition-colors shadow-sm flex items-center justify-center gap-2"
                                    >
                                        Continue Study
                                        <AppIcon name="arrow_forward" className="text-[16px]" />
                                    </Link>
                                ) : (
                                    <>
                                        <div className="w-full bg-surface-muted rounded-full h-1.5 mb-5">
                                            <div
                                                className={`bg-warning h-1.5 rounded-full ${isProcessing ? 'animate-pulse' : ''}`}
                                                style={{ width: `${Math.max(8, material.processingProgress || 20)}%` }}
                                            />
                                        </div>
                                        <button
                                            className="w-full bg-surface-soft text-text-muted border border-border-default py-2.5 rounded-lg font-label-sm text-label-sm cursor-not-allowed flex items-center justify-center"
                                            disabled
                                            type="button"
                                        >
                                            Open when ready
                                        </button>
                                    </>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>

            {filteredMaterials.length === 0 && (
                <div className="mt-space-8 bg-surface border-2 border-dashed border-border-strong rounded-2xl p-space-12 flex flex-col items-center justify-center text-center max-w-2xl mx-auto w-full shadow-sm">
                    <AppIcon name="folder_open" className="text-[40px] text-text-muted mb-4" />
                    <h3 className="font-headline-sm text-headline-sm text-text-primary mb-2">No materials yet</h3>
                    <p className="font-body-sm text-body-sm text-text-secondary mb-6">
                        Upload a PDF, slide deck, or document to generate topics and quizzes.
                    </p>
                    <Link
                        to="/dashboard/upload"
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-label-md text-label-md text-on-primary hover:bg-primary-hover"
                    >
                        <AppIcon name="cloud_upload" className="text-[18px]" />
                        Upload Material
                    </Link>
                </div>
            )}
        </div>
    );
};

export default MyMaterialsLibrary;
