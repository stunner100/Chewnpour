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
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col overflow-hidden">
            <header className="flex-none px-4 pt-4 pb-2 flex items-center justify-between z-10 bg-background-light dark:bg-background-dark">
                <Link to="/onboarding/level" className="btn-icon w-10 h-10">
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </Link>
                <div className="flex flex-col items-center gap-1">
                    <p className="text-caption font-semibold text-text-faint-light dark:text-text-faint-dark">Step <span className="text-primary">3 of 3</span></p>
                </div>
                <button
                    onClick={handleSkip}
                    disabled={loading}
                    className="text-caption font-semibold text-text-faint-light dark:text-text-faint-dark hover:text-text-main-light dark:hover:text-text-main-dark transition-colors disabled:opacity-50"
                >
                    Skip
                </button>
            </header>

            <div className="flex-none px-6 py-2 w-full">
                <div aria-label="Onboarding progress: step 3 of 3" className="flex w-full gap-2">
                    <div className="h-1 flex-1 rounded-full bg-primary"></div>
                    <div className="h-1 flex-1 rounded-full bg-primary"></div>
                    <div className="h-1 flex-1 rounded-full bg-primary"></div>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto no-scrollbar flex flex-col px-4 md:px-6 pb-24">
                {error && (
                    <div className="mx-auto max-w-md mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-body-sm text-red-700 dark:text-red-300 text-center">
                        {error}
                    </div>
                )}
                <div className="pt-6 pb-2 text-center">
                    <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-2">
                        What do you study?
                    </h1>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-xs mx-auto">
                        Choose your department to find relevant study groups and notes.
                    </p>
                </div>

                <div className="py-4">
                    <div className="relative max-w-md mx-auto">
                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-text-faint-light dark:text-text-faint-dark">
                            search
                        </span>
                        <input
                            className="input-field pl-10 text-body-sm"
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
                                className={`w-full min-h-[3.25rem] px-4 py-3 rounded-xl border transition-all active:scale-[0.98] flex items-center gap-2.5 ${isSelected
                                    ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/20 text-primary font-semibold'
                                    : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-sub-light dark:text-text-sub-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[18px] shrink-0">{dept.icon}</span>
                                <span className="text-body-sm text-left leading-tight">{dept.label}</span>
                            </button>
                        );
                    })}
                    {visibleDepartments.length === 0 && (
                        <p className="text-body-sm text-text-faint-light dark:text-text-faint-dark py-4">
                            No departments found.
                        </p>
                    )}
                </div>
            </main>

            <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark pointer-events-none" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}>
                <div className="max-w-md mx-auto pointer-events-auto">
                    <button
                        onClick={handleComplete}
                        disabled={loading}
                        className="btn-primary w-full py-3.5 text-body-base flex items-center justify-center gap-2"
                    >
                        {loading ? 'Saving...' : 'Start Learning'}
                        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingDepartment;
