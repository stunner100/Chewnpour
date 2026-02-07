import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const OnboardingLevel = () => {
    const [selectedLevel, setSelectedLevel] = useState(200);
    const [loading, setLoading] = useState(false);
    const { updateProfile, profile } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (profile?.onboardingCompleted) {
            navigate('/dashboard', { replace: true });
        }
    }, [profile, navigate]);

    const levelMap = {
        100: 'freshman',
        200: 'sophomore',
        300: 'junior',
        400: 'senior'
    };

    const handleNext = async () => {
        setLoading(true);
        try {
            await updateProfile({ educationLevel: levelMap[selectedLevel] });
            navigate('/onboarding/department');
        } catch (error) {
            console.error('Failed to update profile:', error);
            navigate('/onboarding/department');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display antialiased text-zinc-900 dark:text-zinc-100 min-h-screen flex flex-col">
            <div className="w-full px-8 py-6 max-w-7xl mx-auto flex items-center justify-between">
                <Link to="/onboarding/name" className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
                </Link>
                <div className="flex flex-col items-center gap-2">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Step 2 of 3</p>
                    <div className="flex w-32 flex-row items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-black dark:bg-white"></div>
                        <div className="h-1.5 flex-1 rounded-full bg-black dark:bg-white"></div>
                        <div className="h-1.5 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-800"></div>
                    </div>
                </div>
                <Link to="/onboarding/department" className="text-sm font-semibold text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">Skip</Link>
            </div>

            <main className="flex-1 flex flex-col items-center justify-center w-full max-w-6xl mx-auto px-6 py-12">
                <div className="text-center max-w-2xl mb-12">
                    <h1 className="text-zinc-900 dark:text-white tracking-tight text-2xl md:text-3xl lg:text-4xl font-extrabold leading-[1.1] mb-6">
                        Your current level?
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-lg md:text-xl font-medium leading-relaxed">
                        Select your academic year to help us tailor the difficulty.
                    </p>
                </div>

                <div className="w-full max-w-5xl mb-16">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        {[100, 200, 300, 400].map((level) => (
                            <button
                                key={level}
                                onClick={() => setSelectedLevel(level)}
                                className={`group relative flex flex-col items-center justify-center p-8 aspect-[4/3] lg:aspect-square rounded-3xl border transition-all active:scale-[0.98] ${selectedLevel === level
                                    ? 'border-[3px] border-royal-blue bg-royal-blue/5 dark:bg-royal-blue/10 shadow-md'
                                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 shadow-sm hover:shadow-md'
                                    }`}
                            >
                                {selectedLevel === level && (
                                    <div className="absolute top-4 right-4">
                                        <span className="material-symbols-outlined text-royal-blue text-[32px]">check_circle</span>
                                    </div>
                                )}
                                <span className={`text-2xl lg:text-3xl font-extrabold mb-2 ${selectedLevel === level ? 'text-royal-blue' : 'text-zinc-900 dark:text-white'}`}>
                                    {level}
                                </span>
                                <span className={`text-sm font-bold uppercase tracking-widest ${selectedLevel === level ? 'text-royal-blue/80 dark:text-royal-blue' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                    Level
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="w-full flex justify-center pb-8">
                    <button
                        onClick={handleNext}
                        disabled={loading}
                        className="flex w-full max-w-sm cursor-pointer items-center justify-center overflow-hidden rounded-full h-16 px-8 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black shadow-xl shadow-black/10 dark:shadow-white/5 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        <span className="text-lg font-bold leading-normal tracking-wide">{loading ? 'Saving...' : 'Next'}</span>
                        <span className="material-symbols-outlined text-[24px] ml-2" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_forward</span>
                    </button>
                </div>
            </main>
        </div>
    );
};

export default OnboardingLevel;
