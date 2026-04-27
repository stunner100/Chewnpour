import React, { useRef, useState, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useAction, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { resolveTopicIllustrationUrl } from '../lib/topicIllustration';

const ACCEPTED_FILE_TYPES = '.pdf,.pptx,.docx';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const FILE_TYPE_ICONS = {
    pdf: 'picture_as_pdf',
    pptx: 'slideshow',
    docx: 'description',
};

const buildObjectiveExamRoute = (topicId) =>
    topicId ? `/dashboard/exam/${topicId}?autostart=mcq` : '/dashboard';

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Sources panel component
const SourcesPanel = ({ courseId, userId }) => {
    const sources = useQuery(
        api.courses.getCourseSources,
        courseId ? { courseId } : 'skip'
    );
    const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
    const createUpload = useMutation(api.uploads.createUpload);
    const addUploadToCourse = useMutation(api.courses.addUploadToCourse);
    const addSourceAction = useAction(api.ai.addSourceToCourse);
    const removeSource = useMutation(api.courses.removeSourceFromCourse);

    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [expanded, setExpanded] = useState(true);
    const [confirmRemove, setConfirmRemove] = useState(null);

    const handleAddSource = useCallback(async (e) => {
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

            // Fire-and-forget: AI processing
            addSourceAction({ uploadId, courseId, userId }).catch((err) => {
                console.error('Add source processing failed:', err);
            });
        } catch (err) {
            setUploadError(err.message || 'Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    }, [courseId, userId, generateUploadUrl, createUpload, addUploadToCourse, addSourceAction]);

    const handleRemoveSource = useCallback(async (uploadId) => {
        setConfirmRemove(null);
        try {
            await removeSource({ courseId, uploadId, userId });
        } catch (err) {
            console.error('Remove source failed:', err);
        }
    }, [courseId, userId, removeSource]);

    if (!sources || sources.length === 0) return null;

    const processingCount = sources.filter((s) => s.status === 'processing').length;

    return (
        <div className="mb-6">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 text-body-sm font-medium text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark transition-colors mb-2"
            >
                <span className="material-symbols-outlined text-[18px]">
                    {expanded ? 'expand_more' : 'chevron_right'}
                </span>
                Sources ({sources.length})
                {processingCount > 0 && (
                    <span className="flex items-center gap-1 text-caption text-accent-amber">
                        <span className="material-symbols-outlined text-[12px] animate-spin">sync</span>
                        {processingCount} processing
                    </span>
                )}
            </button>

            {expanded && (
                <div className="card-base p-3 space-y-1">
                    {sources.map((source) => {
                        const icon = FILE_TYPE_ICONS[source.fileType] || 'insert_drive_file';
                        return (
                            <div key={source.uploadId} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors group">
                                <span className="material-symbols-outlined text-[20px] text-text-faint-light dark:text-text-faint-dark">{icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-body-sm text-text-main-light dark:text-text-main-dark truncate">
                                        {source.fileName}
                                    </p>
                                    {source.fileSize && (
                                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                            {formatFileSize(source.fileSize)}
                                        </p>
                                    )}
                                </div>
                                {source.status === 'processing' ? (
                                    <span className="material-symbols-outlined text-[16px] text-accent-amber animate-spin">sync</span>
                                ) : source.status === 'error' ? (
                                    <span className="material-symbols-outlined text-[16px] text-red-500">error</span>
                                ) : (
                                    <span className="material-symbols-outlined text-[16px] text-accent-emerald">check_circle</span>
                                )}
                                {confirmRemove === source.uploadId ? (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleRemoveSource(source.uploadId)}
                                            className="text-caption text-red-500 hover:text-red-600 font-medium px-1"
                                        >
                                            Remove
                                        </button>
                                        <button
                                            onClick={() => setConfirmRemove(null)}
                                            className="text-caption text-text-faint-light dark:text-text-faint-dark hover:text-text-sub-light px-1"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setConfirmRemove(source.uploadId)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity btn-icon !p-1"
                                        title="Remove source"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {/* Add Source button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-border-light dark:border-border-dark hover:border-primary hover:bg-primary/5 transition-colors text-body-sm text-text-faint-light dark:text-text-faint-dark hover:text-primary"
                    >
                        <span className="material-symbols-outlined text-[18px]">
                            {isUploading ? 'sync' : 'add'}
                        </span>
                        {isUploading ? 'Uploading...' : 'Add Source'}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_FILE_TYPES}
                        onChange={handleAddSource}
                        className="hidden"
                    />

                    {uploadError && (
                        <p className="text-caption text-red-500 px-3">{uploadError}</p>
                    )}
                </div>
            )}
        </div>
    );
};

const EMPTY_LIST = [];

const estimateReadingMinutes = (content) => {
    if (!content) return null;
    const words = content.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
};

const ACTION_PROMPTS = {
    quiz: {
        icon: 'quiz',
        title: 'Pick a topic to generate a quiz',
        description: 'Quizzes are tailored to each topic. Open any topic below to start its quiz.',
    },
    flashcards: {
        icon: 'style',
        title: 'Pick a topic to study flashcards',
        description: 'Flashcards live inside each topic. Open one to review key terms with active recall.',
    },
    podcast: {
        icon: 'podcasts',
        title: 'Pick a topic to generate a podcast',
        description: 'Each topic can be turned into an audio lesson. Open one to create or play its podcast.',
    },
};

const DashboardCourse = () => {
    const { courseId } = useParams();
    const { user } = useAuth();
    const userId = user?.id;
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedAction = searchParams.get('action');
    const actionPrompt = requestedAction ? ACTION_PROMPTS[requestedAction] : null;

    const dismissActionBanner = useCallback(() => {
        const next = new URLSearchParams(searchParams);
        next.delete('action');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    React.useEffect(() => {
        const main = document.getElementById('dashboard-main');
        if (main) main.scrollTop = 0;
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [courseId]);

    React.useEffect(() => {
        if (!actionPrompt) return;
        const timer = window.setTimeout(() => {
            const node = document.getElementById('course-topics');
            if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 250);
        return () => window.clearTimeout(timer);
    }, [actionPrompt]);

    const courseData = useQuery(
        api.courses.getCourseWithTopics,
        courseId ? { courseId } : 'skip'
    );

    // Only fetch all user courses when no specific courseId is provided
    const allCourses = useQuery(api.courses.getUserCourses, !courseId && userId ? { userId } : 'skip');
    const latestCourse = courseId ? null : allCourses?.[0];
    const course = courseData || (latestCourse ? { ...latestCourse, topics: [] } : null);

    // Only fetch latest course topics when we don't have a direct courseId
    const latestCourseTopics = useQuery(
        api.courses.getCourseWithTopics,
        !courseId && latestCourse?._id ? { courseId: latestCourse._id } : 'skip'
    );

    const displayCourse = courseData || latestCourseTopics || course;
    const topics = Array.isArray(displayCourse?.topics) ? displayCourse.topics : EMPTY_LIST;
    const finalAssessmentTopics = Array.isArray(displayCourse?.finalAssessmentTopics)
        ? displayCourse.finalAssessmentTopics
        : EMPTY_LIST;
    const resolvedCourseId = displayCourse?._id;
    const courseProgress = useQuery(
        api.topics.getUserCourseProgress,
        resolvedCourseId && isConvexAuthenticated ? { courseId: resolvedCourseId } : 'skip'
    );
    const upload = useQuery(
        api.uploads.getUpload,
        displayCourse?.uploadId ? { uploadId: displayCourse.uploadId } : 'skip'
    );
    const plannedTopicTitles = Array.isArray(upload?.plannedTopicTitles) ? upload.plannedTopicTitles : EMPTY_LIST;
    const plannedTopicCountFromUpload = typeof upload?.plannedTopicCount === 'number' ? upload.plannedTopicCount : 0;
    const plannedCount = Math.max(plannedTopicCountFromUpload, plannedTopicTitles.length, topics.length);
    const generatedCountBase = Math.max(
        typeof upload?.generatedTopicCount === 'number' ? upload.generatedTopicCount : 0,
        topics.length
    );
    const generatedCount = plannedCount > 0
        ? Math.min(generatedCountBase, plannedCount)
        : generatedCountBase;
    const topicPercent = plannedCount > 0 ? Math.round((generatedCount / plannedCount) * 100) : 0;
    const firstTopicReady = generatedCount >= 1 || topics.length > 0 || upload?.processingStep === 'first_topic_ready';
    const shouldShowProcessing = Boolean(displayCourse && upload?.status === 'processing' && !firstTopicReady);
    const backgroundGenerationActive = Boolean(displayCourse && upload?.status === 'processing' && firstTopicReady);
    const showTopicProgress = Boolean(
        upload?.status === 'processing' &&
        plannedCount > 0 &&
        generatedCount < plannedCount
    );
    const backgroundGenerationMessage = (() => {
        if (!backgroundGenerationActive) return '';
        if (upload?.processingStep === 'generating_question_bank') {
            return 'Generating question banks in the background. You can keep studying while this completes.';
        }
        if (
            upload?.processingStep === 'generating_first_topic' ||
            upload?.processingStep === 'first_topic_ready' ||
            upload?.processingStep === 'generating_remaining_topics'
        ) {
            return 'Topic 1 is ready. Remaining topics are still being generated in the background.';
        }
        return 'Course generation is still running in the background. New topics will appear automatically.';
    })();
    const syllabusItems = (() => {
        if (!topics.length && plannedCount === 0) return [];

        const topicsByOrder = new Map(
            [...topics].sort((a, b) => a.orderIndex - b.orderIndex).map((topic) => [topic.orderIndex, topic])
        );

        return Array.from({ length: plannedCount }, (_, index) => {
            const topic = topicsByOrder.get(index);
            if (topic) {
                return {
                    kind: 'ready',
                    index,
                    topic,
                };
            }
            return {
                kind: 'pending',
                index,
                title: plannedTopicTitles[index] || `Topic ${index + 1}`,
            };
        });
    })();
    const [isProcessing, setIsProcessing] = React.useState(false);

    React.useEffect(() => {
        let timerId;
        if (shouldShowProcessing) {
            timerId = window.setTimeout(() => setIsProcessing(true), 900);
        } else {
            setIsProcessing(false);
        }

        return () => {
            if (timerId) {
                window.clearTimeout(timerId);
            }
        };
    }, [shouldShowProcessing, courseId]);

    return (
        <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-8 pb-24 md:pb-12">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-6">
                <Link to="/dashboard" className="text-body-sm text-text-faint-light dark:text-text-faint-dark hover:text-primary transition-colors">
                    Dashboard
                </Link>
                <span className="material-symbols-outlined text-[14px] text-text-faint-light dark:text-text-faint-dark">chevron_right</span>
                <span className="text-body-sm text-text-sub-light dark:text-text-sub-dark truncate max-w-[200px]">
                    {displayCourse?.title || 'Course'}
                </span>
            </div>

            {/* Course Header */}
            <div className="mb-8">
                {isProcessing ? (
                    <div className="card-base p-8 text-center">
                        <div className="relative w-14 h-14 mx-auto mb-5">
                            <div className="absolute inset-0 rounded-full border-[3px] border-border-light dark:border-border-dark" />
                            <div className="absolute inset-0 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
                            <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
                            </div>
                        </div>
                        <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-2">
                            Creating your course
                        </h1>
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-md mx-auto mb-6">
                            Analyzing your materials and building personalized lessons. This may take a few minutes.
                        </p>

                        {/* Progressive generation steps */}
                        {(() => {
                            const steps = [
                                { key: 'extracting', label: 'Extracting content', icon: 'upload_file' },
                                { key: 'analyzing', label: 'Analyzing materials', icon: 'analytics' },
                                { key: 'generating_topics', label: 'Outlining topics', icon: 'list_alt' },
                                { key: 'generating_first_topic', label: 'Building first lesson', icon: 'auto_stories' },
                                { key: 'first_topic_ready', label: 'First topic ready', icon: 'check_circle' },
                                { key: 'generating_remaining_topics', label: 'Generating remaining topics', icon: 'pending' },
                                { key: 'generating_question_bank', label: 'Creating practice questions', icon: 'quiz' },
                                { key: 'ready', label: 'All done', icon: 'task_alt' },
                            ];
                            const currentStep = upload?.processingStep || 'extracting';
                            const currentIdx = steps.findIndex(s => s.key === currentStep);
                            return (
                                <div className="max-w-xs mx-auto space-y-2">
                                    {steps.slice(0, Math.max(currentIdx + 2, 4)).map((step, i) => {
                                        const isDone = i < currentIdx;
                                        const isActive = i === currentIdx;
                                        return (
                                            <div key={step.key} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                                                isActive ? 'bg-primary/10 border border-primary/20' : isDone ? 'opacity-60' : 'opacity-30'
                                            }`}>
                                                <span className={`material-symbols-outlined text-[18px] ${
                                                    isDone ? 'text-accent-emerald' : isActive ? 'text-primary' : 'text-text-faint-light dark:text-text-faint-dark'
                                                }`} style={isDone ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                                                    {isDone ? 'check_circle' : step.icon}
                                                </span>
                                                <span className={`text-body-sm ${
                                                    isActive ? 'font-semibold text-text-main-light dark:text-text-main-dark' : 'text-text-sub-light dark:text-text-sub-dark'
                                                }`}>
                                                    {step.label}
                                                </span>
                                                {isActive && (
                                                    <span className="material-symbols-outlined text-[14px] text-primary animate-spin ml-auto">sync</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between gap-4 mb-2">
                            <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark">
                                {displayCourse?.title || 'Your Course'}
                            </h1>
                            {backgroundGenerationActive && (
                                <span className="shrink-0 badge badge-primary flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                    Generating
                                </span>
                            )}
                        </div>

                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-4">
                            {plannedCount > 0
                                ? `${generatedCount} of ${plannedCount} topics ready`
                                : `${topics.length} topic${topics.length === 1 ? '' : 's'} available`
                            }
                        </p>

                        {showTopicProgress && (
                            <div className="max-w-lg mb-4">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-caption text-text-sub-light dark:text-text-sub-dark">Progress</span>
                                    <span className="text-caption font-semibold text-primary">{topicPercent}%</span>
                                </div>
                                <div className="h-1.5 bg-border-light dark:bg-border-dark rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all duration-500"
                                        style={{ width: `${topicPercent}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {backgroundGenerationActive && backgroundGenerationMessage && (
                            <div className="max-w-lg p-3 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/15 dark:border-primary/20 flex items-start gap-2.5">
                                <span className="material-symbols-outlined text-primary text-[16px] mt-0.5">info</span>
                                <p className="text-caption text-text-sub-light dark:text-text-sub-dark">
                                    {backgroundGenerationMessage}
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Action prompt (deep-linked from dashboard quick actions) */}
            {!isProcessing && actionPrompt && (
                <div className="mb-6 p-4 rounded-2xl border border-primary/20 bg-primary/5 dark:bg-primary/10 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {actionPrompt.icon}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                            {actionPrompt.title}
                        </p>
                        <p className="text-caption text-text-sub-light dark:text-text-sub-dark mt-0.5">
                            {actionPrompt.description}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={dismissActionBanner}
                        className="btn-icon !p-1 shrink-0"
                        aria-label="Dismiss"
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
            )}

            {/* Sources Panel */}
            {!isProcessing && displayCourse?._id && (
                <SourcesPanel
                    courseId={displayCourse._id}
                    userId={userId}
                />
            )}

            {!isProcessing && finalAssessmentTopics.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-primary text-[18px]">workspace_premium</span>
                        <h2 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">
                            Final Exam
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {finalAssessmentTopics.map((topic) => {
                            const progress = courseProgress?.[topic._id];
                            return (
                                <div key={topic._id} className="card-base p-5 border-primary/20 bg-primary/5 dark:bg-primary/10">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <span className="badge badge-primary gap-1">
                                            <span className="material-symbols-outlined text-[11px]">quiz</span>
                                            Comprehensive
                                        </span>
                                        {progress?.bestScore != null && (
                                            <span className={`badge gap-1 ${progress.bestScore >= 80 ? 'badge-success' : progress.bestScore >= 60 ? 'badge-warning' : 'badge-danger'}`}>
                                                {progress.bestScore}%
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">
                                        {topic.title}
                                    </h3>
                                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-4">
                                        {topic.description || 'This exam combines the most important concepts across the document.'}
                                    </p>
                                    <Link
                                        to={buildObjectiveExamRoute(topic._id)}
                                        reloadDocument
                                        className="btn-primary w-full py-2 text-body-sm justify-center gap-1.5"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                                        {progress?.bestScore != null ? 'Retake Final Exam' : 'Start Final Exam'}
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Topics Grid */}
            <div id="course-topics" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {syllabusItems.length > 0 ? (
                    syllabusItems.map((item) => {
                        if (item.kind === 'pending') {
                            return (
                                <div
                                    key={`pending-${item.index}`}
                                    className="card-base border-dashed p-5 opacity-70"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-overline text-text-faint-light dark:text-text-faint-dark">
                                            Topic {item.index + 1}
                                        </span>
                                        <span className="flex items-center gap-1 text-caption text-accent-amber">
                                            <span className="material-symbols-outlined text-[12px] animate-spin">sync</span>
                                            Generating
                                        </span>
                                    </div>
                                    <h3 className="text-body-base font-semibold text-text-sub-light dark:text-text-sub-dark mb-1">
                                        {item.title}
                                    </h3>
                                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                        Will appear shortly.
                                    </p>
                                </div>
                            );
                        }

                        const topic = item.topic;
                        const topicIllustrationUrl = resolveTopicIllustrationUrl(topic.illustrationUrl);
                        const progress = courseProgress?.[topic._id];
                        const isCompleted = Boolean(progress?.completedAt);
                        const isStarted = Boolean(progress) && !isCompleted;
                        const readMins = estimateReadingMinutes(topic.content);
                        const mcqCount = typeof topic.usableMcqCount === 'number' ? topic.usableMcqCount : 0;
                        const assessmentRoute = topic.assessmentRoute || 'topic_quiz';
                        const routeBadge = assessmentRoute === 'topic_quiz'
                            ? { label: 'Quiz Ready', className: 'badge-success' }
                            : { label: 'Final Exam', className: 'badge-primary' };

                        // Smart badges
                        const isExamHeavy = mcqCount >= 15;
                        const isFoundational = item.index === 0;
                        const isEasyWin = readMins && readMins <= 5 && !isCompleted;

                        // Status + CTA
                        const statusConfig = isCompleted
                            ? { icon: 'check_circle', fill: true, color: 'text-accent-emerald', label: 'Completed', cta: 'Review', ctaClass: 'btn-secondary' }
                            : isStarted
                                ? { icon: 'pending', fill: false, color: 'text-primary', label: 'In progress', cta: 'Continue', ctaClass: 'btn-primary' }
                                : { icon: 'radio_button_unchecked', fill: false, color: 'text-text-faint-light dark:text-text-faint-dark', label: 'Ready', cta: 'Start', ctaClass: 'btn-primary' };

                        return (
                            <div
                                key={topic._id}
                                className="card-base p-0 overflow-hidden flex flex-col"
                            >
                                <Link to={`/dashboard/topic/${topic._id}`} className="block group">
                                    <div className="h-32 overflow-hidden relative">
                                        <img
                                            src={topicIllustrationUrl}
                                            alt={`${topic.title} illustration`}
                                            loading="lazy"
                                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                        {/* Status pill overlay */}
                                        <div className="absolute top-2.5 right-2.5">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm ${
                                                isCompleted
                                                    ? 'bg-accent-emerald/90 text-white'
                                                    : isStarted
                                                        ? 'bg-primary/90 text-white'
                                                        : 'bg-black/50 text-white/90'
                                            }`}>
                                                <span className="material-symbols-outlined text-[12px]" style={statusConfig.fill ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                                                    {statusConfig.icon}
                                                </span>
                                                {statusConfig.label}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                                <div className="p-4 flex flex-col flex-1">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-overline text-text-faint-light dark:text-text-faint-dark">
                                            Topic {item.index + 1}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {isFoundational && (
                                                <span className="badge badge-primary gap-0.5 text-[9px]">
                                                    <span className="material-symbols-outlined text-[10px]">foundation</span>
                                                    Foundational
                                                </span>
                                            )}
                                            {isExamHeavy && (
                                                <span className="badge badge-warning gap-0.5 text-[9px]">
                                                    <span className="material-symbols-outlined text-[10px]">quiz</span>
                                                    Exam-heavy
                                                </span>
                                            )}
                                            {isEasyWin && (
                                                <span className="badge badge-success gap-0.5 text-[9px]">
                                                    <span className="material-symbols-outlined text-[10px]">bolt</span>
                                                    Easy win
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Link to={`/dashboard/topic/${topic._id}`} className="group">
                                        <h3 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark mb-1 group-hover:text-primary transition-colors line-clamp-2">
                                            {topic.title}
                                        </h3>
                                    </Link>
                                    <p className="text-caption text-text-sub-light dark:text-text-sub-dark line-clamp-2 mb-3">
                                        {topic.description || `Master the key concepts of ${topic.title}.`}
                                    </p>
                                    {/* Metadata row */}
                                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                                        <span className={`badge gap-1 ${routeBadge.className}`}>
                                            <span className="material-symbols-outlined text-[11px]">task_alt</span>
                                            {routeBadge.label}
                                        </span>
                                        {readMins && (
                                            <span className="badge gap-1">
                                                <span className="material-symbols-outlined text-[11px]">schedule</span>
                                                {readMins}m
                                            </span>
                                        )}
                                        {mcqCount > 0 && (
                                            <span className="badge gap-1">
                                                <span className="material-symbols-outlined text-[11px]">quiz</span>
                                                {mcqCount}q
                                            </span>
                                        )}
                                        {progress?.bestScore != null && (
                                            <span className={`badge gap-1 ${progress.bestScore >= 80 ? 'badge-success' : progress.bestScore >= 60 ? 'badge-warning' : 'badge-danger'}`}>
                                                {progress.bestScore}%
                                            </span>
                                        )}
                                    </div>
                                    {/* Progress bar */}
                                    {progress?.bestScore != null && (
                                        <div className="h-1 bg-border-light dark:bg-border-dark rounded-full overflow-hidden mb-3">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    progress.bestScore >= 80 ? 'bg-accent-emerald' : progress.bestScore >= 60 ? 'bg-accent-amber' : 'bg-red-500'
                                                }`}
                                                style={{ width: `${progress.bestScore}%` }}
                                            />
                                        </div>
                                    )}
                                    {/* Primary CTA */}
                                    <div className="mt-auto pt-1">
                                        <Link
                                            to={`/dashboard/topic/${topic._id}`}
                                            className={`${statusConfig.ctaClass} w-full py-2 text-body-sm justify-center gap-1.5`}
                                        >
                                            <span className="material-symbols-outlined text-[16px]">
                                                {isCompleted ? 'replay' : isStarted ? 'play_arrow' : 'arrow_forward'}
                                            </span>
                                            {statusConfig.cta}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    /* Loading Skeleton */
                    Array.from({ length: displayCourse?.plannedCount || topics?.length || 6 }, (_, i) => (
                        <div key={i} className="card-base p-0 overflow-hidden animate-pulse">
                            <div className="h-32 bg-surface-hover-light dark:bg-surface-hover-dark" />
                            <div className="p-4 space-y-2">
                                <div className="h-3 w-16 bg-border-light dark:bg-border-dark rounded" />
                                <div className="h-5 w-3/4 bg-border-light dark:bg-border-dark rounded" />
                                <div className="h-3 w-full bg-border-light dark:bg-border-dark rounded" />
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Empty State */}
            {syllabusItems.length === 0 && !isProcessing && (
                <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-2xl text-text-faint-light dark:text-text-faint-dark">school</span>
                    </div>
                    <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">No topics yet</h3>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-sm mx-auto">
                        Your course is being prepared. Topics will appear here once they&apos;re ready.
                    </p>
                </div>
            )}
        </div>
    );
};

export { DashboardCourse };
export default DashboardCourse;
