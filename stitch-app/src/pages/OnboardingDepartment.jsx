import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HexLogo } from '../components/PublicShell';

const ACCENT = 'rgb(145, 75, 241)';
const PAGE_BG = 'rgb(16, 17, 18)';
const CARD_BG = 'rgb(39, 40, 41)';
const SUBTEXT = 'rgb(163, 163, 163)';
const INPUT_BG = 'rgb(28, 29, 30)';

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

    const query = searchQuery.trim().toLowerCase();
    const visibleDepartments = query
        ? departments.filter((dept) => dept.label.toLowerCase().includes(query))
        : departments;

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
                        <div className="h-1 flex-1 rounded-full" style={{ background: ACCENT }} />
                    </div>
                    <div className="flex items-center justify-between mt-4">
                        <Link
                            to="/onboarding/level"
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                            aria-label="Back"
                        >
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </Link>
                        <span className="text-xs font-semibold" style={{ color: SUBTEXT, fontFamily: 'Inter, sans-serif' }}>
                            Step 3 of 3
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

            <main className="flex-1 flex flex-col items-center justify-start px-6 pt-10 pb-32 w-full max-w-md mx-auto">
                <div className="text-center mb-6">
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
                        What do you <span style={{ color: ACCENT }}>study</span>?
                    </h1>
                    <p style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55 }}>
                        Choose your department so we can tailor lessons and study groups.
                    </p>
                </div>

                {error && (
                    <div
                        className="w-full mb-4 p-3.5 rounded-xl text-sm font-medium text-center"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: 'rgb(252,165,165)', fontFamily: 'Inter, sans-serif' }}
                    >
                        {error}
                    </div>
                )}

                <div className="relative w-full mb-5">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]" style={{ color: SUBTEXT }}>
                        search
                    </span>
                    <input
                        style={{
                            width: '100%',
                            height: 48,
                            padding: '0 16px 0 40px',
                            borderRadius: 12,
                            background: INPUT_BG,
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            fontSize: 14,
                            fontFamily: 'Inter, sans-serif',
                            outline: 'none',
                        }}
                        placeholder="Search departments…"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
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
                                    border: `1px solid ${isSelected ? ACCENT : 'rgba(255,255,255,0.08)'}`,
                                    boxShadow: isSelected ? `0 0 0 3px rgba(145,75,241,0.18)` : 'none',
                                    color: isSelected ? ACCENT : '#fff',
                                    fontFamily: 'Inter, sans-serif',
                                    fontWeight: isSelected ? 600 : 500,
                                }}
                            >
                                <span className="material-symbols-outlined text-[18px] shrink-0">{dept.icon}</span>
                                <span className="text-sm leading-tight">{dept.label}</span>
                            </button>
                        );
                    })}
                    {visibleDepartments.length === 0 && (
                        <p className="col-span-full text-sm py-4 text-center" style={{ color: SUBTEXT, fontFamily: 'Inter, sans-serif' }}>
                            No departments found.
                        </p>
                    )}
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
                        onClick={handleComplete}
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-lg text-white text-sm font-bold transition-opacity"
                        style={{
                            background: ACCENT,
                            fontFamily: 'Inter, sans-serif',
                            opacity: loading ? 0.55 : 1,
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <span>{loading ? 'Saving…' : 'Start Learning'}</span>
                        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingDepartment;
