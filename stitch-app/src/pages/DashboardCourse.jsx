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
    const syllabusItems = React.useMemo(() => {
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
    }, [topics, plannedCount, plannedTopicTitles]);
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
        <div className="relative min-h-screen flex flex-col bg-background-light dark:bg-background-dark font-body antialiased">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-white to-purple-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20"></div>
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-full blur-3xl"></div>
            </div>

            {/* Header */}
            <header className="sticky top-0 z-30 w-full glass border-b border-slate-200/50 dark:border-slate-800/50">
                <div className="w-full max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
                    <Link to="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span className="text-sm font-medium hidden sm:inline">Dashboard</span>
                    </Link>
                    
                    <div className="flex items-center gap-3">
                        {backgroundGenerationActive && (
                            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                                <span className="material-symbols-outlined text-blue-500 text-sm animate-spin">sync</span>
                                <span className="text-blue-600 dark:text-blue-400 text-xs font-medium">Generating...</span>
                            </div>
                        )}
                        <Link to="/profile" className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-500 p-0.5">
                            <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                                <span className="text-primary font-bold text-xs">{user?.name?.[0]?.toUpperCase() || 'S'}</span>
                            </div>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="relative z-10 w-full max-w-6xl mx-auto flex-1 px-4 py-8 pb-20">
                {/* Course Header */}
                <div className="mb-10">
                    {isProcessing ? (
                        <div className="text-center py-12">
                            <div className="relative w-20 h-20 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                                    <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                                </div>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-3">
                                Creating Your Course
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                Our AI is analyzing your materials and building personalized lessons. This may take a few minutes.
                            </p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 mb-4">
                                <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                                <span className="text-green-600 dark:text-green-400 text-xs font-semibold">Ready to Study</span>
                            </div>
                            
                            <h1 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">
                                {displayCourse?.title || 'Your Course'}
                            </h1>
                            
                            <p className="text-slate-500 dark:text-slate-400 mb-6">
                                {plannedCount > 0
                                    ? `${generatedCount} of ${plannedCount} topics ready`
                                    : `${topics.length} topics available`
                                }
                            </p>

                            {showTopicProgress && (
                                <div className="max-w-md mx-auto mb-6 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Generating remaining topics</span>
                                        <span className="text-sm font-bold text-blue-600">{topicPercent}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                                            style={{ width: `${topicPercent}%` }}
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-slate-400">
                                        {generatedCount} of {plannedCount} topics generated
                                    </p>
                                </div>
                            )}

                            {backgroundGenerationActive && (
                                <div className="max-w-md mx-auto p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
                                    <div className="flex items-start gap-2">
                                        <span className="material-symbols-outlined text-blue-500 text-sm mt-0.5">info</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-400 text-left">
                                            {backgroundGenerationMessage}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Topics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {syllabusItems.length > 0 ? (
                        syllabusItems.map((item) => {
                            const gradients = [
                                'from-blue-500 to-indigo-600',
                                'from-emerald-500 to-teal-600',
                                'from-purple-500 to-pink-600',
                                'from-orange-500 to-red-500',
                            ];
                            const gradient = gradients[item.index % gradients.length];

                            if (item.kind === 'pending') {
                                return (
                                    <div
                                        key={`pending-${item.index}`}
                                        className="group relative p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 border-dashed"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                Topic {item.index + 1}
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
                                                <span className="material-symbols-outlined text-amber-500 text-xs animate-spin">sync</span>
                                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Generating</span>
                                            </span>
                                        </div>
                                        
                                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
                                            {item.title}
                                        </h3>
                                        <p className="text-sm text-slate-400 mb-4">
                                            This topic is being generated and will appear shortly.
                                        </p>
                                        
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                                            <div className="flex -space-x-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 animate-pulse"></div>
                                                <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-500 animate-pulse"></div>
                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 animate-pulse"></div>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                                <span className="material-symbols-outlined text-lg animate-pulse">hourglass_empty</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            const topic = item.topic;
                            return (
                                <div
                                    key={topic._id}
                                    onClick={() => navigate(`/dashboard/topic/${topic._id}`)}
                                    className="group relative p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            Topic {item.index + 1}
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30">
                                            <span className="material-symbols-outlined text-green-500 text-xs">check_circle</span>
                                            <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">Ready</span>
                                        </span>
                                    </div>

                                    {topic.illustrationUrl && (
                                        <div className="mb-4 overflow-hidden rounded-xl">
                                            <img
                                                src={topic.illustrationUrl}
                                                alt={`${topic.title} illustration`}
                                                loading="lazy"
                                                className="h-32 w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        </div>
                                    )}

                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {topic.title}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                                        {topic.description || `Master the key concepts of ${topic.title} with detailed explanations and practice questions.`}
                                    </p>

                                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <span className="material-symbols-outlined text-sm">menu_book</span>
                                            <span>Read & Practice</span>
                                        </div>
                                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all`}>
                                            <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        /* Loading Skeleton */
                        <>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded"></div>
                                        <div className="h-6 w-14 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
                                    </div>
                                    <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4"></div>
                                    <div className="h-6 w-3/4 bg-slate-100 dark:bg-slate-800 rounded mb-2"></div>
                                    <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded mb-1"></div>
                                    <div className="h-4 w-2/3 bg-slate-100 dark:bg-slate-800 rounded"></div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Empty State */}
                {syllabusItems.length === 0 && !isProcessing && (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl text-slate-400">school</span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No topics yet</h3>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto">
                            Your course is being prepared. Topics will appear here once they're ready.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DashboardCourse;
