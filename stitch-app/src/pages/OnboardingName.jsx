import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { HexLogo } from '../components/PublicShell';

const ACCENT = 'rgb(145, 75, 241)';
const PAGE_BG = 'rgb(16, 17, 18)';
const CARD_BG = 'rgb(39, 40, 41)';
const SUBTEXT = 'rgb(163, 163, 163)';
const INPUT_BG = 'rgb(28, 29, 30)';
const BORDER = 'rgba(255, 255, 255, 0.1)';

const NAME_FORM_ID = 'onboarding-name-form';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OnboardingName = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [touched, setTouched] = useState({ name: false, email: false, password: false });
    const [loading, setLoading] = useState(false);
    const { signUp, profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const setReferredBy = useMutation(api.profiles.setReferredBy);

    const [referralCode] = useState(() => (searchParams.get('ref') || '').trim().toUpperCase());

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const isNameValid = trimmedName.length > 0;
    const isEmailValid = EMAIL_PATTERN.test(trimmedEmail);
    const isPasswordValid = password.length >= 6;
    const isSubmitDisabled = loading || !isNameValid || !isEmailValid || !isPasswordValid;

    useEffect(() => {
        if (authLoading) return;
        if (profile?.onboardingCompleted) navigate('/dashboard', { replace: true });
    }, [profile, authLoading, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isNameValid) { setError('Please enter your name'); return; }
        if (!isEmailValid) { setError(trimmedEmail ? 'Please enter a valid email address' : 'Please enter your email'); return; }
        if (!isPasswordValid) { setError('Password must be at least 6 characters'); return; }

        setError('');
        setLoading(true);
        try {
            const { error, data } = await signUp(trimmedEmail, password, trimmedName);
            if (error) setError(error.message);
            else {
                if (referralCode) {
                    const newUserId = data?.user?.id ?? data?.id;
                    if (newUserId) setReferredBy({ userId: newUserId, referralCode }).catch(() => {});
                }
                navigate('/dashboard');
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const fieldBorder = (valid, isTouched, value) => {
        if (!isTouched && !value) return BORDER;
        return valid ? 'rgba(34, 197, 94, 0.55)' : 'rgba(239, 68, 68, 0.55)';
    };

    const inputStyle = (valid, isTouched, value) => ({
        width: '100%',
        height: 52,
        padding: '0 16px',
        borderRadius: 12,
        background: INPUT_BG,
        border: `1px solid ${fieldBorder(valid, isTouched, value)}`,
        color: '#fff',
        fontSize: 15,
        fontFamily: 'Inter, sans-serif',
        outline: 'none',
        transition: 'border-color 0.15s ease',
    });

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{ background: PAGE_BG, color: '#fff', fontFamily: '"Outfit", "Inter", system-ui, sans-serif' }}
        >
            {/* Header — logo + progress + step indicator */}
            <header className="w-full pt-6 pb-2 px-6">
                <div className="max-w-md mx-auto">
                    <Link to="/" className="flex items-center gap-2.5 text-white mb-5">
                        <HexLogo size={28} withWordmark />
                    </Link>
                    <div className="flex gap-2">
                        <div className="h-1 flex-1 rounded-full" style={{ background: ACCENT }} />
                        <div className="h-1 flex-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
                        <div className="h-1 flex-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
                    </div>
                    <div className="flex items-center justify-between mt-4">
                        <Link
                            to="/signup"
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                            aria-label="Back"
                        >
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </Link>
                        <span className="text-xs font-semibold ui-text" style={{ color: SUBTEXT, fontFamily: 'Inter, sans-serif' }}>
                            Step 1 of 3
                        </span>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full flex flex-col items-center justify-start px-6 pt-6 pb-32">
                <form
                    id={NAME_FORM_ID}
                    onSubmit={handleSubmit}
                    className="w-full max-w-md"
                >
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
                        Create your <span style={{ color: ACCENT }}>account</span>
                    </h1>
                    <p style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55, marginBottom: 32 }}>
                        Tell us a bit about yourself to get started.
                    </p>

                    {referralCode && (
                        <div
                            className="mb-6 p-3.5 rounded-xl text-sm font-medium flex items-center gap-2.5"
                            style={{ background: 'rgba(145,75,241,0.1)', border: `1px solid ${ACCENT}66`, color: ACCENT, fontFamily: 'Inter, sans-serif' }}
                        >
                            <span className="material-symbols-outlined text-[18px]">redeem</span>
                            You were referred! Sign up and upload to earn a free credit.
                        </div>
                    )}

                    {error && (
                        <div
                            className="mb-6 p-3.5 rounded-xl text-sm font-medium flex items-center gap-2.5"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: 'rgb(252,165,165)', fontFamily: 'Inter, sans-serif' }}
                        >
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {error}
                        </div>
                    )}

                    <div className="space-y-5">
                        {/* Name */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                                Your name
                            </label>
                            <input
                                style={inputStyle(isNameValid, touched.name, name)}
                                placeholder="What should we call you?"
                                type="text"
                                value={name}
                                onChange={(e) => { setName(e.target.value); if (error) setError(''); }}
                                onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                                required
                            />
                            {(touched.name || name.length > 0) && (
                                <p className="text-xs" style={{ color: isNameValid ? 'rgb(74,222,128)' : 'rgb(252,165,165)', fontFamily: 'Inter, sans-serif' }}>
                                    {isNameValid ? 'Looks good.' : 'Enter your name to continue.'}
                                </p>
                            )}
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                                Email address
                            </label>
                            <input
                                style={inputStyle(isEmailValid, touched.email, email)}
                                placeholder="student@university.edu"
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                                onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                                required
                            />
                            {(touched.email || email.length > 0) && (
                                <p className="text-xs" style={{ color: isEmailValid ? 'rgb(74,222,128)' : 'rgb(252,165,165)', fontFamily: 'Inter, sans-serif' }}>
                                    {isEmailValid ? 'Valid email address.' : 'Enter a valid email address.'}
                                </p>
                            )}
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                                Password
                            </label>
                            <input
                                style={inputStyle(isPasswordValid, touched.password, password)}
                                placeholder="Create a strong password"
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                                onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                                minLength={6}
                                required
                            />
                            {(touched.password || password.length > 0) && (
                                <p className="text-xs" style={{ color: isPasswordValid ? 'rgb(74,222,128)' : 'rgb(252,165,165)', fontFamily: 'Inter, sans-serif' }}>
                                    {isPasswordValid ? 'Strong enough.' : 'At least 6 characters required.'}
                                </p>
                            )}
                        </div>
                    </div>

                    <p className="mt-6 text-center text-sm" style={{ color: SUBTEXT, fontFamily: 'Inter, sans-serif' }}>
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold hover:underline" style={{ color: ACCENT }}>
                            Sign in
                        </Link>
                    </p>
                </form>
            </main>

            {/* Sticky bottom CTA */}
            <div
                className="fixed bottom-0 left-0 w-full p-5 pointer-events-none"
                style={{
                    background: `linear-gradient(to top, ${PAGE_BG} 60%, transparent)`,
                    paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))',
                }}
            >
                <div className="max-w-md mx-auto pointer-events-auto">
                    <button
                        type="submit"
                        form={NAME_FORM_ID}
                        disabled={isSubmitDisabled}
                        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-lg text-white text-sm font-bold transition-opacity"
                        style={{
                            background: ACCENT,
                            fontFamily: 'Inter, sans-serif',
                            opacity: isSubmitDisabled ? 0.45 : 1,
                            cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                <span>Creating account…</span>
                            </>
                        ) : (
                            <span>Continue</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingName;
