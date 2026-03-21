import React from 'react';
import { Link } from 'react-router-dom';

const PastQuestionsComingSoon = () => {
    return (
        <div className="w-full max-w-3xl mx-auto px-4 md:px-8 py-8 pb-24 md:pb-12">
            <div className="card-base p-8 md:p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/8 text-primary flex items-center justify-center mx-auto mb-5">
                    <span className="material-symbols-outlined text-[28px]">auto_stories</span>
                </div>
                <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-2">
                    Practice Past Questions
                </h1>
                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-md mx-auto mb-5">
                    We are gathering the best past questions for you.
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 text-primary text-caption font-semibold uppercase tracking-wider mb-6">
                    Coming soon
                </span>
                <div>
                    <Link
                        to="/dashboard"
                        className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-body-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default PastQuestionsComingSoon;
