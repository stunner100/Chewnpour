import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { resolveOnboardingPath } from '../lib/onboarding';

const OnboardingLevel = () => {
    const [selectedLevel, setSelectedLevel] = useState(200);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { updateProfile, profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    // #2 — wait for auth to finish loading before redirecting
    useEffect(() => {
        if (authLoading) return;
        const nextPath = resolveOnboardingPath(profile);
        if (nextPath !== '/onboarding/level') {
            navigate(nextPath, { replace: true });
        }
    }, [profile, authLoading, navigate]);

    const levelMap = {
        100: 'freshman',
        200: 'sophomore',
        300: 'junior',
        400: 'senior'
    };

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
        } catch (err) {
            console.error('Failed to update profile on skip:', err);
            navigate('/onboarding/department');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col">
            <div className="w-full px-4 md:px-8 py-4 max-w-5xl mx-auto flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="btn-icon w-10 h-10"
                >
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
                <div className="flex flex-col items-center gap-2">
                    <p className="text-caption font-semibold text-text-faint-light dark:text-text-faint-dark uppercase tracking-wider">Step 2 of 3</p>
                    <div aria-label="Onboarding progress: step 2 of 3" className="flex w-32 flex-row items-center gap-2">
                        <div className="h-1 flex-1 rounded-full bg-primary"></div>
                        <div className="h-1 flex-1 rounded-full bg-primary"></div>
                        <div className="h-1 flex-1 rounded-full bg-border-light dark:bg-border-dark"></div>
                    </div>
                </div>
                <button onClick={handleSkip} disabled={loading} className="text-caption font-semibold text-text-faint-light dark:text-text-faint-dark hover:text-text-main-light dark:hover:text-text-main-dark transition-colors disabled:opacity-50">Skip</button>
            </div>

            <main className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-4 md:px-6 py-12">
                <div className="text-center max-w-xl mb-10">
                    <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-3">
                        Your current level?
                    </h1>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        Select your academic year to help us tailor the difficulty.
                    </p>
                </div>

                {error && (
                    <div className="w-full max-w-md mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-body-sm text-red-700 dark:text-red-300 text-center">
                        {error}
                    </div>
                )}

                <div className="w-full max-w-3xl mb-12">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[100, 200, 300, 400].map((level) => (
                            <button
                                key={level}
                                type="button"
                                aria-label={`Level ${level} - ${levelMap[level]}`}
                                aria-pressed={selectedLevel === level}
                                onClick={() => setSelectedLevel(level)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelectedLevel(level);
                                    }
                                }}
                                className={`group relative flex flex-col items-center justify-center p-6 aspect-[4/3] lg:aspect-square rounded-xl border transition-all active:scale-[0.98] ${selectedLevel === level
                                    ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/20'
                                    : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark'
                                    }`}
                            >
                                {selectedLevel === level && (
                                    <div className="absolute top-3 right-3">
                                        <span className="material-symbols-outlined text-primary text-[24px]">check_circle</span>
                                    </div>
                                )}
                                <span className={`text-display-sm mb-1 ${selectedLevel === level ? 'text-primary' : 'text-text-main-light dark:text-text-main-dark'}`}>
                                    {level}
                                </span>
                                <span className={`text-caption font-semibold uppercase tracking-widest ${selectedLevel === level ? 'text-primary/80' : 'text-text-faint-light dark:text-text-faint-dark'}`}>
                                    Level
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="w-full flex justify-center" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}>
                    <button
                        onClick={handleNext}
                        disabled={loading}
                        className="btn-primary w-full max-w-sm py-3.5 text-body-base flex items-center justify-center gap-2"
                    >
                        <span>{loading ? 'Saving...' : 'Next'}</span>
                        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </button>
                </div>
            </main>
        </div>
    );
};

export default OnboardingLevel;
