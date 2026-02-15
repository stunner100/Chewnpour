import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
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
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [autoNavigated, setAutoNavigated] = useState(false);
    const lastStepLogKeyRef = useRef('');
    const terminalStatusLoggedRef = useRef(new Set());

    // Get course with topics
    const courseData = useQuery(
        api.courses.getCourseWithTopics,
        courseId ? { courseId } : 'skip'
    );

    // Get all user courses if no specific course is selected
    const allCourses = useQuery(api.courses.getUserCourses, userId ? { userId } : 'skip');
    const latestCourse = courseId ? null : allCourses?.[0];
    const course = courseData || (latestCourse ? { ...latestCourse, topics: [] } : null);

    // If we have a latest course but no topics yet, fetch its topics
    const latestCourseTopics = useQuery(
        api.courses.getCourseWithTopics,
        latestCourse?._id ? { courseId: latestCourse._id } : 'skip'
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
        if (shouldRenderConfirmation && !showConfirmation) {
            const timer = setTimeout(() => {
                setShowConfirmation(true);
            }, 500);
            return () => clearTimeout(timer);
        }
        if (!shouldRenderConfirmation && showConfirmation) {
            setShowConfirmation(false);
        }
        return undefined;
    }, [shouldRenderConfirmation, showConfirmation]);

    // Reset route-scoped UI state for every new processing run.
    useEffect(() => {
        setShowConfirmation(false);
        setAutoNavigated(false);
    }, [courseId]);

    useEffect(() => {
        if (shouldAutoNavigateFromProcessing({
            upload,
            hasTopics,
            autoNavigated,
            resolvedCourseId,
        })) {
            setAutoNavigated(true);
            navigate(`/dashboard/course/${resolvedCourseId}`);
        }
    }, [upload, resolvedCourseId, autoNavigated, navigate, hasTopics]);

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

    return (
        <div className="bg-background-light dark:bg-background-dark font-body antialiased min-h-screen flex flex-col transition-colors duration-300">
            {/* Modern gradient background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30"></div>
                <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-gradient-to-tr from-blue-500/5 to-transparent rounded-full blur-3xl"></div>
            </div>

            <header className="sticky top-0 z-30 w-full glass border-b border-slate-200/50 dark:border-slate-800/50">
                <div className="w-full max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
                    <Link to="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span className="text-sm font-medium hidden sm:inline">Dashboard</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                            <span className="material-symbols-outlined text-orange-500 text-lg filled">local_fire_department</span>
                            <span className="text-slate-700 dark:text-slate-200 text-xs font-bold">Processing</span>
                        </div>
                    </div>
                    <Link to="/profile" className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-500 p-0.5">
                        <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                            <span className="text-primary font-bold text-xs">{user?.name?.[0]?.toUpperCase() || 'S'}</span>
                        </div>
                    </Link>
                </div>
            </header>

            <main className="w-full max-w-3xl mx-auto flex-1 px-4 py-8 flex flex-col items-center justify-center">
                {!showConfirmation ? (
                    /* Processing State */
                    <div className="w-full flex flex-col items-center text-center animate-slide-up">
                        {/* Modern Processing Card */}
                        <div className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 md:p-12">
                            {/* Header */}
                            <div className="mb-8">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 mb-6">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                    </span>
                                    <span className="text-blue-600 dark:text-blue-400 text-sm font-semibold">Processing</span>
                                </div>
                                
                                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                                    Creating Your Course
                                </h1>
                                <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base">
                                    Our AI is analyzing your materials and building your personalized learning experience
                                </p>
                            </div>

                            {/* Current Step Visual */}
                            <div className="mb-8">
                                <div className="relative w-24 h-24 mx-auto mb-6">
                                    <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800"></div>
                                    <div 
                                        className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"
                                        style={{ animationDuration: '2s' }}
                                    ></div>
                                    <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
                                        <span className="material-symbols-outlined text-3xl">{currentStepInfo.icon}</span>
                                    </div>
                                </div>

                                {/* Step Info */}
                                <div className="space-y-2">
                                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                        {currentStepInfo.label}
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
                                        {currentStepInfo.description}
                                    </p>
                                </div>
                            </div>

                            {/* Progress Display */}
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Progress</span>
                                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{progress}%</span>
                                </div>
                                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-700 ease-out relative"
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
                                    const isPending = index > currentStepIndex;
                                    
                                    return (
                                        <div key={step.key} className="flex items-center">
                                            <div 
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                                                    isCompleted 
                                                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                                                        : isCurrent 
                                                            ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25 scale-110' 
                                                            : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                                                }`}
                                                title={step.label}
                                            >
                                                {isCompleted ? (
                                                    <span className="material-symbols-outlined text-sm">check</span>
                                                ) : (
                                                    index + 1
                                                )}
                                            </div>
                                            {index < 5 && (
                                                <div className={`w-4 h-0.5 mx-1 ${
                                                    isCompleted ? 'bg-green-200' : 'bg-slate-100 dark:bg-slate-800'
                                                }`}></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Error State */}
                            {hasError && (
                                <div className="mt-8 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                                    <div className="flex items-start gap-3">
                                        <span className="material-symbols-outlined text-amber-500 text-xl">warning</span>
                                        <div className="text-left">
                                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                                                Processing encountered an issue
                                            </p>
                                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                                Redirecting to available content...
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tip Card */}
                        <div className="mt-6 flex items-start gap-3 max-w-lg mx-auto text-left px-4">
                            <span className="material-symbols-outlined text-blue-500 text-xl shrink-0">lightbulb</span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                <span className="font-medium text-slate-700 dark:text-slate-300">Tip:</span> You can leave this page. We'll notify you when your course is ready.
                            </p>
                        </div>
                    </div>
                ) : (
                    /* Success State - Course Ready */
                    <div className="w-full flex flex-col items-center text-center animate-slide-up">
                        {/* Success Card */}
                        <div className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 md:p-12">
                            {/* Success Icon */}
                            <div className="relative w-20 h-20 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full bg-green-100 dark:bg-green-900/20 animate-ping opacity-50"></div>
                                <div className="relative w-full h-full rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-green-500/30">
                                    <span className="material-symbols-outlined text-4xl">check</span>
                                </div>
                            </div>

                            {/* Badge */}
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 mb-4">
                                <span className="material-symbols-outlined text-green-500 text-sm">verified</span>
                                <span className="text-green-600 dark:text-green-400 text-xs font-semibold uppercase tracking-wide">Ready</span>
                            </div>

                            {/* Course Info */}
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                                {displayCourse?.title || 'Your Course'}
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-md mx-auto mb-8">
                                {displayCourse?.description || 'AI-generated course from your study materials'}
                            </p>

                            {/* Stats */}
                            <div className="flex items-center justify-center gap-4 mb-8">
                                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-2xl">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-blue-600">menu_book</span>
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-xl font-bold text-slate-900 dark:text-white">{topics.length}</span>
                                        <span className="text-xs text-slate-500">Topics</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-2xl">
                                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-purple-600">quiz</span>
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-xl font-bold text-slate-900 dark:text-white">{topics.length * 10}+</span>
                                        <span className="text-xs text-slate-500">Questions</span>
                                    </div>
                                </div>
                            </div>

                            {/* Topics Preview */}
                            {topics.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                                        What's Inside
                                    </h3>
                                    <div className="space-y-2 max-w-md mx-auto">
                                        {topics.slice(0, 3).map((topic, index) => (
                                            <div
                                                key={topic._id}
                                                className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-left"
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                                                    index === 0 
                                                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                                                        : 'bg-slate-300 dark:bg-slate-600'
                                                }`}>
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm truncate">{topic.title}</h4>
                                                </div>
                                                <span className="text-xs font-medium px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    Ready
                                                </span>
                                            </div>
                                        ))}
                                        {topics.length > 3 && (
                                            <p className="text-xs text-slate-400 py-2">
                                                +{topics.length - 3} more topics
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* CTA Button */}
                            <button
                                onClick={handleStartLearning}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                            >
                                <span className="material-symbols-outlined">play_arrow</span>
                                Start Learning
                            </button>
                        </div>

                        {/* Additional Actions */}
                        <div className="mt-6 flex items-center gap-4">
                            <Link 
                                to="/dashboard" 
                                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
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

export default DashboardProcessing;
