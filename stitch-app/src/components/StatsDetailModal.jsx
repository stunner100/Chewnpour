import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

// Haptic feedback helper
const triggerHaptic = (type = 'light') => {
    if (navigator.vibrate) {
        const patterns = {
            light: 10,
            medium: 20,
            heavy: 30,
            success: [10, 50, 10],
            error: [50, 100, 50]
        };
        navigator.vibrate(patterns[type] || patterns.light);
    }
};

const StatsDetailModal = ({ isOpen, onClose, type, userId }) => {
    const modalRef = useRef(null);
    const [translateY, setTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const currentTranslateY = useRef(0);
    
    // Always call hooks first - pass 'skip' when modal is closed or no userId
    const shouldFetchCourses = isOpen && userId && type === 'courses';
    const courses = useQuery(
        shouldFetchCourses ? api.courses.getUserCourses : 'skip',
        shouldFetchCourses ? { userId } : 'skip'
    );

    const shouldFetchAttempts = isOpen && userId && (type === 'topics' || type === 'accuracy');
    const examAttempts = useQuery(
        shouldFetchAttempts ? api.exams.getUserExamAttempts : 'skip',
        shouldFetchAttempts ? { userId } : 'skip'
    );

    const shouldFetchProfile = isOpen && userId && type === 'hours';
    const profile = useQuery(
        shouldFetchProfile ? api.profiles.getProfile : 'skip',
        shouldFetchProfile ? { userId } : 'skip'
    );

    // Handle touch start for swipe-to-close (only on header/drag handle)
    const handleTouchStart = useCallback((e) => {
        setIsDragging(true);
        startY.current = e.touches[0].clientY;
        currentTranslateY.current = translateY;
    }, [translateY]);

    // Handle touch move
    const handleTouchMove = useCallback((e) => {
        if (!isDragging) return;
        
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;
        
        if (diff > 0) {
            const resistance = 0.6;
            setTranslateY(currentTranslateY.current + (diff * resistance));
        }
    }, [isDragging]);

    // Handle touch end
    const handleTouchEnd = useCallback(() => {
        if (!isDragging) return;
        
        setIsDragging(false);
        
        if (translateY > 100) {
            triggerHaptic('light');
            onClose();
        } else {
            setTranslateY(0);
        }
    }, [isDragging, translateY, onClose]);
    
    // Prevent touch events from bubbling when scrolling content
    const handleContentTouch = useCallback((e) => {
        e.stopPropagation();
    }, []);

    // Reset translate when modal opens and lock body scroll
    useEffect(() => {
        if (isOpen) {
            setTranslateY(0);
            // Lock body scroll
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
        } else {
            // Unlock body scroll
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        }
        
        return () => {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        };
    }, [isOpen]);

    // Add keyboard escape handler
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Return null after all hooks are called
    if (!isOpen || !userId) return null;

    const handleCloseClick = () => {
        triggerHaptic('light');
        onClose();
    };

    const renderContent = () => {
        switch (type) {
            case 'topics':
                return <TopicsContent examAttempts={examAttempts} />;
            case 'accuracy':
                return <AccuracyContent examAttempts={examAttempts} />;
            case 'courses':
                return <CoursesContent courses={courses} />;
            case 'hours':
                return <HoursContent profile={profile} />;
            default:
                return null;
        }
    };

    const getTitle = () => {
        switch (type) {
            case 'topics': return 'Completed Topics';
            case 'accuracy': return 'Accuracy Breakdown';
            case 'courses': return 'Your Courses';
            case 'hours': return 'Study Time';
            default: return '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            {/* Backdrop */}
            <div 
                className="modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={handleCloseClick}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ opacity: 1 - (translateY / 500) }}
            />
            
            {/* Modal */}
            <div 
                ref={modalRef}
                className="relative w-full max-w-lg md:max-w-2xl bg-white dark:bg-surface-dark rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[85vh] md:max-h-[80vh] flex flex-col"
                style={{ 
                    transform: `translateY(${translateY}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                {/* Drag Handle (Mobile Only) */}
                <div 
                    className="drag-handle md:hidden w-full pt-3 pb-1 flex justify-center"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full pointer-events-none"></div>
                </div>
                
                {/* Header */}
                <div 
                    className="modal-header flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{getTitle()}</h2>
                    <button 
                        onClick={handleCloseClick}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                    >
                        <span className="material-symbols-outlined text-slate-500">close</span>
                    </button>
                </div>

                {/* Content */}
                <div 
                    className="flex-1 overflow-y-auto p-4"
                    style={{ overscrollBehavior: 'contain' }}
                    onTouchStart={handleContentTouch}
                >
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

// Topics Content
const TopicsContent = ({ examAttempts }) => {
    if (examAttempts === undefined) {
        return <LoadingState />;
    }

    if (!examAttempts || examAttempts.length === 0) {
        return <EmptyState message="No completed topics yet" icon="menu_book" />;
    }

    // Group by topic and count attempts
    const topicMap = new Map();
    examAttempts.forEach(attempt => {
        const existing = topicMap.get(attempt.topicId);
        if (existing) {
            existing.attempts += 1;
        } else {
            topicMap.set(attempt.topicId, {
                topicId: attempt.topicId,
                title: attempt.topicTitle || 'Unknown Topic',
                attempts: 1
            });
        }
    });

    const topics = Array.from(topicMap.values());

    return (
        <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Completed {topics.length} topics
            </p>
            {topics.map((topic, index) => (
                <div 
                    key={topic.topicId} 
                    className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl active:scale-[0.98] transition-transform"
                    onClick={() => triggerHaptic('light')}
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold">
                        {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white truncate">
                            {topic.title}
                        </p>
                        <p className="text-xs text-slate-500">
                            {topic.attempts} attempt{topic.attempts !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};

// Accuracy Content
const AccuracyContent = ({ examAttempts }) => {
    if (examAttempts === undefined) {
        return <LoadingState />;
    }

    if (!examAttempts || examAttempts.length === 0) {
        return <EmptyState message="No exam data yet" icon="check_circle" />;
    }

    // Calculate overall accuracy
    let totalScore = 0;
    let totalQuestions = 0;
    examAttempts.forEach(attempt => {
        totalScore += attempt.score;
        totalQuestions += attempt.totalQuestions;
    });
    const overallAccuracy = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

    // Group by topic for breakdown
    const topicMap = new Map();
    examAttempts.forEach(attempt => {
        const existing = topicMap.get(attempt.topicId);
        if (existing) {
            existing.score += attempt.score;
            existing.totalQuestions += attempt.totalQuestions;
        } else {
            topicMap.set(attempt.topicId, {
                topicId: attempt.topicId,
                title: attempt.topicTitle || 'Unknown Topic',
                score: attempt.score,
                totalQuestions: attempt.totalQuestions
            });
        }
    });

    const topics = Array.from(topicMap.values()).map(t => ({
        ...t,
        accuracy: Math.round((t.score / t.totalQuestions) * 100)
    }));

    return (
        <div className="space-y-6">
            {/* Overall Accuracy */}
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Overall Accuracy</p>
                <p className="text-5xl font-bold text-green-600">{overallAccuracy}%</p>
            </div>

            {/* Breakdown by Topic */}
            <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                    By Topic
                </p>
                <div className="space-y-3">
                    {topics.map((topic) => (
                        <div 
                            key={topic.topicId} 
                            className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl active:scale-[0.98] transition-transform"
                            onClick={() => triggerHaptic('light')}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-bold text-slate-900 dark:text-white truncate flex-1 mr-4">
                                    {topic.title}
                                </p>
                                <span className={`text-sm font-bold ${
                                    topic.accuracy >= 80 ? 'text-green-600' :
                                    topic.accuracy >= 60 ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                    {topic.accuracy}%
                                </span>
                            </div>
                            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${
                                        topic.accuracy >= 80 ? 'bg-green-500' :
                                        topic.accuracy >= 60 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${topic.accuracy}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Courses Content
const CoursesContent = ({ courses }) => {
    if (courses === undefined) {
        return <LoadingState />;
    }

    if (!courses || courses.length === 0) {
        return <EmptyState message="No courses yet" icon="school" />;
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {courses.length} course{courses.length !== 1 ? 's' : ''}
            </p>
            {courses.map((course) => (
                <div 
                    key={course._id} 
                    className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl active:scale-[0.98] transition-transform"
                    onClick={() => triggerHaptic('light')}
                >
                    <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                        style={{ background: course.coverColor || 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                    >
                        <span className="material-symbols-outlined filled">school</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white truncate">
                            {course.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden max-w-[100px]">
                                <div 
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${course.progress}%` }}
                                />
                            </div>
                            <span className="text-xs font-bold text-slate-500">
                                {course.progress}%
                            </span>
                        </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        course.status === 'completed' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                        {course.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                </div>
            ))}
        </div>
    );
};

// Hours Content
const HoursContent = ({ profile }) => {
    if (profile === undefined) {
        return <LoadingState />;
    }

    const totalHours = profile?.totalStudyHours || 0;
    
    // Mock weekly data (in a real app, you'd track this more granularly)
    const thisWeek = Math.round(totalHours * 0.15); // Rough estimate
    const lastWeek = Math.round(totalHours * 0.12);
    const dailyAverage = totalHours > 0 ? (totalHours / 30).toFixed(1) : 0; // Assume 30 days of activity

    const stats = [
        { label: 'This Week', value: `${thisWeek}h`, icon: 'calendar_today', color: 'bg-blue-500' },
        { label: 'Last Week', value: `${lastWeek}h`, icon: 'calendar_month', color: 'bg-purple-500' },
        { label: 'Total', value: `${Math.round(totalHours)}h`, icon: 'schedule', color: 'bg-green-500' },
        { label: 'Daily Average', value: `${dailyAverage}h`, icon: 'trending_up', color: 'bg-orange-500' },
    ];

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                {stats.map((stat) => (
                    <div 
                        key={stat.label}
                        className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-center active:scale-[0.98] transition-transform"
                        onClick={() => triggerHaptic('light')}
                    >
                        <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center text-white mx-auto mb-2`}>
                            <span className="material-symbols-outlined filled">{stat.icon}</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                        <p className="text-xs text-slate-500">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Study Tips */}
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary">lightbulb</span>
                    <p className="font-bold text-slate-900 dark:text-white">Study Tip</p>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Consistency is key! Studying for shorter periods regularly is more effective than long cramming sessions.
                </p>
            </div>
        </div>
    );
};

// Loading State
const LoadingState = () => (
    <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                </div>
            </div>
        ))}
    </div>
);

// Empty State
const EmptyState = ({ message, icon }) => (
    <div className="text-center py-12">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-slate-400">{icon}</span>
        </div>
        <p className="text-slate-500 dark:text-slate-400">{message}</p>
    </div>
);

export default StatsDetailModal;
