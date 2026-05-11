import React from 'react';
import { Link } from 'react-router-dom';

const StudyProgressMastery = () => {
    const activityData = [
        { day: 'Mon', height: '30%', active: false },
        { day: 'Tue', height: '60%', active: false },
        { day: 'Wed', height: '80%', active: true, label: '1.5 hrs' },
        { day: 'Thu', height: '40%', active: false },
        { day: 'Fri', height: '20%', active: false },
        { day: 'Sat', height: '5%', active: false, muted: true },
        { day: 'Sun', height: '0%', active: false, muted: true },
    ];

    const topics = [
        { name: 'Genetics', score: 95, color: 'bg-success', softColor: 'bg-success-soft', textColor: 'text-success' },
        { name: 'Ecology', score: 88, color: 'bg-success', softColor: 'bg-success-soft', textColor: 'text-success' },
        { name: 'Evolution', score: 65, color: 'bg-warning', softColor: 'bg-warning-soft', textColor: 'text-warning' },
        { name: 'Cell Biology', score: 42, color: 'bg-error', softColor: 'bg-error-soft', textColor: 'text-error' },
    ];

    return (
        <div className="flex-1 pt-[88px] md:ml-0 p-space-4 md:p-space-8 max-w-container-max mx-auto flex flex-col gap-space-10 pb-20">
            {/* Header */}
            <header className="flex flex-col gap-space-2">
                <h2 className="font-display-lg text-display-lg text-text-primary">Your Learning Journey</h2>
                <p className="font-body-lg text-body-lg text-text-secondary max-w-2xl">
                    You're making solid progress. Keep up the momentum! Reviewing your weak spots today will strengthen your overall readiness.
                </p>
            </header>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-6">
                {/* Stat 1: Streak */}
                <div className="bg-surface shadow-sm rounded-xl p-space-6 flex flex-col gap-space-4 border border-border-subtle">
                    <div className="flex items-center justify-between">
                        <span className="font-label-md text-label-md text-text-secondary uppercase tracking-wider">Study Streak</span>
                        <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="font-display-xl text-display-xl text-text-primary">4</span>
                        <span className="font-body-base text-body-base text-text-muted">days</span>
                    </div>
                </div>

                {/* Stat 2: Lessons */}
                <div className="bg-surface shadow-sm rounded-xl p-space-6 flex flex-col gap-space-4 border border-border-subtle">
                    <div className="flex items-center justify-between">
                        <span className="font-label-md text-label-md text-text-secondary uppercase tracking-wider">Lessons Completed</span>
                        <div className="w-10 h-10 rounded-full bg-info-soft flex items-center justify-center text-info">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="font-display-xl text-display-xl text-text-primary">12</span>
                        <span className="font-body-base text-body-base text-text-muted">total</span>
                    </div>
                </div>

                {/* Stat 3: Quiz Average */}
                <div className="bg-surface shadow-sm rounded-xl p-space-6 flex flex-col gap-space-4 border border-border-subtle">
                    <div className="flex items-center justify-between">
                        <span className="font-label-md text-label-md text-text-secondary uppercase tracking-wider">Quiz Average</span>
                        <div className="w-10 h-10 rounded-full bg-success-soft flex items-center justify-center text-success">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="font-display-xl text-display-xl text-text-primary">82%</span>
                        <span className="font-body-base text-body-base text-success text-sm flex items-center">
                            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                            5%
                        </span>
                    </div>
                </div>

                {/* Exam Readiness Gauge (Span 2) */}
                <div className="bg-surface shadow-sm rounded-xl p-space-8 border border-border-subtle md:col-span-2 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-64 h-64 bg-mastery-soft rounded-full blur-3xl opacity-30 -mr-20 -mt-20 pointer-events-none"></div>
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 relative z-10 gap-4">
                        <div>
                            <h3 className="font-headline-md text-headline-md text-text-primary mb-1">Exam Readiness</h3>
                            <p className="font-body-sm text-body-sm text-text-secondary">Based on recent quizzes and lesson completion.</p>
                        </div>
                        <div className="text-right">
                            <span className="inline-block px-3 py-1 rounded-full bg-mastery-soft text-mastery font-label-md text-label-md mb-2">Mastery Level: Strong</span>
                        </div>
                    </div>
                    <div className="relative w-full h-8 bg-surface-muted rounded-full overflow-hidden z-10">
                        <div className="absolute top-0 left-0 h-full bg-mastery rounded-full transition-all" style={{ width: '85%' }}></div>
                        <div className="absolute top-0 left-1/4 h-full w-[2px] bg-surface opacity-30"></div>
                        <div className="absolute top-0 left-2/4 h-full w-[2px] bg-surface opacity-30"></div>
                        <div className="absolute top-0 left-3/4 h-full w-[2px] bg-surface opacity-30"></div>
                    </div>
                    <div className="flex justify-between mt-2 font-label-xs text-label-xs text-text-muted z-10">
                        <span>Needs Work</span>
                        <span>Developing</span>
                        <span>Proficient</span>
                        <span className="text-mastery font-bold">Strong</span>
                    </div>
                </div>

                {/* Recommended Action CTA (Span 1) */}
                <div className="bg-ai-subtle shadow-sm rounded-xl p-space-6 border border-border-subtle md:col-span-1 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-primary">lightbulb</span>
                            <h3 className="font-headline-sm text-headline-sm text-text-primary">Recommended Action</h3>
                        </div>
                        <p className="font-body-base text-body-base text-text-secondary mb-6">
                            Your lowest score recently was in the <strong>Cell Biology</strong> module. A quick flashcard review could boost your retention.
                        </p>
                    </div>
                    <Link
                        to="/dashboard/flashcards"
                        className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 px-4 rounded-xl shadow-md hover:bg-primary-hover transition-colors flex justify-center items-center gap-2"
                    >
                        Start Flashcards
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Link>
                </div>

                {/* Progress History Chart (Span 2) */}
                <div className="bg-surface shadow-sm rounded-xl p-space-6 border border-border-subtle md:col-span-2">
                    <h3 className="font-headline-sm text-headline-sm text-text-primary mb-6">Study Activity (Last 7 Days)</h3>
                    <div className="h-48 w-full flex items-end justify-between gap-2 md:gap-4 mt-8 pb-6 border-b border-border-subtle relative">
                        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-label-xs text-text-muted -ml-2 -mt-2">
                            <span>2h</span>
                            <span>1h</span>
                        </div>
                        {activityData.map((bar) => (
                            <div key={bar.day} className="flex-1 flex flex-col items-center gap-2 group">
                                <div
                                    className={`w-full max-w-[40px] rounded-t-md transition-colors relative ${
                                        bar.active ? 'bg-primary' : bar.muted ? 'bg-surface-muted group-hover:bg-primary-soft' : 'bg-primary-soft group-hover:bg-primary'
                                    }`}
                                    style={{ height: bar.height }}
                                >
                                    {bar.active && (
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface border border-border-subtle shadow-sm rounded px-2 py-1 font-label-xs text-label-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                            {bar.label}
                                        </div>
                                    )}
                                </div>
                                <span className={`font-label-xs text-label-xs ${bar.active ? 'text-text-primary font-bold' : bar.muted ? 'text-text-muted' : 'text-text-secondary'}`}>
                                    {bar.day}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Strong vs Weak Topics (Span 1) */}
                <div className="bg-surface shadow-sm rounded-xl p-space-6 border border-border-subtle md:col-span-1 flex flex-col">
                    <h3 className="font-headline-sm text-headline-sm text-text-primary mb-6">Topic Breakdown</h3>
                    <div className="flex flex-col gap-space-4 flex-1">
                        {topics.map((topic) => (
                            <div key={topic.name} className="flex items-center justify-between p-3 rounded-lg border border-border-subtle hover:bg-surface-soft transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-8 ${topic.color} rounded-full`}></div>
                                    <span className="font-body-sm text-body-sm font-medium text-text-primary">{topic.name}</span>
                                </div>
                                <span className={`px-2 py-1 rounded ${topic.softColor} ${topic.textColor} font-label-xs text-label-xs`}>{topic.score}%</span>
                            </div>
                        ))}
                    </div>
                    <button className="mt-6 w-full text-center font-label-md text-label-md text-primary hover:text-primary-hover transition-colors">
                        View Full Report
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudyProgressMastery;
