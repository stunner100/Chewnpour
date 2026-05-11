import React from 'react';
import { Link } from 'react-router-dom';

const StudentDashboard = () => {
    return (
        <div className="flex-1 pt-space-8 px-space-8 pb-space-16 max-w-container-max mx-auto w-full">
            {/* Welcome Header */}
            <div className="flex justify-between items-end mb-space-10">
                <div>
                    <h2 className="font-display-lg text-display-lg text-text-primary tracking-tight">Good morning, Alex.</h2>
                    <p className="font-body-lg text-body-lg text-text-secondary mt-space-2">Ready to study? You have a 4-day streak going.</p>
                </div>
                <div className="flex gap-space-4">
                    <div className="bg-surface shadow-sm rounded-xl px-space-4 py-space-3 flex items-center gap-space-3 border border-border-subtle">
                        <div className="p-2 bg-warning-soft rounded-lg text-warning">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                        </div>
                        <div>
                            <p className="font-label-xs text-label-xs text-text-muted uppercase tracking-wider">Streak</p>
                            <p className="font-headline-sm text-headline-sm text-text-primary">4 Days</p>
                        </div>
                    </div>
                    <div className="bg-surface shadow-sm rounded-xl px-space-4 py-space-3 flex items-center gap-space-3 border border-border-subtle">
                        <div className="p-2 bg-mastery-soft rounded-lg text-mastery">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>style</span>
                        </div>
                        <div>
                            <p className="font-label-xs text-label-xs text-text-muted uppercase tracking-wider">Due Today</p>
                            <p className="font-headline-sm text-headline-sm text-text-primary">15 Cards</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-12 gap-space-6 mb-space-10">
                {/* Continue Studying Card */}
                <div className="col-span-12 lg:col-span-8 bg-surface rounded-xl shadow-sm border border-border-subtle overflow-hidden flex hover:shadow-md transition-shadow relative group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/90 to-transparent z-0"></div>
                    <div className="absolute right-0 top-0 bottom-0 w-1/2 z-[-1]">
                        <img
                            alt="Psychology Study"
                            className="w-full h-full object-cover opacity-60"
                            src="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=60"
                        />
                    </div>
                    <div className="p-space-8 flex flex-col justify-between w-full z-10">
                        <div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-soft text-primary rounded-full font-label-xs text-label-xs mb-space-4">
                                <span className="material-symbols-outlined text-[14px]">schedule</span>
                                Last accessed 2h ago
                            </span>
                            <h3 className="font-display-lg text-display-lg text-text-primary mb-space-2">Introduction to Psychology</h3>
                            <p className="font-body-base text-body-base text-text-secondary max-w-md">Chapter 4: Cognitive Development and Memory Structures.</p>
                        </div>
                        <div className="mt-space-8 max-w-md">
                            <div className="flex justify-between items-end mb-space-2">
                                <span className="font-label-md text-label-md text-text-primary">Overall Progress</span>
                                <span className="font-label-md text-label-md text-primary">65%</span>
                            </div>
                            <div className="w-full bg-surface-variant rounded-full h-2 overflow-hidden">
                                <div className="bg-primary h-2 rounded-full" style={{ width: '65%' }}></div>
                            </div>
                            <div className="mt-space-4">
                                <Link
                                    to="/dashboard/lessons"
                                    className="bg-primary text-on-primary px-space-6 py-space-3 rounded-xl font-label-md text-label-md hover:bg-primary-hover transition-colors flex items-center gap-space-2 inline-flex"
                                >
                                    Continue Studying
                                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Upload Area */}
                <div className="col-span-12 lg:col-span-4 bg-surface-soft rounded-xl border-2 border-dashed border-border-strong p-space-8 flex flex-col items-center justify-center text-center hover:bg-surface-muted transition-colors cursor-pointer group">
                    <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center shadow-sm text-primary mb-space-4 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-text-primary mb-space-2">Upload Material</h3>
                    <p className="font-body-sm text-body-sm text-text-secondary mb-space-6">Drag & drop PDFs, docs, or images here to generate lessons and flashcards.</p>
                    <Link
                        to="/dashboard/upload"
                        className="bg-surface text-text-primary border border-border-default px-space-6 py-space-2 rounded-xl font-label-md text-label-md hover:bg-surface-soft transition-colors w-full"
                    >
                        Browse Files
                    </Link>
                </div>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-12 gap-space-6">
                {/* Left Column */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-space-6">
                    {/* Performance Overview */}
                    <div className="bg-surface rounded-xl shadow-sm border border-border-subtle p-space-6">
                        <div className="flex justify-between items-center mb-space-6">
                            <h3 className="font-headline-sm text-headline-sm text-text-primary">Performance Overview</h3>
                            <button className="text-text-muted hover:text-primary font-label-md text-label-md flex items-center gap-1">
                                Last 7 Days
                                <span className="material-symbols-outlined text-[16px]">expand_more</span>
                            </button>
                        </div>
                        <div className="flex items-end gap-space-4 h-48 mt-space-4">
                            {[
                                { day: 'Mon', height: '40%', active: false },
                                { day: 'Tue', height: '65%', active: false },
                                { day: 'Wed', height: '85%', active: true },
                                { day: 'Thu', height: '50%', active: false },
                                { day: 'Fri', height: '70%', active: false },
                                { day: 'Sat', height: '30%', active: false },
                                { day: 'Sun', height: '45%', active: false },
                            ].map((bar) => (
                                <div key={bar.day} className="flex-1 flex flex-col justify-end gap-2 group">
                                    <div
                                        className={`w-full rounded-t-md relative transition-colors ${
                                            bar.active ? 'bg-primary' : 'bg-surface-variant group-hover:bg-primary-soft'
                                        }`}
                                        style={{ height: bar.height }}
                                    >
                                        {bar.active && (
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface shadow-md px-2 py-1 rounded text-xs font-label-xs border border-border-subtle">
                                                85%
                                            </div>
                                        )}
                                    </div>
                                    <span className={`text-center font-label-xs text-label-xs ${bar.active ? 'text-primary font-bold' : 'text-text-muted'}`}>
                                        {bar.day}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI Recommendation */}
                    <div className="bg-ai-subtle rounded-xl shadow-sm border border-border-subtle p-space-6 relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-4 opacity-10">
                            <span className="material-symbols-outlined text-[100px] text-primary">smart_toy</span>
                        </div>
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <span className="font-label-xs text-label-xs text-primary uppercase tracking-wider font-bold">Recommended Action</span>
                                <h3 className="font-headline-sm text-headline-sm text-text-primary mt-space-1 mb-space-2">Take a 5-min Quiz on Biology</h3>
                                <p className="font-body-sm text-body-sm text-text-secondary max-w-md">
                                    Our AI noticed you struggled with Cellular Respiration yesterday. A quick refresher will solidify your understanding.
                                </p>
                            </div>
                            <Link
                                to="/dashboard/quiz"
                                className="bg-surface text-primary border border-primary px-space-5 py-space-2 rounded-xl font-label-md text-label-md hover:bg-primary-soft transition-colors flex items-center gap-2 shrink-0"
                            >
                                Start Quiz
                                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-space-6">
                    {/* Recent Materials */}
                    <div className="bg-surface rounded-xl shadow-sm border border-border-subtle p-space-6 flex-1">
                        <div className="flex justify-between items-center mb-space-4">
                            <h3 className="font-headline-sm text-headline-sm text-text-primary">Recent Materials</h3>
                            <Link to="/dashboard/library" className="text-text-muted hover:text-primary">
                                <span className="material-symbols-outlined">more_horiz</span>
                            </Link>
                        </div>
                        <ul className="flex flex-col gap-space-4">
                            <li className="flex items-center gap-space-3 p-space-2 hover:bg-surface-soft rounded-lg cursor-pointer transition-colors -ml-space-2">
                                <div className="w-10 h-10 bg-error-soft text-error rounded-lg flex items-center justify-center">
                                    <span className="material-symbols-outlined">picture_as_pdf</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-label-md text-label-md text-text-primary truncate">Neuroscience Basics</p>
                                    <p className="font-label-xs text-label-xs text-text-muted mt-0.5">Uploaded yesterday</p>
                                </div>
                            </li>
                            <li className="flex items-center gap-space-3 p-space-2 hover:bg-surface-soft rounded-lg cursor-pointer transition-colors -ml-space-2">
                                <div className="w-10 h-10 bg-info-soft text-info rounded-lg flex items-center justify-center">
                                    <span className="material-symbols-outlined">description</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-label-md text-label-md text-text-primary truncate">Bio 101 Notes - Midterm</p>
                                    <p className="font-label-xs text-label-xs text-text-muted mt-0.5">Uploaded 2 days ago</p>
                                </div>
                            </li>
                            <li className="flex items-center gap-space-3 p-space-2 hover:bg-surface-soft rounded-lg cursor-pointer transition-colors -ml-space-2">
                                <div className="w-10 h-10 bg-success-soft text-success rounded-lg flex items-center justify-center">
                                    <span className="material-symbols-outlined">dataset</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-label-md text-label-md text-text-primary truncate">Chemistry Formulas</p>
                                    <p className="font-label-xs text-label-xs text-text-muted mt-0.5">Uploaded last week</p>
                                </div>
                            </li>
                        </ul>
                    </div>

                    {/* Weak Topics */}
                    <div className="bg-surface rounded-xl shadow-sm border border-border-subtle p-space-6">
                        <h3 className="font-headline-sm text-headline-sm text-text-primary mb-space-4">Weak Topics</h3>
                        <div className="flex flex-wrap gap-space-2">
                            <span className="px-space-3 py-space-1 bg-surface-variant text-text-secondary rounded-full font-label-sm text-label-sm border border-border-subtle hover:border-primary hover:text-primary cursor-pointer transition-colors">
                                Cellular Respiration
                            </span>
                            <span className="px-space-3 py-space-1 bg-surface-variant text-text-secondary rounded-full font-label-sm text-label-sm border border-border-subtle hover:border-primary hover:text-primary cursor-pointer transition-colors">
                                Operant Conditioning
                            </span>
                            <span className="px-space-3 py-space-1 bg-surface-variant text-text-secondary rounded-full font-label-sm text-label-sm border border-border-subtle hover:border-primary hover:text-primary cursor-pointer transition-colors">
                                Action Potentials
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
