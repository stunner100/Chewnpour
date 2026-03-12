import React from 'react';
import { Link } from 'react-router-dom';

const DashboardFullAnalysis = () => {
    return (
        <div className="bg-background-light dark:bg-background-dark font-body antialiased text-[#0d161c] dark:text-white min-h-screen flex flex-col">
            <header className="sticky top-0 z-30 w-full bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-neutral-100 dark:border-neutral-800">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/dashboard/results" aria-label="Go back to results" className="flex items-center justify-center bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-full h-10 w-10 shadow-sm text-neutral-600 dark:text-neutral-300 transition-transform active:scale-95 hover:bg-neutral-50">
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </Link>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold text-neutral-900 dark:text-white leading-tight">
                                Full Performance Analysis
                                <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 align-middle">Preview</span>
                            </h1>
                            <Link to="/dashboard/results" className="text-xs font-semibold text-primary uppercase tracking-wide cursor-pointer hover:underline">Back to Summary</Link>
                        </div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">analytics</span>
                    </div>
                </div>
            </header>
            <main className="flex-1 w-full max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
                <section className="bg-white dark:bg-surface-dark border border-neutral-100 dark:border-neutral-700 rounded-2xl p-6 shadow-soft flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[20px]">bar_chart</span>
                            Topic Mastery
                        </h2>
                        <span className="text-xs font-medium text-neutral-400">Last 30 Days</span>
                    </div>
                    <div className="flex items-end justify-between gap-4 h-56 w-full pl-2 pr-2">
                        <div className="flex flex-col items-center gap-2 flex-1 group h-full justify-end">
                            <div className="text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity mb-1">85%</div>
                            <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-t-xl rounded-b-lg relative h-full max-h-40 flex items-end overflow-hidden">
                                <div className="w-full bg-primary rounded-t-xl transition-all duration-500 group-hover:bg-primary/90" style={{ height: '85%' }}></div>
                            </div>
                            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Supply</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 flex-1 group h-full justify-end">
                            <div className="text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity mb-1">62%</div>
                            <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-t-xl rounded-b-lg relative h-full max-h-40 flex items-end overflow-hidden">
                                <div className="w-full bg-primary/60 rounded-t-xl transition-all duration-500 group-hover:bg-primary/70" style={{ height: '62%' }}></div>
                            </div>
                            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Demand</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 flex-1 group h-full justify-end">
                            <div className="text-xs font-bold text-error opacity-0 group-hover:opacity-100 transition-opacity mb-1">45%</div>
                            <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-t-xl rounded-b-lg relative h-full max-h-40 flex items-end overflow-hidden">
                                <div className="w-full bg-primary/30 rounded-t-xl transition-all duration-500 group-hover:bg-primary/40" style={{ height: '45%' }}></div>
                            </div>
                            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Inflation</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 flex-1 group h-full justify-end">
                            <div className="text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity mb-1">72%</div>
                            <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-t-xl rounded-b-lg relative h-full max-h-40 flex items-end overflow-hidden">
                                <div className="w-full bg-primary/80 rounded-t-xl transition-all duration-500 group-hover:bg-primary/90" style={{ height: '72%' }}></div>
                            </div>
                            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Fiscal</span>
                        </div>
                    </div>
                </section>
                <section className="bg-white dark:bg-surface-dark border border-neutral-100 dark:border-neutral-700 rounded-2xl p-6 shadow-soft flex flex-col">
                    <h2 className="text-base font-bold text-neutral-900 dark:text-white mb-8 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">pie_chart</span>
                        Skill Breakdown
                    </h2>
                    <div className="flex-1 flex items-center justify-around">
                        <div className="flex flex-col items-center">
                            <div className="relative w-24 h-24 mb-4">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-neutral-100 dark:text-neutral-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3"></path>
                                    <path className="text-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="88, 100" strokeLinecap="round" strokeWidth="3"></path>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-neutral-800 dark:text-white">88%</div>
                            </div>
                            <span className="text-xs font-bold uppercase text-neutral-400 text-center leading-tight">Logic<br />Strength</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="relative w-24 h-24 mb-4">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-neutral-100 dark:text-neutral-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3"></path>
                                    <path className="text-primary/70" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="72, 100" strokeLinecap="round" strokeWidth="3"></path>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-neutral-800 dark:text-white">72%</div>
                            </div>
                            <span className="text-xs font-bold uppercase text-neutral-400 text-center leading-tight">Practical<br />Accuracy</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="relative w-24 h-24 mb-4">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-neutral-100 dark:text-neutral-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3"></path>
                                    <path className="text-primary/40" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="54, 100" strokeLinecap="round" strokeWidth="3"></path>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-neutral-800 dark:text-white">54%</div>
                            </div>
                            <span className="text-xs font-bold uppercase text-neutral-400 text-center leading-tight">Conceptual<br />Clarity</span>
                        </div>
                    </div>
                </section>
                <section className="bg-white dark:bg-surface-dark border border-neutral-100 dark:border-neutral-700 rounded-2xl p-6 shadow-soft flex flex-col">
                    <h2 className="text-base font-bold text-neutral-900 dark:text-white mb-8 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">timer</span>
                        Time Analysis
                    </h2>
                    <div className="flex flex-col justify-center flex-1 gap-6">
                        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined text-[24px]">quiz</span>
                                </div>
                                <div>
                                    <p className="text-base font-bold text-neutral-800 dark:text-neutral-200">MCQ Average</p>
                                    <p className="text-sm text-neutral-400">Target: 45s</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-xl font-bold text-neutral-900 dark:text-white">32s</span>
                                <span className="block text-xs font-bold text-success uppercase mt-1">Fast</span>
                            </div>
                        </div>
                        <div className="h-px bg-neutral-50 dark:bg-neutral-800 w-full"></div>
                        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined text-[24px]">extension</span>
                                </div>
                                <div>
                                    <p className="text-base font-bold text-neutral-800 dark:text-neutral-200">Concept Builds</p>
                                    <p className="text-sm text-neutral-400">Target: 2m 00s</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-xl font-bold text-neutral-900 dark:text-white">2m 45s</span>
                                <span className="block text-xs font-bold text-warning uppercase mt-1">Slow</span>
                            </div>
                        </div>
                    </div>
                </section>
                <section className="bg-white dark:bg-surface-dark border border-neutral-100 dark:border-neutral-700 rounded-2xl p-6 shadow-soft flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
                            Score Trend
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary"></span>
                            <span className="text-xs text-neutral-400 font-medium">Performance</span>
                        </div>
                    </div>
                    <div className="relative flex-1 w-full min-h-[160px] flex flex-col justify-end">
                        <svg className="w-full h-[140px] overflow-visible" preserveAspectRatio="none" viewBox="0 0 400 120">
                            <defs>
                                <linearGradient id="trendGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                                    <stop offset="0%" stopColor="#4361EE" stopOpacity="0.2"></stop>
                                    <stop offset="100%" stopColor="#4361EE" stopOpacity="0"></stop>
                                </linearGradient>
                            </defs>
                            <line stroke="#e5e7eb" strokeWidth="1" x1="0" x2="400" y1="120" y2="120"></line>
                            <line stroke="#f3f4f6" strokeDasharray="4 4" strokeWidth="1" x1="0" x2="400" y1="80" y2="80"></line>
                            <line stroke="#f3f4f6" strokeDasharray="4 4" strokeWidth="1" x1="0" x2="400" y1="40" y2="40"></line>
                            <path d="M0 80 L100 90 L200 50 L300 60 L400 20 V120 H0 Z" fill="url(#trendGradient)"></path>
                            <path d="M0 80 L100 90 L200 50 L300 60 L400 20" fill="none" stroke="#4361EE" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke"></path>
                            <circle className="fill-white stroke-primary stroke-2" cx="0" cy="80" r="4"></circle>
                            <circle className="fill-white stroke-primary stroke-2" cx="100" cy="90" r="4"></circle>
                            <circle className="fill-white stroke-primary stroke-2" cx="200" cy="50" r="4"></circle>
                            <circle className="fill-white stroke-primary stroke-2" cx="300" cy="60" r="4"></circle>
                            <circle className="fill-white stroke-primary stroke-2" cx="400" cy="20" r="4"></circle>
                        </svg>
                        <div className="flex justify-between w-full mt-4 text-xs text-neutral-400 font-medium px-1">
                            <span>Quiz 1</span>
                            <span>Quiz 2</span>
                            <span>Midterm</span>
                            <span>Quiz 3</span>
                            <span>Final</span>
                        </div>
                    </div>
                </section>
                <section className="lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-primary to-blue-700 rounded-2xl p-8 shadow-lg text-white">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl -ml-16 -mb-16"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-start md:gap-8">
                        <div className="flex-1 space-y-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm shadow-sm">
                                    <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">AI Improvement Plan</h2>
                                    <p className="text-blue-100 text-sm">Personalized specifically for your recent performance.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-start gap-3 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 hover:bg-white/15 transition-colors">
                                    <div className="bg-white text-primary rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                        <span className="text-xs font-bold">1</span>
                                    </div>
                                    <div>
                                        <p className="text-base font-bold leading-snug">Revise Supply-Side Economics</p>
                                        <p className="text-sm text-white/80 mt-1">Foundational gap detected in graph interpretation.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 hover:bg-white/15 transition-colors">
                                    <div className="bg-white text-primary rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                        <span className="text-xs font-bold">2</span>
                                    </div>
                                    <div>
                                        <p className="text-base font-bold leading-snug">Practice 3 Concept Builds</p>
                                        <p className="text-sm text-white/80 mt-1">Improve speed and accuracy in high-pressure topics.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="w-full md:w-auto md:min-w-[320px] flex flex-col justify-end mt-6 md:mt-0">
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                                <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wide opacity-80">Recommended Actions</h3>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button className="flex-1 bg-white text-primary py-3 px-4 rounded-xl text-sm font-bold hover:bg-neutral-50 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap">
                                        <span>Take the quiz again</span>
                                        <span className="material-symbols-outlined text-[18px]">replay</span>
                                    </button>
                                    <Link to="/dashboard" className="flex-1 bg-white text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 py-3 px-4 rounded-xl text-sm font-bold hover:bg-neutral-50 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap">
                                        <span>Go back to course</span>
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
