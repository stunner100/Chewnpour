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
        'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', // Indigo -> Violet
        'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', // Blue -> Cyan
        'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', // Pink -> Rose
        'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)', // Emerald -> Blue
        'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', // Amber -> Red
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
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark font-body antialiased text-neutral-900 dark:text-neutral-100 transition-colors duration-300 min-h-screen flex flex-col overflow-x-hidden">
            {/* Enhanced Header */}
            <div className="sticky top-0 z-50 flex items-center justify-between glass border-b border-neutral-200/50 dark:border-neutral-800/50 p-4 pb-4">
                <Link to="/dashboard" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-primary transition-all cursor-pointer">
                    <span className="material-symbols-outlined">arrow_back</span>
                </Link>
                <h2 className="text-lg font-bold leading-tight tracking-tight">Student Profile</h2>
                <button
                    onClick={() => navigate('/profile/edit')}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-primary transition-all"
                >
                    <span className="material-symbols-outlined">settings</span>
                </button>
            </div>

            <main className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-6 animate-slide-up">
                {/* Enhanced Profile Header with Stats */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-purple-500/5 to-primary/5 dark:from-primary/10 dark:via-purple-500/10 dark:to-primary/10 p-6 md:p-8">
                    <div className="relative flex flex-col items-center gap-5">
                        {/* Enhanced Avatar with Progress Ring */}
                        <div className="relative">
                            <div className="w-28 h-28 rounded-full p-1 bg-primary">
                                <div className="w-full h-full rounded-full bg-white dark:bg-neutral-900 p-1">
                                    <div
                                        className="w-full h-full rounded-full bg-center bg-no-repeat bg-cover flex items-center justify-center text-primary text-4xl font-bold"
                                        style={
                                            profile?.avatarUrl
                                                ? { backgroundImage: `url("${profile.avatarUrl}")` }
                                                : { background: gradients[profileGradientIndex] }
                                        }
                                    >
                                        {!profile?.avatarUrl && (displayName?.[0]?.toUpperCase() || '?')}
                                    </div>
                                </div>
                            </div>
                            {/* Streak Badge */}
                            {displayStats.streakDays > 0 && (
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-accent-amber text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px] filled">local_fire_department</span>
                                    <span>{displayStats.streakDays}-day streak</span>
                                </div>
                            )}
                        </div>

                        {/* Profile Info */}
                        <div className="text-center space-y-1">
                            <div className="flex items-center justify-center gap-2">
                                <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-neutral-900 dark:text-white">
                                    {displayName}
                                </h1>
                                {isPremium && (
                                    <span className="material-symbols-outlined text-primary text-xl filled">verified</span>
                                )}
                            </div>
                            <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">
                                {getDepartmentLabel(profile?.department)} • {getLevelLabel(profile?.educationLevel)}
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 w-full max-w-xs">
                            <button
                                onClick={() => navigate('/profile/edit')}
                                className="flex-1 h-11 bg-primary text-white rounded-2xl text-sm font-bold shadow-lg shadow-primary/25 hover:bg-primary-hover hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                Edit Profile
                            </button>
                            <button
                                onClick={() => shareProfile(displayName)}
                                className="h-11 w-11 rounded-2xl bg-white dark:bg-surface-dark border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all hover:-translate-y-0.5 shadow-sm"
                            >
                                <span className="material-symbols-outlined">share</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Enhanced Stats Cards */}
                <div className="grid grid-cols-4 gap-3">
                    <div
                        onClick={() => setStatsModal({ open: true, type: 'topics' })}
                        className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group cursor-pointer"
                    >
                        <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/25 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined filled text-lg">menu_book</span>
                        </div>
                        <p className="text-xl font-bold text-neutral-900 dark:text-white">{displayStats.topics}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Topics</p>
                    </div>
                    <div
                        onClick={() => setStatsModal({ open: true, type: 'accuracy' })}
                        className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group cursor-pointer"
                    >
                        <div className="w-10 h-10 rounded-xl bg-accent-emerald text-white flex items-center justify-center shadow-lg shadow-accent-emerald/25 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined filled text-lg">check_circle</span>
                        </div>
                        <p className="text-xl font-bold text-neutral-900 dark:text-white">{displayStats.accuracy}%</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Accuracy</p>
                    </div>
                    <div
                        onClick={() => setStatsModal({ open: true, type: 'courses' })}
                        className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group cursor-pointer"
                    >
                        <div className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center shadow-lg shadow-secondary/25 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined filled text-lg">school</span>
                        </div>
                        <p className="text-xl font-bold text-neutral-900 dark:text-white">{displayStats.courses}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Courses</p>
                    </div>
                    <div
                        onClick={() => setStatsModal({ open: true, type: 'hours' })}
                        className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group cursor-pointer"
                    >
                        <div className="w-10 h-10 rounded-xl bg-accent-amber text-white flex items-center justify-center shadow-lg shadow-accent-amber/25 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined filled text-lg">schedule</span>
                        </div>
                        <p className="text-xl font-bold text-neutral-900 dark:text-white">{Number(displayStats.studyTime || 0).toFixed(1)}h</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Hours</p>
                    </div>
                </div>

                {/* Premium Subscription Card */}
                <div className={`p-5 rounded-2xl shadow-lg relative overflow-hidden ${isPremium ? 'bg-primary' : 'bg-white dark:bg-surface-dark border border-neutral-200 dark:border-neutral-800'}`}>
                    {isPremium ? (
                        <>
                            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl"></div>
                            <div className="relative z-10 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                        <span className="material-symbols-outlined text-3xl text-white filled">diamond</span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xl font-bold text-white">Premium Plan</p>
                                            <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold text-white uppercase tracking-wider">Active</span>
                                        </div>
                                        <p className="text-sm text-white/80">Unlimited access to all features</p>
                                    </div>
                                </div>
                                <Link to="/subscription" className="px-4 py-2 bg-white text-primary rounded-xl text-sm font-bold hover:bg-white/90 transition-colors">
                                    Buy Credits
                                </Link>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-3xl text-neutral-400">card_membership</span>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-neutral-900 dark:text-white">Free Plan</p>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Upgrade to unlock all features</p>
                                </div>
                            </div>
                            <Link to="/subscription" className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                                Upgrade
                            </Link>
                        </div>
                    )}
                </div>

                {/* Referral Program */}
                <div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-3">Refer a Friend</h3>
                    <div className="p-5 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                                <span className="material-symbols-outlined filled text-xl">card_giftcard</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-neutral-900 dark:text-white text-sm">Earn free upload credits</p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                    Share your link. When a friend signs up and uploads their first document, you both get +1 free credit.
                                </p>
                            </div>
                        </div>

                        {/* Referral Link */}
                        {referralLink && (
                            <div className="flex items-center gap-2">
                                <div className="flex-1 min-w-0 h-11 px-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 flex items-center">
                                    <p className="text-xs font-mono text-neutral-600 dark:text-neutral-300 truncate">
                                        {referralLink}
                                    </p>
                                </div>
                                <button
                                    onClick={handleCopyReferralLink}
                                    className={`h-11 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                                        referralCopied
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:scale-95'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        {referralCopied ? 'check' : 'content_copy'}
                                    </span>
                                    {referralCopied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        )}

                        {/* Share Buttons */}
                        {referralLink && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleShareWhatsApp}
                                    className="flex-1 h-11 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white text-sm font-bold transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/25"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                    WhatsApp
                                </button>
                                <button
                                    onClick={handleShareTelegram}
                                    className="flex-1 h-11 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm font-bold transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-[#0088cc]/25"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                                    </svg>
                                    Telegram
                                </button>
                            </div>
                        )}

                        {/* Referral Stats */}
                        {referralStats && (
                            <div className="flex gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                                <div className="flex-1 text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
                                    <p className="text-lg font-bold text-neutral-900 dark:text-white">{referralStats.successfulReferrals}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Referrals</p>
                                </div>
                                <div className="flex-1 text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
                                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">+{referralStats.creditsEarned}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Credits Earned</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Access Grid */}
                <div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-3">Quick Access</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <Link to="/dashboard/assignment-helper" className="flex items-center gap-4 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
                            <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined filled text-xl">assignment</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-neutral-900 dark:text-white">Assignment Helper</p>
                                <p className="text-xs text-neutral-400">Get AI answers</p>
                            </div>
                            <span className="material-symbols-outlined text-neutral-300 ml-auto group-hover:text-primary group-hover:translate-x-1 transition-all">arrow_forward</span>
                        </Link>
                        <Link to="/dashboard/humanizer" className="flex items-center gap-4 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
                            <div className="w-12 h-12 rounded-xl bg-secondary text-white flex items-center justify-center shadow-lg shadow-secondary/20 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined filled text-xl">auto_fix_high</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-neutral-900 dark:text-white">AI Humanizer</p>
                                <p className="text-xs text-neutral-400">Bypass detection</p>
                            </div>
                            <span className="material-symbols-outlined text-neutral-300 ml-auto group-hover:text-primary group-hover:translate-x-1 transition-all">arrow_forward</span>
                        </Link>
                        <Link to="/dashboard/exam" className="flex items-center gap-4 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
                            <div className="w-12 h-12 rounded-xl bg-accent-emerald text-white flex items-center justify-center shadow-lg shadow-accent-emerald/20 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined filled text-xl">quiz</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-neutral-900 dark:text-white">Past Questions</p>
                                <p className="text-xs text-neutral-400">Test your knowledge</p>
                            </div>
                            <span className="material-symbols-outlined text-neutral-300 ml-auto group-hover:text-primary group-hover:translate-x-1 transition-all">arrow_forward</span>
                        </Link>
                        <Link to="/dashboard" className="flex items-center gap-4 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
                            <div className="w-12 h-12 rounded-xl bg-accent-amber text-white flex items-center justify-center shadow-lg shadow-accent-amber/20 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined filled text-xl">dashboard</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-neutral-900 dark:text-white">Dashboard</p>
                                <p className="text-xs text-neutral-400">Go to dashboard</p>
                            </div>
                            <span className="material-symbols-outlined text-neutral-300 ml-auto group-hover:text-primary group-hover:translate-x-1 transition-all">arrow_forward</span>
                        </Link>
                    </div>
                </div>

                {/* Settings Cards */}
                <div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-3">Settings</h3>
                    <div className="space-y-3">
                        {/* Voice Mode Toggle */}
                        <div className="p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 flex items-center justify-center">
                                        <span className="material-symbols-outlined filled">volume_up</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-neutral-900 dark:text-white text-sm">Voice Mode</p>
                                        <p className="text-xs text-neutral-400">Read topics aloud</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleVoiceModeToggle}
                                    disabled={voiceSaving}
                                    className={`relative w-12 h-7 rounded-full transition-colors ${voiceModeEnabled ? 'bg-primary' : 'bg-neutral-300 dark:bg-neutral-600'} ${voiceSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    aria-label="Toggle voice mode"
                                    aria-pressed={voiceModeEnabled}
                                >
                                    <span
                                        className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${voiceModeEnabled ? 'translate-x-5' : ''}`}
                                    />
                                </button>
                            </div>
                            {voiceError && (
                                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                                    {voiceError}
                                </div>
                            )}
                        </div>

                        {/* Dark Mode Toggle */}
                        <div className="p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 flex items-center justify-center">
                                        <span className="material-symbols-outlined filled">dark_mode</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-neutral-900 dark:text-white text-sm">Dark Mode</p>
                                        <p className="text-xs text-neutral-400">Toggle appearance</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleDarkModeToggle}
                                    className="relative w-12 h-7 rounded-full bg-neutral-300 dark:bg-primary transition-colors"
                                    aria-label="Toggle dark mode"
                                    aria-pressed={darkModeEnabled}
                                >
                                    <span
                                        className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${darkModeEnabled ? 'translate-x-5' : ''}`}
                                    />
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Email Notifications */}
                <div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-3">Email Notifications</h3>
                    <div className="space-y-3">
                        {/* Streak Reminders */}
                        <div className="p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 flex items-center justify-center">
                                        <span className="material-symbols-outlined filled">local_fire_department</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-neutral-900 dark:text-white text-sm">Streak Reminders</p>
                                        <p className="text-xs text-neutral-400">Get notified when your streak is at risk</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleEmailPrefToggle('streakReminders')}
                                    disabled={emailPrefSaving === 'streakReminders'}
                                    className={`relative w-12 h-7 rounded-full transition-colors ${emailPrefs.streakReminders ? 'bg-primary' : 'bg-neutral-300 dark:bg-neutral-600'} ${emailPrefSaving === 'streakReminders' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    aria-label="Toggle streak reminders"
                                    aria-pressed={emailPrefs.streakReminders}
                                >
                                    <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${emailPrefs.streakReminders ? 'translate-x-5' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Streak Broken */}
                        <div className="p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center">
                                        <span className="material-symbols-outlined filled">heart_broken</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-neutral-900 dark:text-white text-sm">Streak Broken</p>
                                        <p className="text-xs text-neutral-400">Know when your streak ends</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleEmailPrefToggle('streakBroken')}
                                    disabled={emailPrefSaving === 'streakBroken'}
                                    className={`relative w-12 h-7 rounded-full transition-colors ${emailPrefs.streakBroken ? 'bg-primary' : 'bg-neutral-300 dark:bg-neutral-600'} ${emailPrefSaving === 'streakBroken' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    aria-label="Toggle streak broken notifications"
                                    aria-pressed={emailPrefs.streakBroken}
                                >
                                    <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${emailPrefs.streakBroken ? 'translate-x-5' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Weekly Summary */}
                        <div className="p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center">
                                        <span className="material-symbols-outlined filled">summarize</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-neutral-900 dark:text-white text-sm">Weekly Summary</p>
                                        <p className="text-xs text-neutral-400">Receive a weekly study digest</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleEmailPrefToggle('weeklySummary')}
                                    disabled={emailPrefSaving === 'weeklySummary'}
                                    className={`relative w-12 h-7 rounded-full transition-colors ${emailPrefs.weeklySummary ? 'bg-primary' : 'bg-neutral-300 dark:bg-neutral-600'} ${emailPrefSaving === 'weeklySummary' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    aria-label="Toggle weekly summary"
                                    aria-pressed={emailPrefs.weeklySummary}
                                >
                                    <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${emailPrefs.weeklySummary ? 'translate-x-5' : ''}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Support & Community Cards */}
                <div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-3">Support & Community</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <a href="mailto:info@chewnpour.com" className="flex flex-col gap-2 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
                            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined filled text-lg">mail</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-neutral-900 dark:text-white">Email Us</p>
                                <p className="text-xs text-neutral-400">Get direct support</p>
                            </div>
                        </a>
                        <a href="https://t.me/+jIHi6XFYdl9kNDA0" target="_blank" rel="noopener noreferrer" className="flex flex-col gap-2 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-blue-400/30 transition-all group">
                            <div className="w-10 h-10 rounded-xl bg-accent-cyan text-white flex items-center justify-center shadow-lg shadow-accent-cyan/20 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined filled text-lg">forum</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-neutral-900 dark:text-white">Telegram</p>
                                <p className="text-xs text-neutral-400">Join our community</p>
                            </div>
                        </a>
                    </div>
                </div>

                {/* Recent Exams */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-bold text-neutral-900 dark:text-white">Recent Exams</h3>
                        {examAttempts && examAttempts.length > 0 && (
                            <Link to="/dashboard/analysis" className="text-xs font-bold text-primary hover:underline">View all</Link>
                        )}
                    </div>
                    {examAttempts && examAttempts.length > 0 ? (
                        <div className="space-y-2">
                            {examAttempts.slice(0, 3).map((attempt, index) => {
                                const scorePercent = Math.round((attempt.score / attempt.totalQuestions) * 100);
                                const isExcellent = scorePercent >= 80;
                                const isGood = scorePercent >= 60;
                                return (
                                    <div
                                        key={attempt._id}
                                        onClick={() => setExamModal({ open: true, attempt })}
                                        className="flex items-center gap-4 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                                    >
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md" style={{ background: gradients[index % gradients.length] }}>
                                            <span className="material-symbols-outlined text-lg">quiz</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-neutral-900 dark:text-white text-sm truncate">{attempt.topicTitle}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden max-w-[80px]">
                                                    <div
                                                        className={`h-full rounded-full ${isExcellent ? 'bg-green-500' : isGood ? 'bg-amber-500' : 'bg-red-500'}`}
                                                        style={{ width: `${scorePercent}%` }}
                                                    ></div>
                                                </div>
                                                <p className={`text-xs font-bold ${isExcellent ? 'text-green-600' : isGood ? 'text-amber-600' : 'text-red-600'}`}>
                                                    {scorePercent}%
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-neutral-400 whitespace-nowrap">{formatDate(attempt._creationTime)}</p>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-neutral-50 dark:bg-neutral-800/30 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-700">
                            <div className="w-14 h-14 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-3 text-neutral-400">
                                <span className="material-symbols-outlined text-2xl">quiz</span>
                            </div>
                            <p className="font-medium text-neutral-900 dark:text-white text-sm">No exam attempts yet</p>
                            <Link to="/dashboard" className="text-primary font-bold text-xs hover:underline mt-1 inline-block">Start learning</Link>
                        </div>
                    )}
                </div>

                {/* Logout Button */}
                <div className="pt-4">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 h-12 bg-white dark:bg-surface-dark border border-neutral-200 dark:border-neutral-700 text-red-600 dark:text-red-400 rounded-2xl font-bold hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        Sign Out
                    </button>
                </div>
            </main>

            {/* Stats Detail Modal */}
            <StatsDetailModal
                isOpen={statsModal.open}
                onClose={() => setStatsModal({ open: false, type: null })}
                type={statsModal.type}
                userId={userId}
            />

            {/* Exam Action Modal */}
            <ExamActionModal
                isOpen={examModal.open}
                onClose={() => setExamModal({ open: false, attempt: null })}
                attempt={examModal.attempt}
            />

            {/* Toast Notification */}
            <Toast message={toastMessage} onClose={hideToast} />
        </div>
    );
};

export default Profile;
