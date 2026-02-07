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
    const shouldShowProcessing = Boolean(displayCourse && upload?.status === 'processing' && topics.length === 0);
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
                <div className="w-full max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
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

            <main className="relative z-10 w-full max-w-7xl mx-auto flex-1 px-6 py-12">
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
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold text-text-main-light dark:text-text-main-dark mb-8 tracking-tight leading-tight">
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
                            <div className="badge-success mb-6">
                                <span className="material-symbols-outlined text-[16px] filled">check_circle</span>
                                <span>Ready to Study</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold text-text-main-light dark:text-text-main-dark mb-6 tracking-tight leading-[1.1]">
                                {displayCourse?.title || 'Your Course'}
                            </h1>
                            <p className="text-text-sub-light dark:text-text-sub-dark text-lg font-medium mb-10">
                                {topics.length} topics generated • <span className="text-primary font-semibold">Ready for practice</span>
                            </p>
                        </>
                    )}
                    <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-3 bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-8 py-4 rounded-2xl font-bold text-lg shadow-sm cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-[24px]">lock_open</span>
                        <span>Unlock All Topics</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 animate-fade-in-up animate-delay-200">
                    {topics.length > 0 ? (
                        topics.map((topic, index) => {
                            const isLocked = false;
                            const gradients = [
                                'from-primary to-secondary',
                                'from-accent-cyan to-accent-emerald',
                                'from-secondary to-accent-amber',
                                'from-accent-fuchsia to-primary',
                            ];
                            const gradient = gradients[index % gradients.length];

                            return (
                                <div
                                    key={topic._id}
                                    onClick={() => {
                                        navigate(`/dashboard/topic/${topic._id}`);
                                    }}
                                    className={`group card-interactive p-8 flex flex-col justify-between min-h-[280px] ${isLocked ? 'opacity-60' : ''}`}
                                >
                                    <div className="absolute right-5 top-5">
                                        <span className={`badge ${isLocked ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700' : 'badge-success'}`}>
                                            {isLocked ? 'Locked' : 'Ready'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col pt-4">
                                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Topic {index + 1}</span>
                                        <h3 className={`text-xl lg:text-2xl font-display font-bold leading-tight mb-3 ${isLocked ? 'text-neutral-400' : 'text-text-main-light dark:text-text-main-dark group-hover:text-primary transition-colors'}`}>
                                            {topic.title}
                                        </h3>
                                        <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium leading-relaxed line-clamp-2">
                                            {topic.description || `Master the key concepts of topic ${index + 1} with detailed summaries.`}
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
