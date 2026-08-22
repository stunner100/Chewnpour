import React, { useEffect, useMemo, useReducer, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { m as Motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import PublicShell from '../components/PublicShell';
import { BlurFade } from '../components/magicui/BlurFade';
import { WatermelonToaster } from '../components/watermelon/WatermelonSonner';
import { watermelonToast } from '../components/watermelon/watermelonToast';
import {
    messageForOAuthErrorCode,
    oauthErrorCodeFromSearchParams,
    stripOAuthErrorParams,
} from '../lib/oauthErrorMessage';
import AppIcon from '../components/AppIcon';

const ACCENT = '#007AFF';
const CARD_BG = '#FFFFFF';
const SUBTEXT = '#6B6B70';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const features = [
    { icon: 'menu_book', label: 'Smart Lessons' },
    { icon: 'quiz', label: 'AI Quizzes' },
    { icon: 'psychology', label: 'AI Tutor' },
];

const initialSignUpState = {
    name: '',
    email: '',
    password: '',
    showPassword: false,
    error: '',
    loading: false,
    googleLoading: false,
};

const signUpReducer = (state, action) => {
    switch (action.type) {
        case 'fieldChanged':
            return {
                ...state,
                [action.field]: action.value,
                error: state.error ? '' : state.error,
            };
        case 'togglePassword':
            return {
                ...state,
                showPassword: !state.showPassword,
            };
        case 'googleStarted':
            return {
                ...state,
                error: '',
                googleLoading: true,
            };
        case 'googleFinished':
            return {
                ...state,
                googleLoading: false,
            };
        case 'submitStarted':
            return {
                ...state,
                error: '',
                loading: true,
            };
        case 'submitFailed':
            return {
                ...state,
                error: action.error,
                loading: false,
                googleLoading: false,
            };
        case 'submitFinished':
            return {
                ...state,
                loading: false,
            };
        default:
            return state;
    }
};

const stashReferralCode = (refCode) => {
    if (!refCode) return;
    try {
        sessionStorage.setItem('pending_referral_code', refCode.trim().toUpperCase());
    } catch {
        void 0;
    }
};

const SignUp = () => {
    const [{ name, email, password, showPassword, error, loading, googleLoading }, dispatchSignUp] = useReducer(
        signUpReducer,
        initialSignUpState,
    );
    const { signUp, signInWithGoogle, user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const consumedOAuthError = useRef(false);
    const busy = loading || googleLoading;

    const referralCode = useMemo(
        () => (searchParams.get('ref') || '').trim().toUpperCase(),
        [searchParams],
    );

    useEffect(() => {
        if (authLoading) return;
        if (user) navigate('/dashboard', { replace: true });
    }, [authLoading, user, navigate]);

    useEffect(() => {
        if (consumedOAuthError.current) return;
        const errorCode = oauthErrorCodeFromSearchParams(searchParams);
        if (!errorCode) return;
        consumedOAuthError.current = true;
        const msg = messageForOAuthErrorCode(errorCode);
        dispatchSignUp({ type: 'submitFailed', error: msg });
        watermelonToast(msg, { type: 'error' });
        setSearchParams(stripOAuthErrorParams(searchParams), { replace: true });
    }, [searchParams, setSearchParams]);

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
        dispatchSignUp({ type: 'googleStarted' });
        stashReferralCode(referralCode);
        try {
            const { error: signInError } = await signInWithGoogle();
            if (signInError) {
                const msg = resolveGoogleErrorMessage(signInError);
                dispatchSignUp({ type: 'submitFailed', error: msg });
                watermelonToast(msg, { type: 'error' });
            }
        } catch {
            const msg = 'Unable to reach authentication right now. Please try again.';
            dispatchSignUp({ type: 'submitFailed', error: msg });
            watermelonToast(msg, { type: 'error' });
        } finally {
            dispatchSignUp({ type: 'googleFinished' });
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();
        if (!trimmedName) {
            dispatchSignUp({ type: 'submitFailed', error: 'Please enter your name' });
            return;
        }
        if (!EMAIL_PATTERN.test(trimmedEmail)) {
            dispatchSignUp({
                type: 'submitFailed',
                error: trimmedEmail ? 'Please enter a valid email address' : 'Please enter your email',
            });
            return;
        }
        if (password.length < 6) {
            dispatchSignUp({ type: 'submitFailed', error: 'Password must be at least 6 characters' });
            return;
        }

        dispatchSignUp({ type: 'submitStarted' });
        stashReferralCode(referralCode);
        try {
            const { error: signUpError } = await signUp(trimmedEmail, password, { name: trimmedName });
            if (signUpError) {
                dispatchSignUp({ type: 'submitFailed', error: signUpError.message });
                watermelonToast(signUpError.message, { type: 'error' });
                return;
            }
            navigate('/dashboard', {
                replace: true,
                state: {
                    watermelonToast: {
                        message: `Welcome, ${trimmedName.split(' ')[0]}!`,
                        type: 'success',
                    },
                },
            });
        } catch {
            const fallback = 'An unexpected error occurred';
            dispatchSignUp({ type: 'submitFailed', error: fallback });
            watermelonToast(fallback, { type: 'error' });
        } finally {
            dispatchSignUp({ type: 'submitFinished' });
        }
    };

    return (
        <PublicShell>
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
                <div className="hidden flex-col gap-8 lg:flex">
                    <div
                        className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em]"
                        style={{ color: ACCENT }}
                    >
                        <span className="inline-block h-[2px] w-8" style={{ background: ACCENT }} />
                        New here
                    </div>
                    <h1 className="text-[clamp(2.5rem,5vw,3.75rem)] font-bold leading-[1.05] tracking-[-0.03em] text-[#0A0A0A]">
                        Study{' '}
                        <br />
                        <span style={{ color: ACCENT }}>smarter,</span>{' '}
                        <br />
                        not harder
                    </h1>
                    <p className="max-w-md text-[17px] leading-relaxed" style={{ color: SUBTEXT }}>
                        Upload your slides and notes. Get AI-generated lessons, practice quizzes, and a personal tutor in seconds.
                    </p>
                    <div className="grid max-w-sm grid-cols-3 gap-3 border-t border-[#E5E5EA] pt-6">
                        {features.map((feature) => (
                            <div
                                key={feature.label}
                                className="flex flex-col items-center gap-2 rounded-2xl p-4 text-center"
                                style={{ background: CARD_BG, border: '1px solid #E5E5EA' }}
                            >
                                <span
                                    className="inline-flex size-9 items-center justify-center rounded-xl text-white"
                                    style={{ background: ACCENT }}
                                >
                                    <AppIcon name={feature.icon} style={{ fontSize: 18 }} />
                                </span>
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0A0A0A]">
                                    {feature.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <BlurFade delay={0.05} yOffset={12} className="cp-card">
                    <div className="mb-6">
                        <h1 className="mb-1.5 text-[28px] font-bold tracking-[-0.02em] text-[#0A0A0A]">
                            Create your account
                        </h1>
                        <p className="text-sm" style={{ color: SUBTEXT }}>
                            Upload slides, get lessons. Free forever.
                        </p>
                    </div>

                    {referralCode ? (
                        <div
                            className="mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
                            style={{
                                border: `1px solid ${ACCENT}66`,
                                background: 'rgba(0, 122, 255, 0.08)',
                                color: ACCENT,
                            }}
                        >
                            <AppIcon name="group" className="text-[18px]" />
                            A friend invited you. Create a free account and start studying.
                        </div>
                    ) : null}

                    {error ? (
                        <Motion.div
                            role="alert"
                            aria-atomic="true"
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="mb-5 flex items-center gap-2 rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-sm text-error"
                        >
                            <AppIcon name="error" className="text-[18px]" />
                            {error}
                        </Motion.div>
                    ) : null}

                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={busy}
                        className="cp-btn-secondary mb-4"
                    >
                        <svg className="size-[18px]" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span>{googleLoading ? 'Connecting…' : 'Continue with Google'}</span>
                    </button>

                    <div className="my-5 flex items-center gap-3">
                        <div className="flex-1 border-t border-[#E5E5EA]" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8E8E93]">
                            or
                        </span>
                        <div className="flex-1 border-t border-[#E5E5EA]" />
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label className="cp-label" htmlFor="signup-name">Your name</label>
                            <input
                                className="cp-input"
                                id="signup-name"
                                name="name"
                                autoComplete="name"
                                placeholder="What should we call you?"
                                type="text"
                                value={name}
                                onChange={(event) => dispatchSignUp({
                                    type: 'fieldChanged',
                                    field: 'name',
                                    value: event.target.value,
                                })}
                                required
                            />
                        </div>
                        <div>
                            <label className="cp-label" htmlFor="signup-email">Email</label>
                            <input
                                className="cp-input"
                                id="signup-email"
                                name="email"
                                autoComplete="email"
                                placeholder="student@university.edu"
                                type="email"
                                value={email}
                                onChange={(event) => dispatchSignUp({
                                    type: 'fieldChanged',
                                    field: 'email',
                                    value: event.target.value,
                                })}
                                required
                            />
                        </div>
                        <div>
                            <label className="cp-label" htmlFor="signup-password">Password</label>
                            <div className="relative">
                                <input
                                    className="cp-input pr-11"
                                    id="signup-password"
                                    name="password"
                                    autoComplete="new-password"
                                    placeholder="At least 6 characters"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(event) => dispatchSignUp({
                                        type: 'fieldChanged',
                                        field: 'password',
                                        value: event.target.value,
                                    })}
                                    minLength={6}
                                    required
                                />
                                <button
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93] transition-colors hover:text-[#0A0A0A]"
                                    type="button"
                                    onClick={() => dispatchSignUp({ type: 'togglePassword' })}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    <AppIcon name={showPassword ? 'visibility' : 'visibility_off'} className="text-[18px]" />
                                </button>
                            </div>
                        </div>
                        <button type="submit" disabled={busy} className="cp-btn-primary mt-2">
                            {loading ? (
                                <>
                                    <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    <span>Creating account…</span>
                                </>
                            ) : (
                                <span>Create account</span>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm" style={{ color: SUBTEXT }}>
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold hover:underline" style={{ color: ACCENT }}>
                            Sign in
                        </Link>
                    </p>
                </BlurFade>
            </div>
            <WatermelonToaster position="bottom-center" />
        </PublicShell>
    );
};

export { SignUp };
export default SignUp;
