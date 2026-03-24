import React from 'react';
import { Link } from 'react-router-dom';

const DashboardFullAnalysis = () => {
    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col">
            <header className="sticky top-0 z-30 w-full bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark">
                <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to="/dashboard/results" aria-label="Go back to results" className="btn-icon w-10 h-10">
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </Link>
                        <div className="flex flex-col">
                            <h1 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark leading-tight flex items-center gap-2">
                                Full Performance Analysis
                                <span className="px-2 py-0.5 text-caption font-semibold rounded-full bg-accent-amber/10 text-accent-amber">Preview</span>
                            </h1>
                            <Link to="/dashboard/results" className="text-caption font-semibold text-primary hover:underline">Back to Summary</Link>
                        </div>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[18px]">analytics</span>
                    </div>
                </div>
            </header>
            <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-2 gap-4 pb-12">
                <section className="card-base p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[18px]">bar_chart</span>
                            Topic Mastery
                        </h2>
                        <span className="text-caption text-text-faint-light dark:text-text-faint-dark">Last 30 Days</span>
                    </div>
                    <div className="flex items-end justify-between gap-3 h-48 w-full px-1">
                        {[
                            { label: 'Supply', pct: 85 },
                            { label: 'Demand', pct: 62 },
                            { label: 'Inflation', pct: 45 },
                            { label: 'Fiscal', pct: 72 },
                        ].map((item) => (
                            <div key={item.label} className="flex flex-col items-center gap-1.5 flex-1 group h-full justify-end">
                                <div className="text-caption font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">{item.pct}%</div>
                                <div className="w-full bg-surface-hover-light dark:bg-surface-hover-dark rounded-t-lg rounded-b relative h-full max-h-36 flex items-end overflow-hidden">
                                    <div className="w-full bg-primary rounded-t-lg transition-all duration-500" style={{ height: `${item.pct}%`, opacity: item.pct / 100 * 0.6 + 0.4 }}></div>
                                </div>
                                <span className="text-caption font-medium text-text-faint-light dark:text-text-faint-dark">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="card-base p-5 flex flex-col">
                    <h2 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">pie_chart</span>
                        Skill Breakdown
                    </h2>
                    <div className="flex-1 flex items-center justify-around">
                        {[
                            { label: 'Logic\nStrength', pct: 88 },
                            { label: 'Practical\nAccuracy', pct: 72 },
                            { label: 'Conceptual\nClarity', pct: 54 },
                        ].map((skill) => (
                            <div key={skill.label} className="flex flex-col items-center">
                                <div className="relative w-20 h-20 mb-3">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                        <path className="text-border-light dark:text-border-dark" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3"></path>
                                        <path className="text-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${skill.pct}, 100`} strokeLinecap="round" strokeWidth="3" style={{ opacity: skill.pct / 100 * 0.6 + 0.4 }}></path>
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center text-body-base font-semibold text-text-main-light dark:text-text-main-dark">{skill.pct}%</div>
                                </div>
                                <span className="text-caption font-semibold uppercase text-text-faint-light dark:text-text-faint-dark text-center leading-tight whitespace-pre-line">{skill.label}</span>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="card-base p-5 flex flex-col">
                    <h2 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">timer</span>
                        Time Analysis
                    </h2>
                    <div className="flex flex-col justify-center flex-1 gap-5">
                        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined text-[20px]">quiz</span>
                                </div>
                                <div>
                                    <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Objective Average</p>
                                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark">Target: 45s</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">32s</span>
                                <span className="block text-caption font-semibold text-accent-emerald uppercase mt-0.5">Fast</span>
                            </div>
                        </div>
                        <div className="h-px bg-border-light dark:bg-border-dark"></div>
                        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined text-[20px]">extension</span>
                                </div>
                                <div>
                                    <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Concept Builds</p>
                                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark">Target: 2m 00s</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">2m 45s</span>
                                <span className="block text-caption font-semibold text-accent-amber uppercase mt-0.5">Slow</span>
                            </div>
                        </div>
                    </div>
                </section>
                <section className="card-base p-5 flex flex-col">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[18px]">trending_up</span>
                            Score Trend
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary"></span>
                            <span className="text-caption text-text-faint-light dark:text-text-faint-dark">Performance</span>
                        </div>
                    </div>
                    <div className="relative flex-1 w-full min-h-[140px] flex flex-col justify-end">
                        <svg className="w-full h-[120px] overflow-visible" preserveAspectRatio="none" viewBox="0 0 400 120">
                            <defs>
                                <linearGradient id="trendGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                                    <stop offset="0%" stopColor="#1a73e8" stopOpacity="0.15"></stop>
                                    <stop offset="100%" stopColor="#1a73e8" stopOpacity="0"></stop>
                                </linearGradient>
                            </defs>
                            <line className="stroke-border-light dark:stroke-border-dark" strokeWidth="1" x1="0" x2="400" y1="120" y2="120"></line>
                            <line className="stroke-border-light dark:stroke-border-dark" strokeDasharray="4 4" strokeWidth="1" x1="0" x2="400" y1="80" y2="80"></line>
                            <line className="stroke-border-light dark:stroke-border-dark" strokeDasharray="4 4" strokeWidth="1" x1="0" x2="400" y1="40" y2="40"></line>
                            <path d="M0 80 L100 90 L200 50 L300 60 L400 20 V120 H0 Z" fill="url(#trendGradient)"></path>
                            <path d="M0 80 L100 90 L200 50 L300 60 L400 20" fill="none" stroke="#1a73e8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" vectorEffect="non-scaling-stroke"></path>
                            <circle className="fill-surface-light dark:fill-surface-dark stroke-primary stroke-2" cx="0" cy="80" r="3.5"></circle>
                            <circle className="fill-surface-light dark:fill-surface-dark stroke-primary stroke-2" cx="100" cy="90" r="3.5"></circle>
                            <circle className="fill-surface-light dark:fill-surface-dark stroke-primary stroke-2" cx="200" cy="50" r="3.5"></circle>
                            <circle className="fill-surface-light dark:fill-surface-dark stroke-primary stroke-2" cx="300" cy="60" r="3.5"></circle>
                            <circle className="fill-surface-light dark:fill-surface-dark stroke-primary stroke-2" cx="400" cy="20" r="3.5"></circle>
                        </svg>
                        <div className="flex justify-between w-full mt-3 text-caption text-text-faint-light dark:text-text-faint-dark px-1">
                            <span>Quiz 1</span>
                            <span>Quiz 2</span>
                            <span>Midterm</span>
                            <span>Quiz 3</span>
                            <span>Final</span>
                        </div>
                    </div>
                </section>
                <section className="lg:col-span-2 relative overflow-hidden bg-primary rounded-xl p-6 md:p-8 text-white">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div className="absolute bottom-0 left-0 w-36 h-36 bg-white/5 rounded-full blur-2xl -ml-12 -mb-12"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-start md:gap-6">
                        <div className="flex-1 space-y-5">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-white/20 p-2 rounded-lg">
                                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                                </div>
                                <div>
                                    <h2 className="text-body-lg font-semibold">AI Improvement Plan</h2>
                                    <p className="text-white/70 text-caption">Personalized specifically for your recent performance.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {[
                                    { num: 1, title: 'Revise Supply-Side Economics', desc: 'Foundational gap detected in graph interpretation.' },
                                    { num: 2, title: 'Practice 3 Concept Builds', desc: 'Improve speed and accuracy in high-pressure topics.' },
                                ].map((item) => (
                                    <div key={item.num} className="flex items-start gap-3 bg-white/10 p-4 rounded-xl border border-white/10">
                                        <div className="bg-white text-primary rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-caption font-bold">{item.num}</span>
                                        </div>
                                        <div>
                                            <p className="text-body-sm font-semibold leading-snug">{item.title}</p>
                                            <p className="text-caption text-white/70 mt-1">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="w-full md:w-auto md:min-w-[280px] flex flex-col justify-end mt-5 md:mt-0">
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                <h3 className="text-overline text-white/70 mb-3">Recommended Actions</h3>
                                <div className="flex flex-col sm:flex-row gap-2.5">
                                    <button className="flex-1 bg-white text-primary py-2.5 px-4 rounded-xl text-body-sm font-semibold hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap">
                                        <span>Take the quiz again</span>
                                        <span className="material-symbols-outlined text-[16px]">replay</span>
                                    </button>
                                    <Link to="/dashboard" className="flex-1 bg-white/10 border border-white/20 text-white py-2.5 px-4 rounded-xl text-body-sm font-semibold hover:bg-white/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap">
                                        Go back to course
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default DashboardFullAnalysis;
