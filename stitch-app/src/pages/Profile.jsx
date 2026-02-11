import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const Profile = () => {
    const { user, signOut, updateProfile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [voiceSaving, setVoiceSaving] = useState(false);
    const [voiceError, setVoiceError] = useState('');

    // Get userId from Better Auth session
    const userId = user?.id;

    // Convex queries for real data
    const profile = useQuery(api.profiles.getProfile, userId ? { userId } : 'skip');
    const stats = useQuery(api.profiles.getUserStats, userId ? { userId } : 'skip');
    const subscription = useQuery(api.subscriptions.getSubscription, userId ? { userId } : 'skip');
    const uploads = useQuery(api.uploads.getUserUploads, userId ? { userId } : 'skip');
    const examAttempts = useQuery(api.exams.getUserExamAttempts, userId ? { userId } : 'skip');

    const handleLogout = async () => {
        await signOut();
        navigate('/login', { replace: true });
    };

    const getLevelLabel = (level) => {
        const levels = {
            'freshman': 'Level 1',
            'sophomore': 'Level 2',
            'junior': 'Level 3',
            'senior': 'Level 4',
            'high_school': 'High School',
            'undergrad': 'Undergraduate',
            'postgrad': 'Postgraduate',
            'professional': 'Professional'
        };
        return levels[level] || level || 'Student';
    };

    const getDepartmentLabel = (dept) => {
        const depts = {
            'cs': 'Computer Science',
            'business': 'Business',
            'engineering': 'Engineering',
            'nursing': 'Nursing',
            'economics': 'Economics',
            'psychology': 'Psychology',
            'arts': 'Arts & Design',
            'biology': 'Biology',
            'law': 'Law',
            'math': 'Mathematics'
        };
        const firstDept = dept?.split(',')[0];
        return depts[firstDept] || dept || 'Undeclared';
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const gradients = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #2af598 0%, #009efd 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
    ];

    const loading = authLoading || profile === undefined || stats === undefined;

    if (loading) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            </div>
        );
    }

    const displayName = profile?.fullName || user?.name || user?.email?.split('@')[0] || 'Student';
    const displayStats = stats || { topics: 0, accuracy: 0, courses: 0, studyTime: 0, streakDays: 0 };
    const displaySubscription = subscription || { plan: 'free', status: 'active' };
    const voiceModeEnabled = Boolean(profile?.voiceModeEnabled);

    const handleVoiceModeToggle = async () => {
        setVoiceError('');
        setVoiceSaving(true);
        const { error } = await updateProfile({ voiceModeEnabled: !voiceModeEnabled });
        if (error) {
            setVoiceError(error.message || 'Unable to update voice mode setting');
        }
        setVoiceSaving(false);
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-body antialiased text-slate-900 dark:text-slate-100 transition-colors duration-300 min-h-screen flex flex-col overflow-x-hidden">
            <div className="sticky top-0 z-50 flex items-center glass border-b border-slate-200/50 dark:border-slate-800/50 p-4 pb-4 justify-between">
                <Link to="/dashboard" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-primary transition-all cursor-pointer">
                    <span className="material-symbols-outlined">arrow_back</span>
                </Link>
                <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">Student Profile</h2>
            </div>

            <main className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-6 pb-20 md:pb-8 space-y-8 animate-slide-up">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative flex items-center justify-center group">
                        <svg className="progress-ring transform -rotate-90 drop-shadow-lg" height="160" width="160">
                            <circle className="text-slate-100 dark:text-slate-800" cx="80" cy="80" fill="transparent" r="74" stroke="currentColor" strokeWidth="8"></circle>
                            <circle className="text-primary" cx="80" cy="80" fill="transparent" r="74" stroke="currentColor" strokeDasharray="465" strokeDashoffset="116" strokeLinecap="round" strokeWidth="8"></circle>
                        </svg>
                        <div
                            className="absolute bg-center bg-no-repeat aspect-square bg-cover rounded-full h-36 w-36 shadow-2xl flex items-center justify-center bg-white dark:bg-surface-dark text-primary text-5xl font-bold border-4 border-white dark:border-surface-dark"
                            style={profile?.avatarUrl ? { backgroundImage: `url("${profile.avatarUrl}")` } : {}}
                        >
                            {!profile?.avatarUrl && (displayName?.[0]?.toUpperCase() || '?')}
                        </div>
                        <div className="absolute -bottom-2 bg-gradient-to-r from-orange-400 to-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 animate-pulse-subtle">
                            <span>🔥 {displayStats.streakDays}-day</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-display font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
                                {displayName}
                            </h1>
                            <span className="material-symbols-outlined text-primary text-xl filled">verified</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-base font-medium">
                            {getDepartmentLabel(profile?.department)} • {getLevelLabel(profile?.educationLevel)}
                        </p>
                    </div>

                    <div className="flex gap-3 w-full max-w-sm">
                        <button className="flex-1 h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95">
                            Edit Profile
                        </button>
                        <button className="h-12 w-12 rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all hover:-translate-y-0.5 shadow-sm">
                            <span className="material-symbols-outlined">share</span>
                        </button>
                    </div>
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="flex flex-col items-center gap-2 p-5 bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center">
                            <span className="material-symbols-outlined filled text-xl">menu_book</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{displayStats.topics}</p>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Topics</p>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-5 bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 text-green-500 flex items-center justify-center">
                            <span className="material-symbols-outlined filled text-xl">check_circle</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{displayStats.accuracy}%</p>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Accuracy</p>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-5 bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-500 flex items-center justify-center">
                            <span className="material-symbols-outlined filled text-xl">school</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{displayStats.courses}</p>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Courses</p>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-5 bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center">
                            <span className="material-symbols-outlined filled text-xl">schedule</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{displayStats.studyTime}h</p>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Hours</p>
                    </div>
                </div>

                {/* Subscription Section */}
                <div>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Subscription</h3>
                        <Link to="/subscription" className="text-primary text-sm font-bold hover:underline">Manage</Link>
                    </div>
                    <div className={`p-6 rounded-[2rem] shadow-lg relative overflow-hidden ${displaySubscription.plan === 'premium' ? 'bg-gradient-to-br from-primary to-purple-600 text-white' : 'bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800'}`}>
                        {displaySubscription.plan === 'premium' && (
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                        )}
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className={`text-xl font-bold mb-1 ${displaySubscription.plan === 'premium' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                    {displaySubscription.plan === 'premium' ? '✨ Premium Plan' : 'Free Plan'}
                                </p>
                                <p className={`text-sm ${displaySubscription.plan === 'premium' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {displaySubscription.plan === 'premium' ? 'Unlimited access to all features' : 'Upgrade to unlock all features'}
                                </p>
                            </div>
                            {displaySubscription.plan !== 'premium' && (
                                <Link to="/subscription" className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors">
                                    Upgrade
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Accessibility</h3>
                    </div>
                    <div className="p-6 rounded-[2rem] bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <p className="font-bold text-slate-900 dark:text-white mb-1">Voice Mode</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Read topic explanations aloud with browser speech.
                                </p>
                            </div>
                            <button
                                onClick={handleVoiceModeToggle}
                                disabled={voiceSaving}
                                className={`relative w-14 h-8 rounded-full transition-colors ${voiceModeEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'} ${voiceSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
                                aria-label="Toggle voice mode"
                                aria-pressed={voiceModeEnabled}
                            >
                                <span
                                    className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${voiceModeEnabled ? 'translate-x-6' : ''}`}
                                />
                            </button>
                        </div>
                        <div className="mt-3 text-xs font-semibold">
                            <span className="text-slate-500 dark:text-slate-400">
                                {voiceSaving ? 'Saving...' : (voiceModeEnabled ? 'Voice mode enabled' : 'Voice mode disabled')}
                            </span>
                        </div>
                        {voiceError && (
                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                                {voiceError}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 px-1">Recent Exams</h3>
                    {examAttempts && examAttempts.length > 0 ? (
                        <div className="space-y-4">
                            {examAttempts.slice(0, 5).map((attempt, index) => (
                                <div key={attempt._id} className="flex items-center gap-4 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group cursor-pointer">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform" style={{ background: gradients[index % gradients.length] }}>
                                        <span className="material-symbols-outlined text-[24px]">quiz</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-900 dark:text-white truncate">{attempt.topicTitle}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-[100px]">
                                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(attempt.score / attempt.totalQuestions) * 100}%` }}></div>
                                            </div>
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                                {Math.round((attempt.score / attempt.totalQuestions) * 100)}%
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 whitespace-nowrap">{formatDate(attempt._creationTime)}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/30 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                                <span className="material-symbols-outlined text-3xl">quiz</span>
                            </div>
                            <p className="font-medium text-slate-900 dark:text-white">No exam attempts yet</p>
                            <Link to="/dashboard" className="text-primary font-bold text-sm hover:underline mt-1 inline-block">Start learning</Link>
                        </div>
                    )}
                </div>

                {/* Upload History */}
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 px-1">Recent Uploads</h3>
                    {uploads && uploads.length > 0 ? (
                        <div className="space-y-4">
                            {uploads.slice(0, 5).map((upload) => (
                                <div key={upload._id} className="flex items-center gap-4 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-slate-500 text-[28px]">
                                            {upload.fileType === 'pdf' ? 'picture_as_pdf' : 'slideshow'}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-900 dark:text-white truncate">{upload.fileName}</p>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {(upload.fileSize / (1024 * 1024)).toFixed(2)} MB • {formatDate(upload._creationTime)}
                                        </p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${upload.status === 'ready' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                        upload.status === 'processing' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                        {upload.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/30 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                                <span className="material-symbols-outlined text-3xl">upload_file</span>
                            </div>
                            <p className="font-medium text-slate-900 dark:text-white">No uploads yet</p>
                            <Link to="/dashboard" className="text-primary font-bold text-sm hover:underline mt-1 inline-block">Upload materials</Link>
                        </div>
                    )}
                </div>
            </main>

            {/* Logout Button */}
            <div className="sticky md:fixed bottom-[68px] md:bottom-0 left-0 right-0 p-4 md:p-6 glass border-t border-slate-200/50 dark:border-slate-800/50 flex justify-center z-40">
                <button
                    onClick={handleLogout}
                    className="w-full max-w-md flex items-center justify-center gap-2 h-12 md:h-14 bg-red-50 text-red-600 dark:bg-red-900/10 dark:text-red-400 rounded-2xl font-bold hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors shadow-sm"
                >
                    <span className="material-symbols-outlined">logout</span>
                    Sign Out
                </button>
            </div>
        </div>
    );
};

export default Profile;
