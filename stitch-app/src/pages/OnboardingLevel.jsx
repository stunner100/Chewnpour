import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m as Motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { resolveOnboardingPath } from '../lib/onboarding';
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

const levelMap = { 100: 'freshman', 200: 'sophomore', 300: 'junior', 400: 'senior' };

const OnboardingLevel = () => {
    const [selectedLevel, setSelectedLevel] = useState(200);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { updateProfile, profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (authLoading) return;
        const nextPath = resolveOnboardingPath(profile);
        if (nextPath !== '/onboarding/level') navigate(nextPath, { replace: true });
    }, [profile, authLoading, navigate]);

    const handleNext = async () => {
        setLoading(true);
        setError('');
        try {
            await updateProfile({ educationLevel: levelMap[selectedLevel] });
            navigate('/onboarding/department');
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
            await updateProfile({ educationLevel: 'sophomore' });
            navigate('/onboarding/department');
        } catch {
            navigate('/onboarding/department');
        } finally {
            setLoading(false);
        }
    };

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
                    <OnboardingProgress step={2} total={3} />
                    <div className="flex items-center justify-between mt-4">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="inline-flex items-center justify-center size-9 rounded-full text-[#687384] hover:text-[#1F2933] hover:bg-[#F3EEE7] transition-colors"
                            aria-label="Back"
                        >
                            <AppIcon name="arrow_back" className="text-[20px]" />
                        </button>
                        <span className="text-xs font-semibold" style={{ color: SUBTEXT, fontFamily: 'DM Sans, sans-serif' }}>
                            Step 2 of 3
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

            <main className="flex-1 flex flex-col items-center justify-start px-6 pt-10 pb-32">
                <div className="text-center max-w-xl mb-10">
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
                            Your <span style={{ color: ACCENT }}>current</span> level?
                        </h1>
                    </BlurFade>
                    <BlurFade delay={0.15} yOffset={10}>
                        <p style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55 }}>
                            Select your academic year so we can tailor the difficulty.
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
                        className="w-full max-w-md mb-6 p-3.5 rounded-xl text-sm font-medium text-center"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', color: 'rgb(185,28,28)', fontFamily: 'DM Sans, sans-serif' }}
                    >
                        {error}
                    </Motion.div>
                )}

                <BlurFade delay={0.25} yOffset={10} className="w-full max-w-3xl">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[100, 200, 300, 400].map((level) => {
                            const isSelected = selectedLevel === level;
                            return (
                                <button
                                    key={level}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => setSelectedLevel(level)}
                                    className="group relative flex flex-col items-center justify-center p-6 aspect-[4/3] lg:aspect-square rounded-xl transition-all active:scale-[0.98]"
                                    style={{
                                        background: CARD_BG,
                                        border: `1px solid ${isSelected ? ACCENT : '#E7E0D4'}`,
                                        boxShadow: isSelected ? `0 0 0 3px rgba(13, 148, 136,0.18)` : 'none',
                                    }}
                                >
                                    {isSelected && (
                                        <AppIcon name="check_circle" className="absolute top-3 right-3" style={{ color: ACCENT, fontSize: 22}} />
                                    )}
                                    <span
                                        style={{
                                            fontFamily: 'Space Grotesk, sans-serif',
                                            fontWeight: 600,
                                            fontSize: 40,
                                            color: isSelected ? ACCENT : TEXT_MAIN,
                                            marginBottom: 4,
                                            letterSpacing: 0,
                                        }}
                                    >
                                        {level}
                                    </span>
                                    <span
                                        className="font-semibold uppercase tracking-widest"
                                        style={{ color: isSelected ? `${ACCENT}cc` : SUBTEXT, fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                                    >
                                        Level
                                    </span>
                                </button>
                            );
                        })}
                    </div>
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
                        onClick={handleNext}
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-lg text-white text-sm font-bold transition-opacity"
                        style={{
                            background: ACCENT,
                            fontFamily: 'DM Sans, sans-serif',
                            opacity: loading ? 0.55 : 1,
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <span>{loading ? 'Saving…' : 'Next'}</span>
                        <AppIcon name="arrow_forward" className="text-[20px]" />
                    </button>
                </div>
            </div>
            <WatermelonToaster position="bottom-center" />
        </div>
    );
};

export default OnboardingLevel;
