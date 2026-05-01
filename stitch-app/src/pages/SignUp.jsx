import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PublicShell from '../components/PublicShell';

const ACCENT = 'rgb(145, 75, 241)';
const CARD_BG = 'rgb(39, 40, 41)';
const SUBTEXT = 'rgb(163, 163, 163)';

const features = [
    { icon: 'menu_book', label: 'Smart Lessons' },
    { icon: 'quiz', label: 'AI Quizzes' },
    { icon: 'psychology', label: 'AI Tutor' },
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
                    <div
                        className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em]"
                        style={{ color: ACCENT, fontFamily: 'Inter, sans-serif' }}
                    >
                        <span className="inline-block w-8 h-[2px]" style={{ background: ACCENT }} />
                        New here
                    </div>
                    <h1
                        style={{
                            fontFamily: 'Outfit, sans-serif',
                            fontWeight: 600,
                            fontSize: 'clamp(40px, 5vw, 60px)',
                            lineHeight: 1.05,
                            letterSpacing: '-0.025em',
                        }}
                    >
                        Study<br />
                        <span style={{ color: ACCENT }}>smarter,</span><br />
                        not harder
                    </h1>
                    <p
                        className="max-w-md"
                        style={{ color: SUBTEXT, fontSize: 17, lineHeight: 1.55, fontFamily: 'Outfit, sans-serif' }}
                    >
                        Upload your slides and notes. Get AI-generated lessons, practice quizzes, and a personal tutor in seconds.
                    </p>
                    <div className="grid grid-cols-3 gap-3 max-w-sm pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        {features.map((f) => (
                            <div
                                key={f.label}
                                className="rounded-xl p-4 flex flex-col items-center gap-2 text-center"
                                style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.06)' }}
                            >
                                <span
                                    className="inline-flex items-center justify-center w-9 h-9 rounded-full"
                                    style={{ background: ACCENT }}
                                >
                                    <span className="material-symbols-outlined text-white" style={{ fontSize: 18 }}>{f.icon}</span>
                                </span>
                                <span
                                    className="text-[11px] font-semibold uppercase tracking-wider text-white"
                                    style={{ fontFamily: 'Inter, sans-serif' }}
                                >
                                    {f.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right — form card */}
                <div className="cp-card">
                    <div className="mb-6">
                        <h2
                            style={{
                                fontFamily: 'Outfit, sans-serif',
                                fontWeight: 600,
                                fontSize: 28,
                                letterSpacing: '-0.02em',
                                marginBottom: 6,
                            }}
                        >
                            Create your account
                        </h2>
                        <p style={{ color: SUBTEXT, fontSize: 14, fontFamily: 'Outfit, sans-serif' }}>
                            Join your campus community and start studying smarter.
                        </p>
                    </div>

                    {refCode && (
                        <div
                            className="mb-5 rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                            style={{
                                border: `1px solid ${ACCENT}66`,
                                background: 'rgba(145,75,241,0.1)',
                                color: ACCENT,
                                fontFamily: 'Inter, sans-serif',
                            }}
                        >
                            <span className="material-symbols-outlined text-[18px]">redeem</span>
                            You were referred! Sign up and upload to earn a free credit.
                        </div>
                    )}

                    {error && (
                        <div
                            className="mb-5 rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                            style={{
                                border: '1px solid rgba(239,68,68,0.4)',
                                background: 'rgba(239,68,68,0.1)',
                                color: 'rgb(252,165,165)',
                                fontFamily: 'Inter, sans-serif',
                            }}
                        >
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
                        <div className="flex-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
                        <span
                            className="text-[11px] font-semibold tracking-[0.15em] uppercase"
                            style={{ color: SUBTEXT, fontFamily: 'Inter, sans-serif' }}
                        >
                            or
                        </span>
                        <div className="flex-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
                    </div>

                    <Link
                        to={`/onboarding/name${refCode ? `?ref=${encodeURIComponent(refCode)}` : ''}`}
                        className="cp-btn-primary"
                    >
                        <span className="material-symbols-outlined text-[20px]">mail</span>
                        Continue with Email
                    </Link>

                    <p
                        className="mt-6 text-center text-sm"
                        style={{ color: SUBTEXT, fontFamily: 'Inter, sans-serif' }}
                    >
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold hover:underline" style={{ color: ACCENT }}>
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
