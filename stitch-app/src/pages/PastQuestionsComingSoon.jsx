import React from 'react';
import { Link } from 'react-router-dom';

const PastQuestionsComingSoon = () => {
    return (
        <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#0d161c] dark:text-white min-h-screen flex items-center justify-center px-6 py-12">
            <div className="w-full max-w-2xl bg-surface-light dark:bg-surface-dark border border-slate-200/70 dark:border-slate-800 rounded-[2.5rem] p-10 shadow-soft text-center relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>

                <div className="relative z-10 flex flex-col items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-[32px]">auto_stories</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Practice Past Questions</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg font-medium max-w-xl">
                        We are gathering the best past questions for you.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider border border-primary/10">
                        Coming soon
                    </div>
                    <Link
                        to="/dashboard"
                        className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default PastQuestionsComingSoon;
