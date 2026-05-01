import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { resolveOnboardingPath } from '../lib/onboarding';
import { HexLogo } from '../components/PublicShell';

const ACCENT = 'rgb(145, 75, 241)';
const PAGE_BG = 'rgb(16, 17, 18)';
const CARD_BG = 'rgb(39, 40, 41)';
const SUBTEXT = 'rgb(163, 163, 163)';

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
            setError('Failed to save. Please try again.');
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
            style={{ background: PAGE_BG, color: '#fff', fontFamily: '"Outfit", "Inter", system-ui, sans-serif' }}
        >
            <header className="w-full pt-6 pb-2 px-6">
                <div className="max-w-md mx-auto">
                    <Link to="/" className="flex items-center gap-2.5 text-white mb-5">
                        <HexLogo size={28} withWordmark />
                    </Link>
                    <div className="flex gap-2">
                        <div className="h-1 flex-1 rounded-full" style={{ background: ACCENT }} />
                        <div className="h-1 flex-1 rounded-full" style={{ background: ACCENT }} />
                        <div className="h-1 flex-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
                    </div>
                    <div className="flex items-center justify-between mt-4">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                            aria-label="Back"
                        >
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </button>
                        <span className="text-xs font-semibold" style={{ color: SUBTEXT, fontFamily: 'Inter, sans-serif' }}>
                            Step 2 of 3
                        </span>
                        <button
                            onClick={handleSkip}
                            disabled={loading}
                            className="text-xs font-semibold hover:text-white transition-colors disabled:opacity-50"
                            style={{ color: SUBTEXT, fontFamily: 'Inter, sans-serif' }}
                        >
                            Skip
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-start px-6 pt-10 pb-32">
                <div className="text-center max-w-xl mb-10">
                    <h1
                        style={{
                            fontFamily: 'Outfit, sans-serif',
                            fontWeight: 600,
                            fontSize: 'clamp(32px, 5vw, 44px)',
                            lineHeight: 1.05,
                            letterSpacing: '-0.025em',
                            marginBottom: 12,
                        }}
                    >
                        Your <span style={{ color: ACCENT }}>current</span> level?
                    </h1>
                    <p style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55 }}>
                        Select your academic year so we can tailor the difficulty.
                    </p>
                </div>

                {error && (
                    <div
                        className="w-full max-w-md mb-6 p-3.5 rounded-xl text-sm font-medium text-center"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: 'rgb(252,165,165)', fontFamily: 'Inter, sans-serif' }}
                    >
                        {error}
                    </div>
                )}

                <div className="w-full max-w-3xl">
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
                                        border: `1px solid ${isSelected ? ACCENT : 'rgba(255,255,255,0.08)'}`,
                                        boxShadow: isSelected ? `0 0 0 3px rgba(145,75,241,0.18)` : 'none',
                                    }}
                                >
                                    {isSelected && (
                                        <span
                                            className="material-symbols-outlined absolute top-3 right-3"
                                            style={{ color: ACCENT, fontSize: 22 }}
                                        >
                                            check_circle
                                        </span>
                                    )}
                                    <span
                                        style={{
                                            fontFamily: 'Outfit, sans-serif',
                                            fontWeight: 600,
                                            fontSize: 40,
                                            color: isSelected ? ACCENT : '#fff',
                                            marginBottom: 4,
                                            letterSpacing: '-0.025em',
                                        }}
                                    >
                                        {level}
                                    </span>
                                    <span
                                        className="font-semibold uppercase tracking-widest"
                                        style={{ color: isSelected ? `${ACCENT}cc` : SUBTEXT, fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                                    >
                                        Level
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
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
                            fontFamily: 'Inter, sans-serif',
                            opacity: loading ? 0.55 : 1,
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <span>{loading ? 'Saving…' : 'Next'}</span>
                        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingLevel;
