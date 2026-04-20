import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PublicShell, { ArrowBadge } from '../components/PublicShell';

const features = [
    { icon: 'menu_book', label: 'Smart Lessons', bg: '#E8651B', text: '#fff' },
    { icon: 'quiz', label: 'AI Quizzes', bg: '#B39DFF', text: '#0A0A0A' },
    { icon: 'psychology', label: 'AI Tutor', bg: '#F3C64A', text: '#0A0A0A' },
];

const SignUp = () => {
    const { signInWithGoogle } = useAuth();
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const [searchParams] = useSearchParams();
    const refCode = searchParams.get('ref') || '';

    const resolveGoogleErrorMessage = (authError) => {
        const fallbackMessage = 'Failed to continue with Google';
        if (!authError) return fallbackMessage;
        const rawMessage = String(authError.message || '').trim();
        if (!rawMessage) return fallbackMessage;
        const normalized = rawMessage.toLowerCase();
        if (normalized === 'load failed' || normalized === 'failed to fetch') {
            return 'Unable to reach authentication right now. Please try again.';
        }
        return rawMessage;
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);
        if (refCode) {
            try { sessionStorage.setItem('pending_referral_code', refCode.trim().toUpperCase()); } catch { void 0; }
        }
        try {
            const { error: signInError } = await signInWithGoogle();
            if (signInError) setError(resolveGoogleErrorMessage(signInError));
        } catch {
            setError('Unable to reach authentication right now. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PublicShell>
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                {/* Left — pitch */}
                <div className="hidden lg:flex flex-col gap-8">
                    <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#F3C64A]">
                        <span className="inline-block w-8 h-[2px] bg-[#F3C64A]" /> New here
                    </div>
                    <h1 className="text-5xl xl:text-6xl font-bold leading-[1.05] tracking-tight">
                        Study
                        <br />
                        <span className="text-[#F3C64A]">smarter,</span>
                        <br />
                        <span className="inline-flex items-center gap-3">
                            <ArrowBadge size={44} /> not harder
                        </span>
                    </h1>
                    <p className="text-white/70 text-base leading-relaxed max-w-md">
                        Upload your slides and notes. Get AI-generated lessons, practice quizzes, and a personal tutor in seconds.
                    </p>
                    <div className="grid grid-cols-3 gap-3 max-w-sm pt-4 border-t border-white/10">
                        {features.map((f, i) => (
                            <div
                                key={f.label}
                                className={`rounded-2xl p-4 flex flex-col items-center gap-2 text-center ${i === 1 ? 'rotate-1' : i === 0 ? '-rotate-1' : 'rotate-1'}`}
                                style={{ background: f.bg, color: f.text }}
                            >
                                <span className="material-symbols-outlined text-[22px]">{f.icon}</span>
                                <span className="text-[11px] font-bold uppercase tracking-wider">{f.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right — form card */}
                <div className="cp-card">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold mb-1">Create your account</h2>
                        <p className="text-sm text-white/60">Join your campus community and start studying smarter.</p>
                    </div>

                    {refCode && (
                        <div className="mb-5 rounded-xl border border-[#F3C64A]/40 bg-[#F3C64A]/10 px-4 py-3 text-sm text-[#F3C64A] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">redeem</span>
                            You were referred! Sign up and upload to earn a free credit.
                        </div>
                    )}

                    {error && (
                        <div className="mb-5 rounded-xl border border-[#E8651B]/40 bg-[#E8651B]/10 px-4 py-3 text-sm text-[#F3C64A] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="cp-btn-secondary mb-4"
                    >
                        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span>{loading ? 'Connecting…' : 'Continue with Google'}</span>
                    </button>

                    <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 border-t border-white/10" />
                        <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white/40">or</span>
                        <div className="flex-1 border-t border-white/10" />
                    </div>

                    <Link
                        to={`/onboarding/name${refCode ? `?ref=${encodeURIComponent(refCode)}` : ''}`}
                        className="cp-btn-primary"
                    >
                        <span className="material-symbols-outlined text-[20px]">mail</span>
                        Continue with Email
                    </Link>

                    <p className="mt-6 text-center text-sm text-white/60">
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold text-[#F3C64A] hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </PublicShell>
    );
};

export { SignUp };
export default SignUp;
