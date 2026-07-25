import React from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../AppIcon';

const formatRelative = (timestamp) => {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
};

const ContinueLearningCard = ({ course, nextLesson, estimatedTime = '15 min', onGenerateQuiz }) => {
    if (!course) return null;
    const progress = Math.max(0, Math.min(100, Number(course.progress) || 0));

    return (
        <section className="card-base overflow-hidden animate-fade-in-up animate-delay-150">
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-0">
                <div
                    className="relative md:h-full h-32 flex items-center justify-center"
                    style={{ background: course.coverColor || 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)' }}
                >
                    <AppIcon name="menu_book" className="text-white/95 text-[56px]" />
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/30 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                        <AppIcon name="play_circle" className="text-[12px]" />
                        Continue
                    </span>
                </div>
                <div className="p-5 md:p-6 flex flex-col gap-4">
                    <div className="space-y-1.5">
                        <p className="text-overline text-primary">Continue learning</p>
                        <h3 className="text-display-sm md:text-display-md text-text-main-light dark:text-text-main-dark line-clamp-1">{course.title}</h3>
                        {nextLesson && (
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark line-clamp-1">
                                Next: <span className="font-semibold text-text-main-light dark:text-text-main-dark">{nextLesson}</span>
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-caption">
                            <span className="text-text-sub-light dark:text-text-sub-dark">{progress}% complete</span>
                            <span className="text-text-faint-light dark:text-text-faint-dark inline-flex items-center gap-1">
                                <AppIcon name="schedule" className="text-[13px]" />
                                {estimatedTime}
                                {course.lastStudiedAt && (
                                    <>
                                        <span aria-hidden="true">·</span>
                                        Last studied {formatRelative(course.lastStudiedAt)}
                                    </>
                                )}
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-border-subtle dark:bg-border-subtle-dark rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-accent-purple transition-[width] duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/dashboard/course/${course._id}`} className="btn-primary text-body-sm">
                            <AppIcon name="play_arrow" className="text-[16px]" />
                            Continue
                        </Link>
                        <button type="button" onClick={onGenerateQuiz} className="btn-secondary text-body-sm">
                            <AppIcon name="quiz" className="text-[16px]" />
                            Generate Quiz
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ContinueLearningCard;
