import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import MaterialCard from '../components/materials/MaterialCard';
import { useUploadReadinessPoll } from '../hooks/useUploadReadinessPoll';
import { watermelonToast } from '../components/watermelon/watermelonToast';
import { formatCourseTitle } from '../lib/courseTitle';
import { downloadAuthenticatedFile } from '../lib/downloadFile';
import { buildFirstLessonHref, isUploadStudyReady } from '../lib/uploadReadiness';
import { resolveGenerationStageIndex } from '../lib/generationStages';
import { FilterSortDropdown } from '../components/opensource-ui/FilterSortDropdown';
import { SearchInput } from '../components/opensource-ui/SearchInput';
import { SegmentedToggleButton } from '../components/opensource-ui/SegmentedToggleButton';
import { StackedFolderCard } from '../components/opensource-ui/StackedFolderCard';

const filterTabs = [
    { label: 'All', value: 'all' },
    { label: 'PDFs', value: 'pdf' },
    { label: 'Notes', value: 'notes' },
    { label: 'Processing', value: 'processing' },
];
const filterLabels = filterTabs.map((tab) => tab.label);

const librarySortOptions = [
    { id: 'newest', label: 'Newest first' },
    { id: 'oldest', label: 'Oldest first' },
    { id: 'az', label: 'A → Z' },
    { id: 'za', label: 'Z → A' },
];

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
    <div className="min-h-[calc(100dvh-4rem)] animate-pulse bg-background-light px-4 py-8 md:px-8 md:py-10">
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
    const [sortId, setSortId] = useState('newest');
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
            watermelonToast(`${first.title} is ready to study`, {
                type: 'success',
                duration: 8000,
                action: {
                    label: 'Continue studying',
                    onClick: () => {
                        window.location.assign(first.lessonsHref);
                    },
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
            const studyReady = isUploadStudyReady(upload, course);
            const failed = upload.status === 'error' || extractionStatus === 'failed';
            const stageIndex = resolveGenerationStageIndex({
                status: upload.status,
                extractionStatus,
                processingStep: upload.processingStep || '',
                topicCount,
                quizzesReady,
                studyReady,
            });
            return {
                uploadId: upload.id,
                courseId: course?.id || upload.courseId || null,
                title: formatCourseTitle(course?.title || upload.fileName) || course?.title || upload.fileName,
                fileName: upload.fileName,
                kind: resolveFileKind(upload.fileType, upload.fileName),
                status: upload.status,
                extractionStatus,
                processing: !studyReady && !failed,
                failed,
                studyReady,
                stageIndex,
                uploadedLabel: formatUploadedAt(upload.createdAt),
                createdAt: Number(upload.createdAt || 0),
                lessons: topicCount,
                quizzes: quizzesReady,
                topicCount,
                canExport: Boolean(upload.canExport) || (studyReady && Number(upload.charCount || 0) > 0),
                continueHref: buildFirstLessonHref({ course, upload }),
                courseHref: course?.id
                    ? `/dashboard/lessons?courseId=${encodeURIComponent(course.id)}`
                    : null,
            };
        });
    }, [courses, uploads]);

    const handleDelete = useCallback(async (uploadId) => {
        if (!uploadId) return;
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
        const filtered = materials.filter((material) => {
            const matchesFilter = activeFilter === 'all'
                || material.kind === activeFilter
                || (activeFilter === 'processing' && material.processing)
                || (activeFilter === 'notes' && ['notes', 'docx', 'pptx'].includes(material.kind));
            const matchesSearch = !normalizedSearch
                || String(material.title || '').toLowerCase().includes(normalizedSearch)
                || String(material.fileName || '').toLowerCase().includes(normalizedSearch);
            return matchesFilter && matchesSearch;
        });

        const sorted = [...filtered];
        sorted.sort((left, right) => {
            if (sortId === 'oldest') return (left.createdAt || 0) - (right.createdAt || 0);
            if (sortId === 'az') return String(left.title || '').localeCompare(String(right.title || ''));
            if (sortId === 'za') return String(right.title || '').localeCompare(String(left.title || ''));
            return (right.createdAt || 0) - (left.createdAt || 0);
        });
        return sorted;
    }, [activeFilter, materials, searchTerm, sortId]);

    if (loading) return <MaterialsSkeleton />;

    return (
        <div className="min-h-[calc(100dvh-4rem)] bg-background-light px-4 py-8 md:px-8 md:py-10">
            <div className="mx-auto max-w-6xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
                            My Materials
                        </h1>
                        <p className="mt-2 max-w-xl text-pretty text-body-md text-text-secondary">
                            Every upload becomes a course you can continue studying.
                        </p>
                    </div>
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
                        <SearchInput
                            label="Search materials"
                            placeholder="Search materials..."
                            value={searchTerm}
                            containerClassName="w-full max-w-none md:w-72"
                            className="h-11 rounded-full"
                            onChange={(value) => setSearchTerm(value)}
                            onClear={() => setSearchTerm('')}
                        />
                        <FilterSortDropdown
                            className="w-full sm:w-52"
                            label="Sort"
                            value={sortId}
                            options={librarySortOptions}
                            onValueChange={(option) => setSortId(option.id)}
                        />
                    </div>
                </div>

                {error && (
                    <div role="alert" className="mt-5 rounded-[16px] border border-error/30 bg-error-soft px-4 py-3 text-body-sm text-error">
                        {error}
                    </div>
                )}

                <div className="mt-6 overflow-x-auto pb-1">
                    <SegmentedToggleButton
                        className="w-full min-w-[20rem]"
                        options={filterLabels}
                        activeIndex={Math.max(0, filterTabs.findIndex((tab) => tab.value === activeFilter))}
                        onChange={(index) => {
                            setActiveFilter(filterTabs[index]?.value || 'all');
                        }}
                    />
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredMaterials.map((material) => (
                        <MaterialCard
                            key={material.uploadId}
                            material={material}
                            busyDownload={busyDownload}
                            onDownloadOriginal={handleDownloadOriginal}
                            onDownloadTransformed={handleDownloadTransformed}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>

                {filteredMaterials.length === 0 && (
                    <div className="mx-auto mt-10 flex w-full max-w-xl flex-col items-center rounded-[28px] border border-dashed border-border-default bg-surface px-6 py-12 text-center shadow-sm">
                        {materials.length === 0 ? (
                            <StackedFolderCard className="mb-6 h-[12rem] w-[14rem] scale-75" />
                        ) : (
                            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-soft text-text-muted">
                                <AppIcon name="search_off" className="text-[28px]" />
                            </div>
                        )}
                        <h2 className="font-display text-display-sm font-bold text-text-primary">
                            {materials.length === 0 ? 'Nothing to study yet' : 'No matching materials'}
                        </h2>
                        <p className="mt-2 max-w-sm text-body-sm text-text-secondary">
                            {materials.length === 0
                                ? 'Upload a lecture PDF or PPTX to generate a course.'
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
