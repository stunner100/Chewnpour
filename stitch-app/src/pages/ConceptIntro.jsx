import React, { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useRouteResolvedTopic } from '../hooks/useRouteResolvedTopic';

const ConceptIntro = () => {
    const { topicId: topicIdParam } = useParams();
    const routeTopicId = typeof topicIdParam === 'string' ? topicIdParam.trim() : '';
    const navigate = useNavigate();
    const reloadDashboard = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.location.assign('/dashboard');
            return;
        }
        navigate('/dashboard', { replace: true });
    }, [navigate]);
    const topicQueryResult = useQuery(
        api.topics.getTopicWithQuestions,
        topicId ? { topicId } : 'skip'
    );
    const {
        topic,
        topicId,
        isLoadingRouteTopic,
        isMissingRouteTopic,
    } = useRouteResolvedTopic(routeTopicId, topicQueryResult);

    if (!routeTopicId) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-primary text-[24px]">school</span>
                    </div>
                    <h1 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Select a topic to practice concepts</h1>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">
                        Go back to your topic and start concept practice from there.
                    </p>
                    <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-body-sm">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (isLoadingRouteTopic) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-border-light dark:border-border-dark border-t-primary mx-auto mb-4"></div>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Loading practice setup...</p>
                </div>
            </div>
        );
    }

    if (isMissingRouteTopic) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-red-500 text-[24px]">error</span>
                    </div>
                    <h1 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Topic not found</h1>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">
                        We couldn't find this topic. Please return to your dashboard.
                    </p>
                    <Link to="/dashboard" className="btn-secondary inline-flex items-center gap-2 px-6 py-2.5 text-body-sm">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const topicTitle = topic?.title || 'your lesson';
    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center">
            <div className="absolute top-4 right-4 z-20">
                <Link to="/dashboard" className="btn-icon w-10 h-10">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                </Link>
            </div>
            <main className="flex-1 w-full max-w-5xl mx-auto flex flex-col items-center justify-center px-4 py-12 md:py-20 relative z-10">
                <div className="w-full max-w-[180px] md:max-w-[240px] aspect-square mb-8 relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-primary/5 rounded-full scale-90 animate-pulse" style={{ animationDuration: '4s' }}></div>
                    <svg className="w-full h-full relative z-10" fill="none" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                        <rect className="dark:fill-border-dark" fill="#E2E8F0" height="2" rx="1" width="300" x="50" y="320"></rect>
                        <rect className="dark:fill-surface-dark" fill="white" height="100" rx="4" stroke="#1e293b" strokeWidth="3" width="240" x="80" y="220"></rect>
                        <rect className="dark:fill-border-dark" fill="#f8fafc" height="20" rx="4" stroke="#1e293b" strokeWidth="3" width="260" x="70" y="210"></rect>
                        <path className="dark:fill-surface-dark" d="M140 240 L140 180 Q140 160 160 160 L240 160 Q260 160 260 180 L260 240" fill="white" stroke="#1e293b" strokeWidth="3"></path>
                        <path d="M160 280 C160 280 160 190 200 190 C240 190 240 280 240 280" fill="#1a73e8" stroke="#1e293b" strokeWidth="3"></path>
                        <circle className="dark:fill-white" cx="200" cy="160" fill="white" r="35" stroke="#1e293b" strokeWidth="3"></circle>
                        <path className="dark:fill-border-dark" d="M150 210 L160 170 L240 170 L250 210 Z" fill="#cbd5e1" stroke="#1e293b" strokeWidth="3"></path>
                        <path d="M180 185 L220 185" stroke="#1a73e8" strokeLinecap="round" strokeWidth="4"></path>
                        <circle cx="280" cy="120" fill="#1a73e8" fillOpacity="0.2" r="8"></circle>
                        <circle cx="300" cy="90" fill="#1a73e8" fillOpacity="0.4" r="12"></circle>
                        <g transform="translate(100, 100) rotate(-10)">
                            <path d="M0 0 H40 V30 C40 35.5228 35.5228 40 30 40 H10 C4.47715 40 0 35.5228 0 30 V0 Z" fill="#1a73e8"></path>
                            <text fill="white" fontFamily="sans-serif" fontSize="24" fontWeight="bold" x="13" y="28">?</text>
                        </g>
                    </svg>
                </div>
                <div className="flex flex-col items-center max-w-3xl text-center">
                    <h1 className="text-display-sm md:text-display-lg text-text-main-light dark:text-text-main-dark mb-5">
                        Ready to test <br className="hidden md:block" />your knowledge?
                    </h1>
                    <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                        <span className="inline-flex items-center px-3.5 py-2 rounded-lg bg-surface-hover-light dark:bg-surface-hover-dark text-body-sm font-semibold text-text-sub-light dark:text-text-sub-dark border border-border-light dark:border-border-dark">
                            1 Concept Build
                        </span>
                        <span className="hidden md:block w-1 h-1 rounded-full bg-border-light dark:bg-border-dark"></span>
                        <span className="inline-flex items-center px-3.5 py-2 rounded-lg bg-surface-hover-light dark:bg-surface-hover-dark text-body-sm font-semibold text-text-sub-light dark:text-text-sub-dark border border-border-light dark:border-border-dark">
                            ~2 minutes
                        </span>
                        <span className="hidden md:block w-1 h-1 rounded-full bg-border-light dark:bg-border-dark"></span>
                        <span className="inline-flex items-center px-3.5 py-2 rounded-lg bg-surface-hover-light dark:bg-surface-hover-dark text-body-sm font-semibold text-text-sub-light dark:text-text-sub-dark border border-border-light dark:border-border-dark">
                            Drag-and-drop
                        </span>
                    </div>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-8 max-w-xl">
                        Covers: <span className="text-primary font-semibold">{topicTitle}</span>
                    </p>
                    <Link to={`/dashboard/concept/${topicId}`} className="btn-primary w-full max-w-[280px] md:max-w-[340px] py-3.5 text-body-base flex items-center justify-center gap-2 group">
                        <span>Start Now</span>
                        <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform text-[20px]">arrow_forward</span>
                    </Link>
                </div>
            </main>
        </div>
    );
};

export default ConceptIntro;
