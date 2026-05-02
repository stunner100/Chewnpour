import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import StatsDetailModal from '../components/StatsDetailModal';
import ExamActionModal from '../components/ExamActionModal';
import Toast from '../components/Toast';
import { useShare } from '../hooks/useShare';
import { isDarkModeEnabled, toggleThemePreference } from '../lib/theme';

const Profile = () => {
    const { user, signOut, updateProfile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { shareProfile, toastMessage, hideToast } = useShare();
    const [voiceSaving, setVoiceSaving] = useState(false);
    const [voiceError, setVoiceError] = useState('');
    const [darkModeEnabled, setDarkModeEnabled] = useState(() => isDarkModeEnabled());
    const [emailPrefSaving, setEmailPrefSaving] = useState(null); // key being saved
    const [showAllExamAttempts, setShowAllExamAttempts] = useState(false);

    const updateEmailPreferences = useMutation(api.profiles.updateEmailPreferences);
    const ensureReferralCode = useMutation(api.profiles.ensureReferralCode);
    const [referralCopied, setReferralCopied] = useState(false);

    // Modal states
    const [statsModal, setStatsModal] = useState({ open: false, type: null });
    const [examModal, setExamModal] = useState({ open: false, attempt: null });

    // Get userId from Better Auth session
    const userId = user?.id;

    // Convex queries for real data
    const profile = useQuery(api.profiles.getProfile, userId ? { userId } : 'skip');
    const stats = useQuery(api.profiles.getUserStats, userId ? { userId } : 'skip');
    const subscription = useQuery(api.subscriptions.getSubscription, userId ? { userId } : 'skip');
    const examAttempts = useQuery(api.exams.getUserExamAttempts, userId ? { userId } : 'skip');
    const referralStats = useQuery(api.profiles.getReferralStats, userId ? { userId } : 'skip');

    // Ensure user has a referral code on profile load
    useEffect(() => {
        if (userId && profile && !profile.referralCode) {
            ensureReferralCode({ userId }).catch(() => {});
        }
    }, [userId, profile, ensureReferralCode]);

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
        'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
        'linear-gradient(135deg, #34a853 0%, #0d9488 100%)',
        'linear-gradient(135deg, #ea4335 0%, #d93025 100%)',
        'linear-gradient(135deg, #fbbc04 0%, #f59e0b 100%)',
        'linear-gradient(135deg, #5f6368 0%, #3c4043 100%)',
    ];

    const displayName = profile?.fullName || user?.name || user?.email?.split('@')[0] || 'Student';
    const displayStats = stats || { topics: 0, accuracy: 0, courses: 0, studyTime: 0, streakDays: 0 };
    const displaySubscription = subscription || { plan: 'free', status: 'active' };
    const voiceModeEnabled = Boolean(profile?.voiceModeEnabled);
    const isPremium = displaySubscription.plan === 'premium';
    const profileGradientIndex = Number.isInteger(Number(profile?.avatarGradient))
        ? Math.min(
            gradients.length - 1,
            Math.max(0, Number(profile?.avatarGradient))
        )
        : 0;

    const handleVoiceModeToggle = async () => {
        setVoiceError('');
        setVoiceSaving(true);
        const { error } = await updateProfile({ voiceModeEnabled: !voiceModeEnabled });
        if (error) {
            setVoiceError(error.message || 'Unable to update voice mode setting');
        }
        setVoiceSaving(false);
    };

    const handleDarkModeToggle = () => {
        const nextTheme = toggleThemePreference();
        setDarkModeEnabled(nextTheme === 'dark');
    };

    const referralCode = referralStats?.referralCode || profile?.referralCode || '';
    const referralLink = referralCode ? `https://www.chewnpour.com/signup?ref=${referralCode}` : '';
    const hasMoreExamAttempts = Array.isArray(examAttempts) && examAttempts.length > 3;
    const visibleExamAttempts = hasMoreExamAttempts && !showAllExamAttempts
        ? examAttempts.slice(0, 3)
        : examAttempts || [];

    const handleCopyReferralLink = useCallback(async () => {
        if (!referralLink) return;
        try {
            await navigator.clipboard.writeText(referralLink);
            setReferralCopied(true);
            setTimeout(() => setReferralCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = referralLink;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setReferralCopied(true);
            setTimeout(() => setReferralCopied(false), 2000);
        }
    }, [referralLink]);

    const handleShareWhatsApp = useCallback(() => {
        if (!referralLink) return;
        const text = `Hey! Join me on Chew & Pour - the AI study app for Ghanaian students. Upload your notes and get AI-generated lessons and quizzes. Sign up with my link and we both get a free upload credit!\n\n${referralLink}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }, [referralLink]);

    const handleShareTelegram = useCallback(() => {
        if (!referralLink) return;
        const text = `Hey! Join me on Chew & Pour - the AI study app for Ghanaian students. Upload your notes and get AI-generated lessons and quizzes. Sign up with my link and we both get a free upload credit!`;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`, '_blank');
    }, [referralLink]);

    const emailPrefs = profile?.emailPreferences ?? {
        streakReminders: true,
        streakBroken: true,
        weeklySummary: true,
        productResearch: true,
        winbackOffers: true,
    };

    const handleEmailPrefToggle = async (key) => {
        if (!userId || emailPrefSaving) return;
        setEmailPrefSaving(key);
        try {
            await updateEmailPreferences({
                userId,
                [key]: !emailPrefs[key],
            });
        } catch (err) {
            console.error('Failed to update email preference', err);
        }
        setEmailPrefSaving(null);
    };

    const loading = authLoading || profile === undefined || stats === undefined;

    if (loading) {
        return (
            <div className="w-full max-w-3xl mx-auto px-4 md:px-8 py-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-32 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark" />
                    <div className="grid grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark" />)}
                    </div>
                    <div className="h-24 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto px-4 md:px-8 py-8 pb-24 md:pb-12 space-y-6">
            {/* Profile Header */}
            <div className="card-base p-6">
                <div className="flex items-start gap-5">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                        <div
                            className="w-20 h-20 rounded-full bg-center bg-no-repeat bg-cover flex items-center justify-center text-white text-2xl font-bold"
                            style={
                                profile?.avatarUrl
                                    ? { backgroundImage: `url("${profile.avatarUrl}")` }
                                    : { background: gradients[profileGradientIndex] }
                            }
                        >
                            {!profile?.avatarUrl && (displayName?.[0]?.toUpperCase() || '?')}
                        </div>
                        {displayStats.streakDays > 0 && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-accent-amber text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5 whitespace-nowrap">
                                <span className="material-symbols-outlined text-[12px] filled">local_fire_department</span>
                                {displayStats.streakDays}d
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark truncate">
                                {displayName}
                            </h1>
                            {isPremium && (
                                <span className="material-symbols-outlined text-primary text-[18px] filled">verified</span>
                            )}
                        </div>
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-0.5">
                            {getDepartmentLabel(profile?.department)} · {getLevelLabel(profile?.educationLevel)}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                            <button
                                onClick={() => navigate('/profile/edit')}
                                className="btn-primary text-body-sm px-4 py-2 flex items-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                Edit Profile
                            </button>
                            <button
                                onClick={() => shareProfile(displayName)}
                                className="btn-icon w-9 h-9"
                                aria-label="Share profile"
                            >
                                <span className="material-symbols-outlined text-[16px]">share</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { type: 'topics', icon: 'menu_book', value: displayStats.topics, label: 'Topics' },
                    { type: 'accuracy', icon: 'check_circle', value: `${displayStats.accuracy}%`, label: 'Accuracy' },
                    { type: 'courses', icon: 'school', value: displayStats.courses, label: 'Courses' },
                    { type: 'hours', icon: 'schedule', value: `${Number(displayStats.studyTime || 0).toFixed(1)}h`, label: 'Hours' },
                ].map(stat => (
                    <button
                        key={stat.type}
                        onClick={() => setStatsModal({ open: true, type: stat.type })}
                        className="card-base p-3 flex flex-col items-center gap-1.5 hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-primary text-[18px]">{stat.icon}</span>
                        <p className="text-display-sm text-text-main-light dark:text-text-main-dark">{stat.value}</p>
                        <p className="text-overline text-text-faint-light dark:text-text-faint-dark">{stat.label}</p>
                    </button>
                ))}
            </div>

            {/* Subscription */}
            <div className={`card-base p-4 ${isPremium ? 'bg-primary border-primary' : ''}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPremium ? 'bg-white/20' : 'bg-primary/8 dark:bg-primary/15'}`}>
                            <span className={`material-symbols-outlined text-[20px] ${isPremium ? 'text-white' : 'text-primary'}`}>
                                {isPremium ? 'diamond' : 'card_membership'}
                            </span>
                        </div>
                        <div>
                            <p className={`text-body-base font-semibold ${isPremium ? 'text-white' : 'text-text-main-light dark:text-text-main-dark'}`}>
                                {isPremium ? 'Premium Plan' : 'Free Plan'}
                            </p>
                            <p className={`text-caption ${isPremium ? 'text-white/70' : 'text-text-sub-light dark:text-text-sub-dark'}`}>
                                {isPremium ? 'Unlimited access to all features' : 'Upgrade to unlock all features'}
                            </p>
                        </div>
                    </div>
                    <Link
                        to="/subscription"
                        className={`text-body-sm font-semibold px-4 py-2 rounded-xl transition-colors ${isPremium ? 'bg-white text-primary hover:bg-white/90' : 'btn-primary'}`}
                    >
                        {isPremium ? 'Buy Credits' : 'Upgrade'}
                    </Link>
                </div>
            </div>

            {/* Referral Program */}
            <div className="card-base p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">Refer a Friend</h3>
                    <span className="material-symbols-outlined text-primary text-[18px]">card_giftcard</span>
                </div>
                <p className="text-caption text-text-sub-light dark:text-text-sub-dark">
                    Share your link. When a friend signs up and uploads their first document, you both get +1 free credit.
                </p>

                {referralLink && (
                    <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 h-10 px-3 bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark flex items-center">
                            <p className="text-caption font-mono text-text-sub-light dark:text-text-sub-dark truncate">
                                {referralLink}
                            </p>
                        </div>
                        <button
                            onClick={handleCopyReferralLink}
                            className={`h-10 px-3 rounded-lg text-body-sm font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
                                referralCopied
                                    ? 'bg-accent-emerald/10 text-accent-emerald'
                                    : 'btn-primary'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                {referralCopied ? 'check' : 'content_copy'}
                            </span>
                            {referralCopied ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                )}

                {referralLink && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleShareWhatsApp}
                            className="flex-1 h-10 rounded-lg bg-[#25D366] hover:bg-[#20BD5A] text-white text-body-sm font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WhatsApp
                        </button>
                        <button
                            onClick={handleShareTelegram}
                            className="flex-1 h-10 rounded-lg bg-[#0088cc] hover:bg-[#0077b5] text-white text-body-sm font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                            </svg>
                            Telegram
                        </button>
                    </div>
                )}

                {referralStats && (
                    <div className="flex gap-3 pt-3 border-t border-border-light dark:border-border-dark">
                        <div className="flex-1 text-center">
                            <p className="text-display-sm text-text-main-light dark:text-text-main-dark">{referralStats.successfulReferrals}</p>
                            <p className="text-overline text-text-faint-light dark:text-text-faint-dark">Referrals</p>
                        </div>
                        <div className="flex-1 text-center">
                            <p className="text-display-sm text-accent-emerald">+{referralStats.creditsEarned}</p>
                            <p className="text-overline text-text-faint-light dark:text-text-faint-dark">Credits Earned</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Access */}
            <div>
                <h3 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark mb-3">Quick Access</h3>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { to: '/dashboard/assignment-helper', icon: 'assignment', label: 'Assignment Helper', sub: 'Get AI answers' },
                        { to: '/dashboard/humanizer', icon: 'auto_fix_high', label: 'Rewrite & Polish', sub: 'Improve clarity and tone' },
                        { to: '/dashboard/exam', icon: 'quiz', label: 'Past Questions', sub: 'Coming soon' },
                        { to: '/dashboard', icon: 'dashboard', label: 'Dashboard', sub: 'Go to dashboard' },
                    ].map(item => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className="card-interactive p-4 flex items-center gap-3"
                        >
                            <div className="w-9 h-9 rounded-lg bg-primary/8 dark:bg-primary/15 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-primary text-[18px]">{item.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">{item.label}</p>
                                <p className="text-caption text-text-faint-light dark:text-text-faint-dark">{item.sub}</p>
                            </div>
                            <span className="material-symbols-outlined text-[16px] text-text-faint-light dark:text-text-faint-dark">chevron_right</span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Settings */}
            <div>
                <h3 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark mb-3">Settings</h3>
                <div className="card-base divide-y divide-border-light dark:divide-border-dark">
                    {/* Voice Mode */}
                    <div className="flex items-center justify-between gap-4 p-4">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-text-sub-light dark:text-text-sub-dark text-[20px]">volume_up</span>
                            <div>
                                <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Voice Mode</p>
                                <p className="text-caption text-text-faint-light dark:text-text-faint-dark">Read topics aloud</p>
                            </div>
                        </div>
                        <button
                            onClick={handleVoiceModeToggle}
                            disabled={voiceSaving}
                            className={`relative w-11 h-6 rounded-full transition-colors ${voiceModeEnabled ? 'bg-primary' : 'bg-border-light dark:bg-border-dark'} ${voiceSaving ? 'opacity-50' : ''}`}
                            aria-label="Toggle voice mode"
                            aria-pressed={voiceModeEnabled}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${voiceModeEnabled ? 'translate-x-5' : ''}`} />
                        </button>
                    </div>
                    {voiceError && (
                        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/10">
                            <p className="text-caption text-red-600 dark:text-red-400">{voiceError}</p>
                        </div>
                    )}

                    {/* Dark Mode */}
                    <div className="flex items-center justify-between gap-4 p-4">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-text-sub-light dark:text-text-sub-dark text-[20px]">dark_mode</span>
                            <div>
                                <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Dark Mode</p>
                                <p className="text-caption text-text-faint-light dark:text-text-faint-dark">Toggle appearance</p>
                            </div>
                        </div>
                        <button
                            onClick={handleDarkModeToggle}
                            className={`relative w-11 h-6 rounded-full transition-colors ${darkModeEnabled ? 'bg-primary' : 'bg-border-light dark:bg-border-dark'}`}
                            aria-label="Toggle dark mode"
                            aria-pressed={darkModeEnabled}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${darkModeEnabled ? 'translate-x-5' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Email Notifications */}
            <div>
                <h3 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark mb-3">Email Notifications</h3>
                <div className="card-base divide-y divide-border-light dark:divide-border-dark">
                    {[
                        { key: 'streakReminders', icon: 'local_fire_department', label: 'Streak Reminders', sub: 'Get notified when your streak is at risk' },
                        { key: 'streakBroken', icon: 'heart_broken', label: 'Streak Broken', sub: 'Know when your streak ends' },
                        { key: 'weeklySummary', icon: 'summarize', label: 'Weekly Summary', sub: 'Receive a weekly study digest' },
                    ].map(pref => (
                        <div key={pref.key} className="flex items-center justify-between gap-4 p-4">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-text-sub-light dark:text-text-sub-dark text-[20px]">{pref.icon}</span>
                                <div>
                                    <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">{pref.label}</p>
                                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark">{pref.sub}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleEmailPrefToggle(pref.key)}
                                disabled={emailPrefSaving === pref.key}
                                className={`relative w-11 h-6 rounded-full transition-colors ${emailPrefs[pref.key] ? 'bg-primary' : 'bg-border-light dark:bg-border-dark'} ${emailPrefSaving === pref.key ? 'opacity-50' : ''}`}
                                aria-label={`Toggle ${pref.label}`}
                                aria-pressed={emailPrefs[pref.key]}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${emailPrefs[pref.key] ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Support */}
            <div>
                <h3 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark mb-3">Support</h3>
                <div className="card-base divide-y divide-border-light dark:divide-border-dark">
                    <a href="mailto:info@chewnpour.com" className="flex items-center gap-3 p-4 hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors">
                        <span className="material-symbols-outlined text-text-sub-light dark:text-text-sub-dark text-[20px]">mail</span>
                        <div className="flex-1">
                            <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Email Us</p>
                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark">Get direct support</p>
                        </div>
                        <span className="material-symbols-outlined text-[16px] text-text-faint-light dark:text-text-faint-dark">chevron_right</span>
                    </a>
                    <a href="https://t.me/+jIHi6XFYdl9kNDA0" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors">
                        <span className="material-symbols-outlined text-text-sub-light dark:text-text-sub-dark text-[20px]">forum</span>
                        <div className="flex-1">
                            <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Telegram Community</p>
                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark">Join our community</p>
                        </div>
                        <span className="material-symbols-outlined text-[16px] text-text-faint-light dark:text-text-faint-dark">chevron_right</span>
                    </a>
                </div>
            </div>

            {/* Recent Exams */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">Recent Exams</h3>
                    {hasMoreExamAttempts && (
                        <button
                            type="button"
                            onClick={() => setShowAllExamAttempts(c => !c)}
                            className="text-caption font-semibold text-primary hover:text-primary-hover transition-colors"
                        >
                            {showAllExamAttempts ? 'Show less' : 'View all'}
                        </button>
                    )}
                </div>
                {visibleExamAttempts.length > 0 ? (
                    <div className="card-base divide-y divide-border-light dark:divide-border-dark">
                        {visibleExamAttempts.map((attempt) => {
                            const scorePercent = Math.round((attempt.score / attempt.totalQuestions) * 100);
                            const isExcellent = scorePercent >= 80;
                            const isGood = scorePercent >= 60;
                            return (
                                <button
                                    key={attempt._id}
                                    onClick={() => setExamModal({ open: true, attempt })}
                                    className="w-full flex items-center gap-3 p-4 hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors text-left"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-primary/8 dark:bg-primary/15 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-primary text-[18px]">quiz</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark truncate">{attempt.topicTitle}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 h-1 bg-border-light dark:bg-border-dark rounded-full overflow-hidden max-w-[60px]">
                                                <div
                                                    className={`h-full rounded-full ${isExcellent ? 'bg-accent-emerald' : isGood ? 'bg-accent-amber' : 'bg-red-500'}`}
                                                    style={{ width: `${scorePercent}%` }}
                                                />
                                            </div>
                                            <span className={`text-caption font-semibold ${isExcellent ? 'text-accent-emerald' : isGood ? 'text-accent-amber' : 'text-red-500'}`}>
                                                {scorePercent}%
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-caption text-text-faint-light dark:text-text-faint-dark whitespace-nowrap">{formatDate(attempt._creationTime)}</span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="card-base border-dashed p-8 text-center">
                        <div className="w-12 h-12 rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark flex items-center justify-center mx-auto mb-3">
                            <span className="material-symbols-outlined text-text-faint-light dark:text-text-faint-dark text-xl">quiz</span>
                        </div>
                        <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">No exam attempts yet</p>
                        <Link to="/dashboard" className="text-caption font-semibold text-primary hover:text-primary-hover transition-colors mt-1 inline-block">Start learning</Link>
                    </div>
                )}
            </div>

            {/* Sign Out */}
            <div className="pt-2">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-border-light dark:border-border-dark text-red-600 dark:text-red-400 text-body-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Sign Out
                </button>
            </div>

            {/* Modals */}
            <StatsDetailModal
                isOpen={statsModal.open}
                onClose={() => setStatsModal({ open: false, type: null })}
                type={statsModal.type}
                userId={userId}
            />
            <ExamActionModal
                isOpen={examModal.open}
                onClose={() => setExamModal({ open: false, attempt: null })}
                attempt={examModal.attempt}
            />
            <Toast message={toastMessage} onClose={hideToast} />
        </div>
    );
};

export default Profile;
