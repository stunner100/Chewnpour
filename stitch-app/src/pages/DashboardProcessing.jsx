import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
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
    const isProcessing = !displayCourse || upload?.status === 'processing';
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

    const handleStartLearning = () => {
        if (resolvedCourseId) {
            navigate(`/dashboard/course/${resolvedCourseId}`);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-body antialiased min-h-screen flex flex-col transition-colors duration-300 overflow-hidden">
            {/* Animated background particles */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/3 to-transparent rounded-full blur-2xl"></div>
            </div>

            <header className="sticky top-0 z-30 w-full glass border-b border-slate-200/50 dark:border-slate-800/50">
                <div className="w-full max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
                    <Link to="/dashboard" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-primary transition-all cursor-pointer">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-slate-200/50 dark:border-slate-700/50 cursor-default">
                        <span className="material-symbols-outlined text-orange-500 text-[20px] filled icon-filled animate-pulse-subtle" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                        <span className="text-slate-700 dark:text-slate-200 text-sm font-bold tracking-tight">12</span>
                    </div>
                    <Link to="/profile" className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white dark:border-slate-700 shadow-md ring-2 ring-transparent hover:ring-primary/20 transition-all">
                        <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary flex items-center justify-center text-white font-bold text-sm">
                            {user?.name?.[0]?.toUpperCase() || 'S'}
                        </div>
                    </Link>
                </div>
            </header>

            <main className="w-full max-w-7xl mx-auto flex-1 px-6 py-12 flex flex-col items-center justify-center">
                {!showConfirmation ? (
                    /* Processing State */
                    <div className="flex flex-col items-center justify-center max-w-2xl mx-auto text-center animate-slide-up">
                        {/* Animated Icon */}
                        <div className="relative mb-8">
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center animate-pulse" style={{ animationDuration: '2s' }}>
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary text-5xl animate-bounce" style={{ animationDuration: '2s' }}>
                                        {currentStepInfo.icon}
                                    </span>
                                </div>
                            </div>
                            {/* Orbiting dots */}
                            <div className="absolute inset-0 animate-spin" style={{ animationDuration: '8s' }}>
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full"></div>
                            </div>
                            <div className="absolute inset-0 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}>
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-purple-500 rounded-full"></div>
                            </div>
                        </div>

                        {/* Progress Percentage */}
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-5xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">
                                {progress}%
                            </span>
                        </div>

                        {/* Current Step Label */}
                        <div className="flex items-center gap-2 mb-4 bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                            </span>
                            <span className="text-primary font-bold text-sm tracking-wide">{currentStepInfo.label}</span>
                        </div>

                        <p className="text-slate-500 dark:text-slate-400 text-lg font-medium mb-8">
                            {currentStepInfo.description}
                        </p>

                        {hasError && (
                            <div className="mb-8 w-full max-w-lg rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left text-sm font-medium text-amber-800">
                                Processing hit an error while generating content. Redirecting you to your syllabus with available topics.
                            </div>
                        )}

                        {hasError && resolvedCourseId && (
                            <div className="mb-8 flex flex-col items-center gap-3">
                                <p className="text-sm text-slate-400 font-medium">
                                    Redirecting to your syllabus with available topics...
                                </p>
                            </div>
                        )}

                        {/* Step-by-Step Progress Indicator */}
                        <div className="w-full max-w-lg mb-8">
                            <div className="flex items-center justify-between mb-4">
                                {PROCESSING_STEPS.slice(0, -1).map((step, index) => {
                                    const isCompleted = index < currentStepIndex;
                                    const isCurrent = index === currentStepIndex;
                                    return (
                                        <React.Fragment key={step.key}>
                                            <div className={`flex flex-col items-center transition-all duration-500 ${isCurrent ? 'scale-110' : ''}`}>
                                                <div className={`
                                                    w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border-2
                                                    ${isCompleted
                                                        ? 'bg-green-500 border-green-500 text-white'
                                                        : isCurrent
                                                            ? 'bg-primary border-primary text-white animate-pulse'
                                                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                                                    }
                                                `}>
                                                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: isCompleted ? "'FILL' 1" : "" }}>
                                                        {isCompleted ? 'check' : step.icon}
                                                    </span>
                                                </div>
                                                <span className={`text-xs font-medium mt-2 transition-colors duration-300 hidden sm:block ${isCompleted || isCurrent ? 'text-primary' : 'text-slate-400'
                                                    }`}>
                                                    {step.label}
                                                </span>
                                            </div>
                                            {index < PROCESSING_STEPS.length - 2 && (
                                                <div className={`flex-1 h-1 mx-2 rounded-full transition-all duration-500 ${index < currentStepIndex
                                                        ? 'bg-green-500'
                                                        : 'bg-slate-200 dark:bg-slate-700'
                                                    }`}></div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full max-w-lg h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                            <div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-purple-500 to-primary rounded-full transition-all duration-700 ease-out"
                                style={{
                                    width: `${progress}%`,
                                    backgroundSize: '200% 100%',
                                    animation: 'shimmer 2s infinite linear'
                                }}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Confirmation State - Course Preview */
                    <div className="flex flex-col items-center justify-center max-w-4xl mx-auto text-center animate-slide-up">
                        {/* Success Animation */}
                        <div className="relative mb-8">
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-400/30 to-emerald-500/30 flex items-center justify-center animate-bounce" style={{ animationDuration: '2s', animationIterationCount: '3' }}>
                                <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                                    <span className="material-symbols-outlined text-white text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        check_circle
                                    </span>
                                </div>
                            </div>
                            {/* Celebration particles */}
                            <div className="absolute -inset-4">
                                {[...Array(8)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute w-2 h-2 rounded-full animate-ping"
                                        style={{
                                            backgroundColor: ['#4361EE', '#7C3AED', '#22C55E', '#F59E0B'][i % 4],
                                            left: `${50 + 40 * Math.cos((i * Math.PI * 2) / 8)}%`,
                                            top: `${50 + 40 * Math.sin((i * Math.PI * 2) / 8)}%`,
                                            animationDelay: `${i * 0.1}s`,
                                            animationDuration: '1.5s'
                                        }}
                                    ></div>
                                ))}
                            </div>
                        </div>

                        {/* Course Title */}
                        <div className="flex items-center gap-2 mb-4 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-full border border-green-100 dark:border-green-800/30">
                            <span className="material-symbols-outlined text-green-500 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                            <span className="text-green-600 dark:text-green-400 font-bold text-xs tracking-wider uppercase">Course Generated Successfully</span>
                        </div>

                        <h1 className="text-4xl md:text-5xl font-display font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight leading-tight">
                            {displayCourse?.title || 'Your Course'}
                        </h1>

                        <p className="text-slate-500 dark:text-slate-400 text-lg font-medium mb-8 max-w-xl">
                            {displayCourse?.description || 'AI-generated course from your study materials'}
                        </p>

                        {/* Course Stats */}
                        <div className="flex items-center gap-6 mb-10">
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-5 py-3 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                                <span className="material-symbols-outlined text-primary text-[24px]">menu_book</span>
                                <div className="text-left">
                                    <span className="block text-2xl font-bold text-slate-900 dark:text-white">{topics.length}</span>
                                    <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Topics</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-5 py-3 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                                <span className="material-symbols-outlined text-purple-500 text-[24px]">quiz</span>
                                <div className="text-left">
                                    <span className="block text-2xl font-bold text-slate-900 dark:text-white">0</span>
                                    <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Questions</span>
                                </div>
                            </div>
                        </div>

                        {/* Topics Preview */}
                        {topics.length > 0 && (
                            <div className="w-full max-w-2xl mb-10">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Topics Preview</h3>
                                <div className="grid gap-3">
                                    {topics.slice(0, 4).map((topic, index) => (
                                        <div
                                            key={topic._id}
                                            className="flex items-center gap-4 bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-700/50 text-left transition-all hover:shadow-md hover:-translate-y-0.5"
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm ${index === 0 ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                                                }`}>
                                                {index + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-900 dark:text-white truncate">{topic.title}</h4>
                                                <p className="text-sm text-slate-500 truncate">{topic.description || 'Topic content ready for study'}</p>
                                            </div>
                                            <span className="text-xs font-bold px-3 py-1 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                Ready
                                            </span>
                                        </div>
                                    ))}
                                    {topics.length > 4 && (
                                        <div className="text-sm text-slate-400 font-medium py-2">
                                            +{topics.length - 4} more topics
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Start Learning Button */}
                        <button
                            onClick={handleStartLearning}
                            className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-primary to-purple-600 text-white px-10 py-5 rounded-2xl font-bold text-xl shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] transition-all overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                            <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                            <span>Start Learning</span>
                            <span className="material-symbols-outlined text-[24px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                        </button>
                    </div>
                )}
            </main>

            {/* Custom CSS for shimmer animation */}
            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </div>
    );
};

export default DashboardProcessing;
