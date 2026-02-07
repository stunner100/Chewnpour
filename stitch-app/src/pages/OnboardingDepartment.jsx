import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const OnboardingDepartment = () => {
    const [selectedDepts, setSelectedDepts] = useState([]);
    const [loading, setLoading] = useState(false);
    const { updateProfile, profile } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (profile?.onboardingCompleted) {
            navigate('/dashboard', { replace: true });
        }
    }, [profile, navigate]);

    const handleToggle = (value) => {
        setSelectedDepts(prev =>
            prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
        );
    };

    const handleComplete = async () => {
        setLoading(true);
        try {
            await updateProfile({
                department: selectedDepts.length > 0 ? selectedDepts.join(',') : undefined,
                onboardingCompleted: true,
            });
            navigate('/dashboard');
        } catch (error) {
            console.error('Failed to update profile:', error);
            navigate('/dashboard');
        } finally {
            setLoading(false);
        }
    };

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

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white h-screen flex flex-col overflow-hidden selection:bg-slate-900/10">
            <header className="flex-none px-4 pt-6 pb-2 flex items-center justify-between z-10 bg-background-light dark:bg-background-dark">
                <Link to="/onboarding/level" className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-900 dark:text-white">
                    <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                </Link>
                <h2 className="text-base font-bold leading-tight flex-1 text-center">Step <span className="text-primary">3 of 3</span></h2>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex w-10 items-center justify-center text-slate-400 font-bold text-sm hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                    Skip
                </button>
            </header>

            <div className="flex-none px-6 py-2 w-full">
                <div className="flex w-full gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-900 dark:bg-white"></div>
                    <div className="h-1.5 flex-1 rounded-full bg-slate-900 dark:bg-white"></div>
                    <div className="h-1.5 flex-1 rounded-full bg-primary"></div>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto no-scrollbar flex flex-col px-6 pb-32">
                <div className="pt-6 pb-2 text-center">
                    <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">
                        What do you study?
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base font-medium max-w-xs mx-auto leading-relaxed">
                        Choose your department to find relevant study groups and notes.
                    </p>
                </div>

                <div className="sticky top-0 z-20 bg-background-light dark:bg-background-dark py-4">
                    <div className="relative max-w-md mx-auto">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
                            <span className="material-symbols-outlined">search</span>
                        </span>
                        <input className="w-full py-3.5 pl-11 pr-4 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all font-medium text-base" placeholder="Search departments..." type="text" />
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 w-full max-w-md mx-auto justify-center content-start">
                    {departments.map((dept) => (
                        <label key={dept.value} className="cursor-pointer group">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                name="department"
                                value={dept.value}
                                checked={selectedDepts.includes(dept.value)}
                                onChange={() => handleToggle(dept.value)}
                            />
                            <div className="flex items-center gap-2 px-5 py-3 rounded-full border-2 border-transparent bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold transition-all duration-200 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-lg peer-checked:scale-105 active:scale-95 hover:bg-slate-200 dark:hover:bg-slate-700">
                                <span className="material-symbols-outlined text-[20px]">{dept.icon}</span>
                                <span>{dept.label}</span>
                            </div>
                        </label>
                    ))}
                </div>
            </main>

            <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark pointer-events-none">
                <div className="max-w-md mx-auto pointer-events-auto">
                    <button
                        onClick={handleComplete}
                        disabled={loading}
                        className="w-full bg-black hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-200 text-white font-bold text-lg py-4 rounded-full shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Start Learning'}
                        <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingDepartment;
