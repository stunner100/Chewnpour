import React from 'react';
import { Link } from 'react-router-dom';

const ContinueLearningPanel = ({
    topic,
    topicIndex,
    estimatedMinutes,
    progressPercent,
    quizReady,
    fallbackTitle,
    fallbackDescription,
}) => {
    const title = topic?.title || fallbackTitle || 'Pick up where you left off';
    const description =
        topic?.description ||
        fallbackDescription ||
        'Continue building mastery with the next module in your generated course.';
    const timeLabel = estimatedMinutes ? `${estimatedMinutes} min` : '15 min';
    const showProgress = typeof progressPercent === 'number' && progressPercent > 0;
    const isCompletedAll = !topic;

    return (
        <section className="card-base overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-0">
                <div
                    className="relative md:h-full h-28 flex items-center justify-center"
                    style={{
                        background:
                            'linear-gradient(135deg, #6c2bd9 0%, #4338ca 50%, #1d4ed8 100%)',
                    }}
                >
                    <span
                        className="material-symbols-outlined text-white/95 text-[56px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                        {isCompletedAll ? 'workspace_premium' : 'play_circle'}
                    </span>
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                        {isCompletedAll ? 'Course complete' : 'Continue learning'}
                    </span>
                </div>
                <div className="p-5 md:p-6 flex flex-col gap-3">
                    <div className="space-y-1">
                        <p className="text-overline text-primary">
                            {isCompletedAll
                                ? 'Course complete'
                                : `Continue where you left off${
                                      typeof topicIndex === 'number' ? ` · Module ${topicIndex + 1}` : ''
                                  }`}
                        </p>
                        <h2 className="text-display-sm md:text-display-md text-text-main-light dark:text-text-main-dark line-clamp-1">
                            {title}
                        </h2>
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark line-clamp-2">
                            {description}
                        </p>
                    </div>

                    {showProgress && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-caption">
                                <span className="text-text-sub-light dark:text-text-sub-dark">
                                    {progressPercent}% complete
                                </span>
                                <span className="text-text-faint-light dark:text-text-faint-dark inline-flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[13px]">schedule</span>
                                    {timeLabel}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-border-subtle dark:bg-border-subtle-dark rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-[width] duration-500"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        {topic ? (
                            <>
                                <Link
                                    to={`/dashboard/topic/${topic._id}`}
                                    className="btn-primary text-body-sm h-10 px-4"
                                >
                                    <span
                                        className="material-symbols-outlined text-[16px]"
                                        style={{ fontVariationSettings: "'FILL' 1" }}
                                    >
                                        play_arrow
                                    </span>
                                    {progressPercent > 0 ? 'Continue topic' : 'Start topic'}
                                </Link>
                                {quizReady && (
                                    <Link
                                        to={`/dashboard/exam/${topic._id}?autostart=mcq`}
                                        reloadDocument
                                        className="btn-secondary text-body-sm h-10 px-4"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">quiz</span>
                                        Take quiz
                                    </Link>
                                )}
                            </>
                        ) : (
                            <span className="text-body-sm text-text-sub-light dark:text-text-sub-dark inline-flex items-center gap-1.5">
                                <span
                                    className="material-symbols-outlined text-emerald-500 text-[18px]"
                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                    check_circle
                                </span>
                                You&apos;ve completed every module in this course.
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ContinueLearningPanel;
