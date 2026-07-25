import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m as Motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/BrandLogo';
import { BlurFade } from '../components/magicui/BlurFade';
import { OnboardingProgress } from '../components/onboarding/OnboardingProgress';
import { WatermelonToaster } from '../components/watermelon/WatermelonSonner';
import { watermelonToast } from '../components/watermelon/watermelonToast';
import AppIcon from '../components/AppIcon';

const ACCENT = 'rgb(13, 148, 136)';
const PAGE_BG = '#FAFAFB';
const CARD_BG = '#FFFFFF';
const SUBTEXT = '#687384';
const TEXT_MAIN = '#1F2933';

const departments = [
    { value: 'cs', label: 'Computer Science', icon: 'terminal' },
    { value: 'business', label: 'Business', icon: 'trending_up' },
    { value: 'engineering', label: 'Engineering', icon: 'engineering' },
    { value: 'nursing', label: 'Nursing', icon: 'medical_services' },
    { value: 'economics', label: 'Economics', icon: 'account_balance' },
    { value: 'psychology', label: 'Psychology', icon: 'psychology' },
    { value: 'arts', label: 'Arts & Design', icon: 'palette' },
    { value: 'biology', label: 'Biology', icon: 'biotech' },
    { value: 'law', label: 'Law', icon: 'gavel' },
    { value: 'math', label: 'Mathematics', icon: 'calculate' },
];

const OnboardingDepartment = () => {
    const [selectedDepts, setSelectedDepts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { updateProfile, profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (authLoading) return;
        if (profile?.onboardingCompleted) navigate('/dashboard', { replace: true });
    }, [profile, authLoading, navigate]);

    const handleToggle = (value) => {
        setSelectedDepts((prev) =>
            prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
        );
    };

    const handleComplete = async () => {
        setLoading(true);
        setError('');
        try {
            await updateProfile({
                department: selectedDepts.length > 0 ? selectedDepts.join(',') : undefined,
                onboardingCompleted: true,
            });
            navigate('/dashboard', {
                replace: true,
                state: {
                    watermelonToast: {
                        message: "You're all set. Let's learn.",
                        type: 'success',
                    },
                },
            });
        } catch (err) {
            console.error('Failed to update profile:', err);
            const msg = 'Failed to save. Please try again.';
            setError(msg);
            watermelonToast(msg, { type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = async () => {
        setLoading(true);
        setError('');
        try {
            await updateProfile({ onboardingCompleted: true });
            navigate('/dashboard', { replace: true });
        } catch (err) {
            console.error('Failed to update profile on skip:', err);
            const msg = 'Failed to save. Please try again.';
            setError(msg);
            watermelonToast(msg, { type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const query = searchQuery.trim().toLowerCase();
    const visibleDepartments = query
        ? departments.filter((dept) => dept.label.toLowerCase().includes(query))
        : departments;

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{ background: PAGE_BG, color: TEXT_MAIN, fontFamily: '"Space Grotesk", "DM Sans", system-ui, sans-serif' }}
        >
            <header className="w-full pt-6 pb-2 px-6">
                <div className="max-w-md mx-auto">
                    <Link to="/" className="flex items-center gap-2.5 text-[#0F766E] mb-5" aria-label="ChewnPour home">
                        <BrandLogo size={28} decorative />
                    </Link>
                    <OnboardingProgress step={3} total={3} />
                    <div className="flex items-center justify-between mt-4">
                        <Link
                            to="/onboarding/level"
                            className="inline-flex items-center justify-center size-9 rounded-full text-[#687384] hover:text-[#1F2933] hover:bg-[#F3EEE7] transition-colors"
                            aria-label="Back"
                        >
                            <AppIcon name="arrow_back" className="text-[20px]" />
                        </Link>
                        <span className="text-xs font-semibold" style={{ color: SUBTEXT, fontFamily: 'DM Sans, sans-serif' }}>
                            Step 3 of 3
                        </span>
                        <button
                            onClick={handleSkip}
                            disabled={loading}
                            className="text-xs font-semibold hover:text-[#1F2933] transition-colors disabled:opacity-50"
                            style={{ color: SUBTEXT, fontFamily: 'DM Sans, sans-serif' }}
                        >
                            Skip
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-start px-6 pt-10 pb-32 w-full max-w-md mx-auto">
                <div className="text-center mb-6">
                    <BlurFade delay={0.05} yOffset={12}>
                        <h1
                            style={{
                                fontFamily: 'Space Grotesk, sans-serif',
                                fontWeight: 600,
                                fontSize: 'clamp(32px, 5vw, 44px)',
                                lineHeight: 1.05,
                                letterSpacing: '-0.025em',
                                marginBottom: 12,
                            }}
                        >
                            What do you <span style={{ color: ACCENT }}>study</span>?
                        </h1>
                    </BlurFade>
                    <BlurFade delay={0.15} yOffset={10}>
                        <p style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55 }}>
                            Choose your department so we can tailor lessons and study groups.
                        </p>
                    </BlurFade>
                </div>

                {error && (
                    <Motion.div
                        role="alert"
                        aria-atomic="true"
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full mb-4 p-3.5 rounded-xl text-sm font-medium text-center"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', color: 'rgb(185,28,28)', fontFamily: 'DM Sans, sans-serif' }}
                    >
                        {error}
                    </Motion.div>
                )}

                <BlurFade delay={0.2} yOffset={10} className="relative w-full mb-5">
                    <AppIcon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]" style={{ color: SUBTEXT}} />
                    <input
                        aria-label="Search departments"
                        className="h-12 w-full rounded-xl border border-[#D9D2C6] bg-white px-4 pl-10 text-sm text-[#1F2933] placeholder:text-[#8A94A6] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        placeholder="Search departments…"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </BlurFade>

                <BlurFade delay={0.28} yOffset={10} className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    {visibleDepartments.map((dept) => {
                        const isSelected = selectedDepts.includes(dept.value);
                        return (
                            <button
                                key={dept.value}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => handleToggle(dept.value)}
                                className="w-full min-h-[3.25rem] px-4 py-3 rounded-xl transition-all active:scale-[0.98] flex items-center gap-2.5 text-left"
                                style={{
                                    background: CARD_BG,
                                    border: `1px solid ${isSelected ? ACCENT : '#E7E0D4'}`,
                                    boxShadow: isSelected ? `0 0 0 3px rgba(13, 148, 136,0.18)` : 'none',
                                    color: isSelected ? ACCENT : TEXT_MAIN,
                                    fontFamily: 'DM Sans, sans-serif',
                                    fontWeight: isSelected ? 600 : 500,
                                }}
                            >
                                <AppIcon name={dept.icon} className="text-[18px] shrink-0" />
                                <span className="text-sm leading-tight">{dept.label}</span>
                            </button>
                        );
                    })}
                    {visibleDepartments.length === 0 && (
                        <p className="col-span-full text-sm py-4 text-center" style={{ color: SUBTEXT, fontFamily: 'DM Sans, sans-serif' }}>
                            No departments found.
                        </p>
                    )}
                </BlurFade>
            </main>

            <div
                className="fixed bottom-0 left-0 w-full p-5 pointer-events-none"
                style={{
                    background: `linear-gradient(to top, ${PAGE_BG} 60%, transparent)`,
                    paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))',
                }}
            >
                <div className="max-w-md mx-auto pointer-events-auto">
                    <button
                        onClick={handleComplete}
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-lg text-white text-sm font-bold transition-opacity"
                        style={{
                            background: ACCENT,
                            fontFamily: 'DM Sans, sans-serif',
                            opacity: loading ? 0.55 : 1,
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <span>{loading ? 'Saving…' : 'Start Learning'}</span>
                        <AppIcon name="arrow_forward" className="text-[20px]" />
                    </button>
                </div>
            </div>
            <WatermelonToaster position="bottom-center" />
        </div>
    );
};

export default OnboardingDepartment;
