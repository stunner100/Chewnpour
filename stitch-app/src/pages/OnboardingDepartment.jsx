import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const OnboardingDepartment = () => {
    const [selectedDepts, setSelectedDepts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { updateProfile, profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    // #2 — wait for auth to finish loading before redirecting
    useEffect(() => {
        if (authLoading) return;
        if (profile?.onboardingCompleted) {
            navigate('/dashboard', { replace: true });
        }
    }, [profile, authLoading, navigate]);

    const handleToggle = (value) => {
        setSelectedDepts(prev =>
            prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
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
            navigate('/dashboard');
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
            await updateProfile({ onboardingCompleted: true });
            navigate('/dashboard');
        } catch (err) {
            console.error('Failed to update profile on skip:', err);
            setError('Failed to save. Please try again.');
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

    const query = searchQuery.trim().toLowerCase();
    const visibleDepartments = query
        ? departments.filter((dept) => dept.label.toLowerCase().includes(query))
        : departments;

    return (
        // #5 — replaced h-screen with min-h-screen (dvh override already in CSS)
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white min-h-screen flex flex-col overflow-hidden selection:bg-slate-900/10">
            <header className="flex-none px-4 pt-6 pb-2 flex items-center justify-between z-10 bg-background-light dark:bg-background-dark">
                <Link to="/onboarding/level" className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-900 dark:text-white">
                    <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                </Link>
                <h2 className="text-base font-bold leading-tight flex-1 text-center">Step <span className="text-primary">3 of 3</span></h2>
                <button
                    onClick={handleSkip}
                    disabled={loading}
                    className="flex w-10 items-center justify-center text-slate-400 font-bold text-sm hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
                >
                    Skip
                </button>
            </header>

            <div className="flex-none px-6 py-2 w-full">
                <div aria-label="Onboarding progress: step 3 of 3" className="flex w-full gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-900 dark:bg-white"></div>
                    <div className="h-1.5 flex-1 rounded-full bg-slate-900 dark:bg-white"></div>
                    <div className="h-1.5 flex-1 rounded-full bg-primary"></div>
                </div>
            </div>

            {/* #12 — reduced pb-32 to pb-24 for small screens */}
            <main className="flex-1 overflow-y-auto no-scrollbar flex flex-col px-6 pb-24">
                {error && (
                    <div className="mx-auto max-w-md mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium text-center">
                        {error}
                    </div>
                )}
                <div className="pt-6 pb-2 text-center">
                    <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">
                        What do you study?
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base font-medium max-w-xs mx-auto leading-relaxed">
                        Choose your department to find relevant study groups and notes.
                    </p>
                </div>

                {/* #4 — removed sticky positioning; search stays in flow to avoid covering results on small screens */}
                <div className="py-4 bg-background-light dark:bg-background-dark">
                    <div className="relative max-w-md mx-auto">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
                            <span className="material-symbols-outlined">search</span>
                        </span>
                        <input
                            className="w-full py-3.5 pl-11 pr-4 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all font-medium text-base"
                            placeholder="Search departments..."
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md mx-auto content-start">
                    {visibleDepartments.map((dept) => {
                        const isSelected = selectedDepts.includes(dept.value);
                        return (
                            <button
                                key={dept.value}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => handleToggle(dept.value)}
                                className={`group w-full min-h-14 px-5 py-3 rounded-2xl border-2 font-semibold transition-all duration-75 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${isSelected
                                    ? 'bg-primary text-white border-primary shadow-lg'
                                    : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                            >
                                <span className="flex items-center justify-start gap-2 w-full">
                                    <span className="material-symbols-outlined text-[20px] shrink-0">{dept.icon}</span>
                                    <span className="text-left leading-tight">{dept.label}</span>
                                </span>
                            </button>
                        );
                    })}
                    {visibleDepartments.length === 0 && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                            No departments found.
                        </p>
                    )}
                </div>
            </main>

            {/* #3 — added safe-area-inset-bottom */}
            <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark pointer-events-none" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}>
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
