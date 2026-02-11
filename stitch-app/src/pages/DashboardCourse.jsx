import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const DashboardCourse = () => {
    const { courseId } = useParams();
    const { user } = useAuth();
    const userId = user?.id;
    const navigate = useNavigate();

    React.useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [courseId]);

    const courseData = useQuery(
        api.courses.getCourseWithTopics,
        courseId ? { courseId } : 'skip'
    );

    const allCourses = useQuery(api.courses.getUserCourses, userId ? { userId } : 'skip');
    const latestCourse = courseId ? null : allCourses?.[0];
    const course = courseData || (latestCourse ? { ...latestCourse, topics: [] } : null);

    const latestCourseTopics = useQuery(
        api.courses.getCourseWithTopics,
        latestCourse?._id ? { courseId: latestCourse._id } : 'skip'
    );

    const displayCourse = courseData || latestCourseTopics || course;
    const topics = displayCourse?.topics || [];
    const upload = useQuery(
        api.uploads.getUpload,
        displayCourse?.uploadId ? { uploadId: displayCourse.uploadId } : 'skip'
    );
    const plannedTopicTitles = Array.isArray(upload?.plannedTopicTitles) ? upload.plannedTopicTitles : [];
    const hasPlannedTitles = plannedTopicTitles.length > 0;
    const plannedCount = hasPlannedTitles
        ? Math.max(upload?.plannedTopicCount || 0, plannedTopicTitles.length, topics.length)
        : topics.length;
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
        hasPlannedTitles &&
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
    const syllabusItems = React.useMemo(() => {
        if (!topics.length && !hasPlannedTitles) return [];

        const topicsByOrder = new Map(
            [...topics].sort((a, b) => a.orderIndex - b.orderIndex).map((topic) => [topic.orderIndex, topic])
        );

        if (!hasPlannedTitles) {
            return [...topics]
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((topic) => ({
                    kind: 'ready',
                    index: topic.orderIndex,
                    topic,
                }));
        }

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
    }, [topics, hasPlannedTitles, plannedCount, plannedTopicTitles]);
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
        <div className="relative min-h-screen flex flex-col bg-background-light dark:bg-background-dark font-body antialiased overflow-x-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 bg-mesh-light dark:bg-mesh-dark pointer-events-none"></div>
            <div className="fixed top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/8 rounded-full blur-[150px] pointer-events-none animate-pulse-subtle"></div>
            <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/6 rounded-full blur-[120px] pointer-events-none"></div>

            <header className="sticky top-0 z-30 w-full glass border-b border-neutral-200/50 dark:border-neutral-800/50">
                <div className="w-full max-w-7xl mx-auto flex items-center justify-between px-4 md:px-6 py-3 md:py-4">
                    <Link to="/dashboard" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-primary/10 dark:hover:bg-primary/20 text-neutral-500 hover:text-primary transition-all">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <div className="flex items-center gap-2 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-neutral-200/50 dark:border-neutral-700/50">
                        <span className="material-symbols-outlined text-orange-500 text-[20px] filled animate-pulse-subtle" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                        <span className="text-neutral-700 dark:text-neutral-200 text-sm font-bold">12</span>
                    </div>
                    <Link to="/profile" className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white dark:border-neutral-700 shadow-md ring-2 ring-transparent hover:ring-primary/30 transition-all">
                        <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
                            {user?.name?.[0]?.toUpperCase() || 'S'}
                        </div>
                    </Link>
                </div>
            </header>

            <main className="relative z-10 w-full max-w-7xl mx-auto flex-1 px-4 md:px-6 py-8 pb-20 md:py-12 md:pb-12">
                <div className="flex flex-col items-center justify-center max-w-4xl mx-auto mb-16 text-center animate-fade-in-up">
                    {isProcessing ? (
                        <>
                            <div className="flex items-center gap-3 mb-6 badge-primary">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                                </span>
                                <span>Processing Slides</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-display font-extrabold text-text-main-light dark:text-text-main-dark mb-6 md:mb-8 tracking-tight leading-tight">
                                Analyzing your <br />
                                <span className="text-gradient-vibrant">Study Materials</span>
                            </h1>
                            <div className="w-full max-w-lg h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden relative mb-4 mx-auto">
                                <div className="absolute inset-0 bg-primary/10 w-full h-full"></div>
                                <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-secondary w-1/3 rounded-full animate-shimmer"></div>
                            </div>
                            <p className="text-text-sub-light dark:text-text-sub-dark text-base font-medium mb-10 max-w-md mx-auto">
                                Identifying key topics and writing clear, detailed lessons for you.
                            </p>
                        </>
                    ) : (
                        <>
                            <div className={`${backgroundGenerationActive ? 'badge-primary' : 'badge-success'} mb-6`}>
                                <span className="material-symbols-outlined text-[16px] filled">
                                    {backgroundGenerationActive ? 'sync' : 'check_circle'}
                                </span>
                                <span>{backgroundGenerationActive ? 'Background Generation In Progress' : 'Ready to Study'}</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-display font-extrabold text-text-main-light dark:text-text-main-dark mb-4 md:mb-6 tracking-tight leading-[1.1]">
                                {displayCourse?.title || 'Your Course'}
                            </h1>
                            <p className="text-text-sub-light dark:text-text-sub-dark text-lg font-medium mb-10">
                                {plannedCount > 0
                                    ? `${generatedCount}/${plannedCount} topics generated`
                                    : `${topics.length} topics generated`
                                } • <span className="text-primary font-semibold">Ready for practice</span>
                            </p>
                            {showTopicProgress && (
                                <div className="mb-6 w-full max-w-2xl rounded-2xl border border-primary/20 bg-white/80 dark:bg-neutral-900/60 px-5 py-4 shadow-sm">
                                    <div className="mb-3 flex items-center justify-between text-sm font-semibold text-text-main-light dark:text-text-main-dark">
                                        <span>Generating remaining topics...</span>
                                        <span>{topicPercent}%</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-700"
                                            style={{ width: `${topicPercent}%` }}
                                        />
                                    </div>
                                    <p className="mt-2 text-xs font-medium text-text-sub-light dark:text-text-sub-dark">
                                        {generatedCount} of {plannedCount} topics are ready.
                                    </p>
                                </div>
                            )}
                            {backgroundGenerationActive && (
                                <div className="mb-8 w-full max-w-2xl rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-800">
                                    {backgroundGenerationMessage}
                                </div>
                            )}
                        </>
                    )}
                    <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-3 bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-6 md:px-8 py-3 md:py-4 rounded-2xl font-bold text-base md:text-lg shadow-sm cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-[24px]">lock_open</span>
                        <span>Unlock All Topics</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 animate-fade-in-up animate-delay-200">
                    {syllabusItems.length > 0 ? (
                        syllabusItems.map((item) => {
                            const gradients = [
                                'from-primary to-secondary',
                                'from-accent-cyan to-accent-emerald',
                                'from-secondary to-accent-amber',
                                'from-accent-fuchsia to-primary',
                            ];
                            const gradient = gradients[item.index % gradients.length];

                            if (item.kind === 'pending') {
                                return (
                                    <div
                                        key={`pending-${item.index}`}
                                        className="group card-base p-5 md:p-8 flex flex-col justify-between min-h-[220px] md:min-h-[280px] border-dashed border-primary/30 bg-white/70 dark:bg-neutral-900/60"
                                    >
                                        <div className="absolute right-5 top-5">
                                            <span className="badge border border-primary/20 bg-primary/10 text-primary">
                                                Generating...
                                            </span>
                                        </div>
                                        <div className="flex flex-col pt-4">
                                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Topic {item.index + 1}</span>
                                            <h3 className="text-xl lg:text-2xl font-display font-bold leading-tight mb-3 text-text-main-light dark:text-text-main-dark">
                                                {item.title}
                                            </h3>
                                            <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium leading-relaxed">
                                                This topic is currently being generated in the background. It will appear here automatically.
                                            </p>
                                        </div>
                                        <div className="mt-8 flex items-center justify-between">
                                            <div className="flex -space-x-2">
                                                <div className="h-9 w-9 rounded-full ring-2 ring-white dark:ring-surface-dark bg-neutral-200 dark:bg-neutral-700 animate-pulse"></div>
                                                <div className="h-9 w-9 rounded-full ring-2 ring-white dark:ring-surface-dark bg-neutral-300 dark:bg-neutral-600 animate-pulse"></div>
                                                <div className="h-9 w-9 rounded-full ring-2 ring-white dark:ring-surface-dark bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
                                            </div>
                                            <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-400">
                                                <span className="material-symbols-outlined text-[22px] animate-pulse">hourglass_top</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            const topic = item.topic;
                            const isLocked = false;
                            return (
                                <div
                                    key={topic._id}
                                    onClick={() => {
                                        navigate(`/dashboard/topic/${topic._id}`);
                                    }}
                                    className={`group card-interactive p-5 md:p-8 flex flex-col justify-between min-h-[220px] md:min-h-[280px] ${isLocked ? 'opacity-60' : ''}`}
                                >
                                    <div className="absolute right-5 top-5">
                                        <span className={`badge ${isLocked ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700' : 'badge-success'}`}>
                                            {isLocked ? 'Locked' : 'Ready'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col pt-4">
                                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Topic {item.index + 1}</span>
                                        {topic.illustrationUrl && (
                                            <div className="mb-4 overflow-hidden rounded-xl border border-neutral-200/70 dark:border-neutral-700/70">
                                                <img
                                                    src={topic.illustrationUrl}
                                                    alt={`${topic.title} illustration`}
                                                    loading="lazy"
                                                    className="h-28 w-full object-cover"
                                                />
                                            </div>
                                        )}
                                        <h3 className={`text-xl lg:text-2xl font-display font-bold leading-tight mb-3 ${isLocked ? 'text-neutral-400' : 'text-text-main-light dark:text-text-main-dark group-hover:text-primary transition-colors'}`}>
                                            {topic.title}
                                        </h3>
                                        <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium leading-relaxed line-clamp-2">
                                            {topic.description || `Master the key concepts of topic ${item.index + 1} with detailed summaries.`}
                                        </p>
                                    </div>
                                    <div className="mt-8 flex items-center justify-between">
                                        <div className="flex -space-x-2">
                                            <div className="h-9 w-9 rounded-full ring-2 ring-white dark:ring-surface-dark bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-500">A</div>
                                            <div className="h-9 w-9 rounded-full ring-2 ring-white dark:ring-surface-dark bg-neutral-300 dark:bg-neutral-600 flex items-center justify-center text-[10px] font-bold text-neutral-600">B</div>
                                            <div className="h-9 w-9 rounded-full ring-2 ring-white dark:ring-surface-dark bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-neutral-400">+50</div>
                                        </div>
                                        {isLocked ? (
                                            <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                                                <span className="material-symbols-outlined text-[22px]">lock</span>
                                            </div>
                                        ) : (
                                            <Link
                                                to={`/dashboard/topic/${topic._id}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className={`h-12 w-12 rounded-full bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-button group-hover:scale-110 group-hover:shadow-button-hover transition-all`}
                                            >
                                                <span className="material-symbols-outlined filled text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="card-base p-8 animate-pulse flex flex-col justify-between min-h-[280px]">
                                    <div className="flex flex-col gap-4 w-full">
                                        <div className="h-4 w-1/4 bg-neutral-100 dark:bg-neutral-800 rounded-full"></div>
                                        <div className="h-8 w-3/4 bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
                                        <div className="h-4 w-full bg-neutral-100 dark:bg-neutral-800 rounded-lg mt-2"></div>
                                        <div className="h-4 w-2/3 bg-neutral-100 dark:bg-neutral-800 rounded-lg"></div>
                                    </div>
                                    <div className="mt-auto flex justify-between items-center">
                                        <div className="flex -space-x-2">
                                            <div className="h-9 w-9 rounded-full bg-neutral-200 dark:bg-neutral-700"></div>
                                            <div className="h-9 w-9 rounded-full bg-neutral-200 dark:bg-neutral-700"></div>
                                        </div>
                                        <div className="h-12 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700"></div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default DashboardCourse;
