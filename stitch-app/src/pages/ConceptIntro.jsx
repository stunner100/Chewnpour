import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const ConceptIntro = () => {
    const { topicId } = useParams();
    const topic = useQuery(
        api.topics.getTopicWithQuestions,
        topicId ? { topicId } : 'skip'
    );

    if (!topicId) {
        return (
            <div className="bg-surface-light dark:bg-background-dark font-display antialiased text-[#0d161c] dark:text-white flex flex-col items-center justify-center min-h-screen px-6">
                <div className="text-center max-w-md">
                    <h1 className="text-2xl font-bold mb-3">Select a topic to practice concepts</h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        Go back to your topic and start concept practice from there.
                    </p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/25">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (topic === undefined) {
        return (
            <div className="bg-surface-light dark:bg-background-dark font-display antialiased text-[#0d161c] dark:text-white flex flex-col items-center justify-center min-h-screen px-6">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Loading practice setup...</p>
                </div>
            </div>
        );
    }

    if (topic === null) {
        return (
            <div className="bg-surface-light dark:bg-background-dark font-display antialiased text-[#0d161c] dark:text-white flex flex-col items-center justify-center min-h-screen px-6">
                <div className="text-center max-w-md">
                    <h1 className="text-2xl font-bold mb-3">Topic not found</h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        We couldn't find this topic. Please return to your dashboard.
                    </p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/25">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const topicTitle = topic?.title || 'your lesson';
    return (
        <div className="bg-surface-light dark:bg-background-dark font-display antialiased text-[#0d161c] dark:text-white flex flex-col items-center justify-center min-h-screen">
            <div className="absolute top-6 right-6 z-20">
                <Link to="/dashboard" className="flex items-center justify-center w-10 h-10 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-primary transition-all shadow-sm">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                </Link>
            </div>
            <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col items-center justify-center px-6 py-12 md:py-20 relative z-10">
                <div className="w-full max-w-[320px] md:max-w-[440px] lg:max-w-[500px] aspect-square mb-10 md:mb-12 relative flex items-center justify-center transition-all duration-300">
                    <div className="absolute inset-0 bg-primary/5 rounded-full scale-90 animate-pulse" style={{ animationDuration: '4s' }}></div>
                    <svg className="w-full h-full relative z-10 drop-shadow-sm" fill="none" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                        <rect className="dark:fill-slate-700" fill="#E2E8F0" height="2" rx="1" width="300" x="50" y="320"></rect>
                        <rect className="dark:fill-slate-800" fill="white" height="100" rx="4" stroke="#1e293b" strokeWidth="3" width="240" x="80" y="220"></rect>
                        <rect className="dark:fill-slate-700" fill="#f8fafc" height="20" rx="4" stroke="#1e293b" strokeWidth="3" width="260" x="70" y="210"></rect>
                        <path className="dark:fill-slate-800" d="M140 240 L140 180 Q140 160 160 160 L240 160 Q260 160 260 180 L260 240" fill="white" stroke="#1e293b" strokeWidth="3"></path>
                        <path d="M160 280 C160 280 160 190 200 190 C240 190 240 280 240 280" fill="#4361EE" stroke="#1e293b" strokeWidth="3"></path>
                        <circle className="dark:fill-slate-200" cx="200" cy="160" fill="white" r="35" stroke="#1e293b" strokeWidth="3"></circle>
                        <path className="dark:fill-slate-600" d="M150 210 L160 170 L240 170 L250 210 Z" fill="#cbd5e1" stroke="#1e293b" strokeWidth="3"></path>
                        <path d="M180 185 L220 185" stroke="#4361EE" strokeLinecap="round" strokeWidth="4"></path>
                        <circle cx="280" cy="120" fill="#4361EE" fillOpacity="0.2" r="8"></circle>
                        <circle cx="300" cy="90" fill="#4361EE" fillOpacity="0.4" r="12"></circle>
                        <g transform="translate(100, 100) rotate(-10)">
                            <path d="M0 0 H40 V30 C40 35.5228 35.5228 40 30 40 H10 C4.47715 40 0 35.5228 0 30 V0 Z" fill="#4361EE"></path>
                            <text fill="white" fontFamily="sans-serif" fontSize="24" fontWeight="bold" x="13" y="28">?</text>
                        </g>
                    </svg>
                </div>
                <div className="flex flex-col items-center max-w-4xl text-center animate-fade-in-up">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#0d161c] dark:text-white tracking-tight leading-tight mb-8">
                        Ready to test <br className="hidden md:block" />your knowledge?
                    </h1>
                    <div className="flex flex-wrap items-center justify-center gap-3 md:gap-5 mb-8">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-full text-base font-semibold border border-transparent dark:border-slate-700 shadow-sm">
                            1 Concept Build
                        </span>
                        <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-full text-base font-semibold border border-transparent dark:border-slate-700 shadow-sm">
                            ~2 minutes
                        </span>
                        <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-full text-base font-semibold border border-transparent dark:border-slate-700 shadow-sm">
                            Drag-and-drop
                        </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-base md:text-xl font-medium text-center mb-12 max-w-xl leading-relaxed">
                        Covers: <span className="text-primary font-bold">{topicTitle}</span>
                    </p>
                    <Link to={`/dashboard/concept/${topicId}`} className="w-full max-w-[320px] md:max-w-[420px] bg-primary hover:bg-blue-600 active:bg-blue-700 text-white transition-all transform hover:-translate-y-1 active:scale-[0.98] h-16 md:h-[72px] rounded-2xl text-lg md:text-xl font-bold shadow-xl shadow-primary/25 flex items-center justify-center gap-3 group">
                        <span>Start Now</span>
                        <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform text-2xl">arrow_forward</span>
                    </Link>
                </div>
            </main>
        </div>
    );
};

export default ConceptIntro;
