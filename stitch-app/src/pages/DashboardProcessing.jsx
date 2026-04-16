import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { addSentryBreadcrumb, captureSentryMessage } from '../lib/sentry';
import {
    shouldAutoNavigateFromProcessing,
    shouldShowProcessingConfirmation,
} from '../lib/processingNavigation';

// Processing steps configuration
const PROCESSING_STEPS = [
    { key: 'uploading', label: 'Uploading', icon: 'cloud_upload', description: 'Uploading your file...' },
    { key: 'extracting', label: 'Extracting', icon: 'description', description: 'Extracting content from document...' },
    { key: 'analyzing', label: 'Analyzing', icon: 'psychology', description: 'AI is analyzing your materials...' },
    { key: 'generating_topics', label: 'Outline', icon: 'auto_awesome', description: 'Creating course structure...' },
    { key: 'generating_first_topic', label: 'Topic 1', icon: 'menu_book', description: 'Writing the first detailed topic...' },
    { key: 'first_topic_ready', label: 'First Topic Ready', icon: 'rocket_launch', description: 'Topic 1 is ready. Opening your course...' },
    { key: 'generating_remaining_topics', label: 'Remaining Topics', icon: 'library_books', description: 'Generating the remaining topics in the background...' },
    { key: 'generating_question_bank', label: 'Question Banks', icon: 'quiz', description: 'Building large question banks for each topic...' },
    { key: 'ready', label: 'Ready', icon: 'check_circle', description: 'Your course is ready!' },
];

const DashboardProcessing = () => {
    const { courseId } = useParams();
    const { user } = useAuth();
    const userId = user?.id;
    const navigate = useNavigate();
    const processUploadedFile = useAction(api.ai.processUploadedFile);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const lastStepLogKeyRef = useRef('');
    const autoNavigatedRef = useRef(false);
    const terminalStatusLoggedRef = useRef(new Set());
    const processingKickoffRetryRef = useRef({ uploadId: '', attempted: false });

    // Get course with topics
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

    // Get upload to track processing progress
    const upload = useQuery(
        api.uploads.getUpload,
        course?.uploadId ? { uploadId: course.uploadId } : 'skip'
    );

    const displayCourse = courseData || latestCourseTopics || course;
    const topics = displayCourse?.topics || [];
    const hasTopics = topics.length > 0;
    const hasError = upload?.status === 'error';
    const shouldRenderConfirmation = shouldShowProcessingConfirmation({
        upload,
        hasTopics,
    });
    const resolvedCourseId = displayCourse?._id || courseId || latestCourse?._id;

    // Get current processing step info
    const currentStep = upload?.processingStep || 'uploading';
    const progress = upload?.processingProgress || 0;
    const rawStepIndex = PROCESSING_STEPS.findIndex(s => s.key === currentStep);
    const currentStepIndex = rawStepIndex >= 0 ? rawStepIndex : 0;
    const currentStepInfo = PROCESSING_STEPS[currentStepIndex];

    // Show confirmation when ready and we have at least first-topic readiness metadata.
    useEffect(() => {
        const delayMs = shouldRenderConfirmation ? 500 : 0;
        const timer = window.setTimeout(() => {
            setShowConfirmation(shouldRenderConfirmation);
        }, delayMs);
        return () => window.clearTimeout(timer);
    }, [shouldRenderConfirmation]);

    // Reset route-scoped UI state for every new processing run.
    useEffect(() => {
        autoNavigatedRef.current = false;
        const resetTimer = window.setTimeout(() => {
            setShowConfirmation(false);
        }, 0);
        return () => window.clearTimeout(resetTimer);
    }, [courseId]);

    useEffect(() => {
        if (shouldAutoNavigateFromProcessing({
            upload,
            hasTopics,
            autoNavigated: autoNavigatedRef.current,
            resolvedCourseId,
        })) {
            autoNavigatedRef.current = true;
            navigate(`/dashboard/course/${resolvedCourseId}`);
        }
    }, [upload, resolvedCourseId, navigate, hasTopics]);

    useEffect(() => {
        if (!upload?._id) return;

        const uploadId = String(upload._id);
        const status = String(upload.status || 'unknown');
        const processingStep = String(upload.processingStep || 'uploading');
        const processingProgress = typeof upload.processingProgress === 'number' ? upload.processingProgress : null;
        const stepLogKey = `${uploadId}:${status}:${processingStep}`;

        if (lastStepLogKeyRef.current !== stepLogKey) {
            lastStepLogKeyRef.current = stepLogKey;
            addSentryBreadcrumb({
                category: 'upload',
                message: 'Upload processing step updated',
                data: {
                    uploadId,
                    courseId: resolvedCourseId ? String(resolvedCourseId) : undefined,
                    status,
                    processingStep,
                    processingProgress,
                },
            });
        }

        if (status === 'error') {
            const errorLogKey = `${uploadId}:error`;
            if (!terminalStatusLoggedRef.current.has(errorLogKey)) {
                terminalStatusLoggedRef.current.add(errorLogKey);
                captureSentryMessage('Upload processing failed', {
                    level: 'warning',
                    tags: {
                        area: 'upload',
                        operation: 'processing_failed',
                        flowType: 'study_material',
                        source: 'dashboard_processing',
                        processingStep,
                        uploadId,
                    },
                    extras: {
                        uploadId,
                        courseId: resolvedCourseId ? String(resolvedCourseId) : undefined,
                        status,
                        processingProgress,
                        generatedTopicCount: upload.generatedTopicCount,
                        plannedTopicCount: upload.plannedTopicCount,
                        errorMessage: upload.errorMessage || '',
                        elapsedMs: typeof upload._creationTime === 'number'
                            ? Math.max(0, Date.now() - upload._creationTime)
                            : null,
                    },
                });
            }
        }

        if (status === 'ready') {
            const readyLogKey = `${uploadId}:ready`;
            if (!terminalStatusLoggedRef.current.has(readyLogKey)) {
                terminalStatusLoggedRef.current.add(readyLogKey);
                captureSentryMessage('Upload processing ready', {
                    level: 'info',
                    tags: {
                        area: 'upload',
                        operation: 'processing_ready',
                        flowType: 'study_material',
                        source: 'dashboard_processing',
                        uploadId,
                    },
                    extras: {
                        uploadId,
                        courseId: resolvedCourseId ? String(resolvedCourseId) : undefined,
                        status,
                        processingStep,
                        processingProgress,
                        generatedTopicCount: upload.generatedTopicCount,
                        plannedTopicCount: upload.plannedTopicCount,
                        elapsedMs: typeof upload._creationTime === 'number'
                            ? Math.max(0, Date.now() - upload._creationTime)
                            : null,
                    },
                });
            }
        }
    }, [
        resolvedCourseId,
        upload?._id,
        upload?.status,
        upload?.processingStep,
        upload?.processingProgress,
        upload?.generatedTopicCount,
        upload?.plannedTopicCount,
        upload?.errorMessage,
        upload?._creationTime,
    ]);

    const handleStartLearning = () => {
        if (resolvedCourseId) {
            navigate(`/dashboard/course/${resolvedCourseId}`);
        }
    };

    useEffect(() => {
        const uploadId = upload?._id ? String(upload._id) : '';
        if (!uploadId) {
            processingKickoffRetryRef.current = { uploadId: '', attempted: false };
            return;
        }
        if (processingKickoffRetryRef.current.uploadId !== uploadId) {
            processingKickoffRetryRef.current = { uploadId, attempted: false };
        }
    }, [upload?._id]);

    useEffect(() => {
        if (!upload?._id || !resolvedCourseId || !userId) return undefined;
        if (upload.status !== 'processing') return undefined;
        if (upload.processingStep) return undefined;
        if (processingKickoffRetryRef.current.attempted) return undefined;

        const retryTimer = window.setTimeout(() => {
            if (processingKickoffRetryRef.current.attempted) return;
            processingKickoffRetryRef.current.attempted = true;

            const uploadId = String(upload._id);
            addSentryBreadcrumb({
                category: 'upload',
                message: 'Upload processing kickoff retry triggered',
                level: 'warning',
                data: {
                    uploadId,
                    courseId: String(resolvedCourseId),
                    userId: String(userId),
                    status: String(upload.status || ''),
                    processingStep: String(upload.processingStep || ''),
                },
            });

            processUploadedFile({
                uploadId: upload._id,
                courseId: resolvedCourseId,
                userId,
            }).catch((error) => {
                captureSentryMessage('Upload processing kickoff retry failed', {
                    level: 'error',
                    tags: {
                        area: 'upload',
                        operation: 'processing_kickoff_retry_failed',
                        source: 'dashboard_processing',
                        uploadId,
                    },
                    extras: {
                        uploadId,
                        courseId: String(resolvedCourseId),
                        userId: String(userId),
                        errorMessage: error instanceof Error ? error.message : String(error),
                    },
                });
            });
        }, 12000);

        return () => window.clearTimeout(retryTimer);
    }, [
        processUploadedFile,
        resolvedCourseId,
        upload?._id,
        upload?.processingStep,
        upload?.status,
        userId,
    ]);

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col">
            <header className="sticky top-0 z-30 w-full bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark">
                <div className="w-full max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
                    <Link to="/dashboard" aria-label="Go back to dashboard" className="btn-ghost inline-flex items-center gap-2 px-3 py-1.5 text-body-sm">
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        <span className="hidden sm:inline">Dashboard</span>
                    </Link>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/8 text-primary">
                        <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
                        <span className="text-caption font-semibold">Processing</span>
                    </div>
                    <Link to="/profile" className="btn-icon w-9 h-9 rounded-full bg-primary/8 text-primary text-caption font-bold">
                        {user?.name?.[0]?.toUpperCase() || 'S'}
                    </Link>
                </div>
            </header>

            <main className="w-full max-w-3xl mx-auto flex-1 px-4 py-8 flex flex-col items-center justify-center">
                {!showConfirmation ? (
                    <div className="w-full flex flex-col items-center text-center">
                        <div className="w-full card-base p-8 md:p-12">
                            {/* Header */}
                            <div className="mb-8">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 mb-6">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                    </span>
                                    <span className="text-primary text-caption font-semibold">Processing</span>
                                </div>

                                <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-2">
                                    Creating Your Course
                                </h1>
                                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                    Our AI is analyzing your materials and building your personalized learning experience
                                </p>
                            </div>

                            {/* Current Step Visual */}
                            <div className="mb-8">
                                <div className="relative w-20 h-20 mx-auto mb-6">
                                    <div className="absolute inset-0 rounded-full border-2 border-border-light dark:border-border-dark"></div>
                                    <div
                                        className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"
                                        style={{ animationDuration: '2s' }}
                                    ></div>
                                    <div className="absolute inset-2 rounded-full bg-primary flex items-center justify-center text-white">
                                        <span className="material-symbols-outlined text-[28px]">{currentStepInfo.icon}</span>
                                    </div>
                                </div>

                                <div className="space-y-1" aria-live="polite">
                                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">
                                        {currentStepInfo.label}
                                    </h2>
                                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-md mx-auto">
                                        {currentStepInfo.description}
                                    </p>
                                </div>
                            </div>

                            {/* Progress Display */}
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-caption font-medium text-text-faint-light dark:text-text-faint-dark">Progress</span>
                                    <span className="text-display-sm text-text-main-light dark:text-text-main-dark">{progress}%</span>
                                </div>
                                <div className="h-2 bg-surface-hover-light dark:bg-surface-hover-dark rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all duration-700 ease-out relative"
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Steps Indicator */}
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                {PROCESSING_STEPS.slice(0, 6).map((step, index) => {
                                    const isCompleted = index < currentStepIndex;
                                    const isCurrent = index === currentStepIndex;

                                    return (
                                        <div key={step.key} className="flex items-center">
                                            <div
                                                className={`w-7 h-7 rounded-full flex items-center justify-center text-caption font-bold transition-all duration-300 ${
                                                    isCompleted
                                                        ? 'bg-accent-emerald/10 text-accent-emerald'
                                                        : isCurrent
                                                            ? 'bg-primary text-white scale-110'
                                                            : 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-faint-light dark:text-text-faint-dark'
                                                }`}
                                                title={step.label}
                                            >
                                                {isCompleted ? (
                                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                                ) : (
                                                    index + 1
                                                )}
                                            </div>
                                            {index < 5 && (
                                                <div className={`w-4 h-0.5 mx-1 ${
                                                    isCompleted ? 'bg-accent-emerald/30' : 'bg-border-light dark:bg-border-dark'
                                                }`}></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Extraction Warnings */}
                            {upload?.extractionWarnings?.length > 0 && !hasError && (
                                <div className="mt-6 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                                    <div className="flex items-start gap-2.5">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">info</span>
                                        <div className="text-left">
                                            <p className="text-body-sm font-semibold text-amber-800 dark:text-amber-300">Heads up</p>
                                            {upload.extractionWarnings.map((w, i) => (
                                                <p key={i} className="text-caption text-amber-700 dark:text-amber-400 mt-1">{w}</p>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Error State */}
                            {hasError && (
                                <div className="mt-6 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                                    <div className="flex items-start gap-2.5">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px] mt-0.5">warning</span>
                                        <div className="text-left">
                                            <p className="text-body-sm font-semibold text-amber-800 dark:text-amber-300">
                                                Processing encountered an issue
                                            </p>
                                            <p className="text-caption text-amber-700 dark:text-amber-400 mt-1">
                                                {hasTopics
                                                    ? 'Opening the content that finished processing...'
                                                    : 'We could not finish processing this upload. Try uploading again after the extraction service is configured.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tip Card */}
                        <div className="mt-5 flex items-start gap-2.5 max-w-lg mx-auto text-left px-4">
                            <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">lightbulb</span>
                            <p className="text-caption text-text-sub-light dark:text-text-sub-dark">
                                <span className="font-medium text-text-main-light dark:text-text-main-dark">Tip:</span> You can leave this page. We'll notify you when your course is ready.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="w-full flex flex-col items-center text-center">
                        <div className="w-full card-base p-8 md:p-12">
                            {/* Success Icon */}
                            <div className="relative w-16 h-16 mx-auto mb-5">
                                <div className="absolute inset-0 rounded-full bg-accent-emerald/10 animate-ping opacity-50"></div>
                                <div className="relative w-full h-full rounded-full bg-accent-emerald flex items-center justify-center text-white">
                                    <span className="material-symbols-outlined text-[28px]">check</span>
                                </div>
                            </div>

                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-emerald/10 mb-4">
                                <span className="material-symbols-outlined text-accent-emerald text-[14px]">verified</span>
                                <span className="text-accent-emerald text-caption font-semibold uppercase tracking-wide">Ready</span>
                            </div>

                            <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-2">
                                {displayCourse?.title || 'Your Course'}
                            </h1>
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-md mx-auto mb-8">
                                {displayCourse?.description || 'AI-generated course from your study materials'}
                            </p>

                            {/* Stats */}
                            <div className="flex items-center justify-center gap-3 mb-8">
                                <div className="flex items-center gap-3 card-base px-4 py-3">
                                    <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary text-[18px]">menu_book</span>
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">{topics.length}</span>
                                        <span className="text-caption text-text-faint-light dark:text-text-faint-dark">Topics</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 card-base px-4 py-3">
                                    <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary text-[18px]">quiz</span>
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">{topics.length * 10}+</span>
                                        <span className="text-caption text-text-faint-light dark:text-text-faint-dark">Questions</span>
                                    </div>
                                </div>
                            </div>

                            {/* Topics Preview */}
                            {topics.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-overline text-text-faint-light dark:text-text-faint-dark mb-3">
                                        What's Inside
                                    </h3>
                                    <div className="space-y-2 max-w-md mx-auto">
                                        {topics.slice(0, 3).map((topic, index) => (
                                            <div
                                                key={topic._id}
                                                className="flex items-center gap-3 bg-surface-hover-light dark:bg-surface-hover-dark p-3 rounded-xl text-left"
                                            >
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-caption font-bold ${
                                                    index === 0
                                                        ? 'bg-primary'
                                                        : 'bg-text-faint-light dark:bg-text-faint-dark'
                                                }`}>
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark truncate">{topic.title}</h4>
                                                </div>
                                                <span className="badge badge-success">
                                                    Ready
                                                </span>
                                            </div>
                                        ))}
                                        {topics.length > 3 && (
                                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark py-2">
                                                +{topics.length - 3} more topics
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleStartLearning}
                                className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 text-body-base"
                            >
                                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                                Start Learning
                            </button>
                        </div>

                        <div className="mt-5">
                            <Link
                                to="/dashboard"
                                className="text-body-sm text-text-faint-light dark:text-text-faint-dark hover:text-text-main-light dark:hover:text-text-main-dark transition-colors"
                            >
                                Back to Dashboard
                            </Link>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export { DashboardProcessing };
export default DashboardProcessing;
