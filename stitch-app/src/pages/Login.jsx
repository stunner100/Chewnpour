import React, { useEffect, useReducer } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { m as Motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import PublicShell, { ArrowBadge } from '../components/PublicShell';
import { BlurFade } from '../components/magicui/BlurFade';
import { WatermelonToaster } from '../components/watermelon/WatermelonSonner';
import { watermelonToast } from '../components/watermelon/watermelonToast';
import {
    readCampaignAttributionFromSearch,
    stashPendingCampaignAttribution,
} from '../lib/campaignAttribution';

const initialLoginState = {
    email: '',
    password: '',
    showPassword: false,
    error: '',
    loading: false,
};

const loginReducer = (state, action) => {
    switch (action.type) {
        case 'fieldChanged':
            return {
                ...state,
                [action.field]: action.value,
            };
        case 'togglePassword':
            return {
                ...state,
                showPassword: !state.showPassword,
            };
        case 'authStarted':
            return {
                ...state,
                error: '',
                loading: true,
            };
        case 'authFailed':
            return {
                ...state,
                error: action.error,
                loading: false,
            };
        case 'authFinished':
            return {
                ...state,
                loading: false,
            };
        default:
            return state;
    }
};

const Login = () => {
    const [{ email, password, showPassword, error, loading }, dispatchLogin] = useReducer(
        loginReducer,
        initialLoginState,
    );
    const { signIn, signInWithGoogle } = useAuth();
    const routerLocation = useLocation();
    const navigate = useNavigate();
    const redirectTarget = (() => {
        const from = routerLocation.state?.from;
        if (!from || typeof from !== 'object') return '/dashboard';
        const pathname = typeof from.pathname === 'string' && from.pathname.startsWith('/')
            ? from.pathname
            : '/dashboard';
        const search = typeof from.search === 'string' ? from.search : '';
        const hash = typeof from.hash === 'string' ? from.hash : '';
        return `${pathname}${search}${hash}`;
    })();

    useEffect(() => {
        const from = routerLocation.state?.from;
        if (!from || typeof from !== 'object') return;
        const pendingAttribution = readCampaignAttributionFromSearch(
            typeof from.search === 'string' ? from.search : '',
            typeof from.pathname === 'string' ? from.pathname : '/dashboard',
        );
        if (pendingAttribution) {
            stashPendingCampaignAttribution(pendingAttribution);
        }
    }, [routerLocation.state]);

    const resolveGoogleErrorMessage = (authError) => {
        const fallbackMessage = 'Failed to sign in with Google';
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
        dispatchLogin({ type: 'authStarted' });
        try {
            const { error: signInError } = await signInWithGoogle(redirectTarget);
            if (signInError) {
                const msg = resolveGoogleErrorMessage(signInError);
                dispatchLogin({ type: 'authFailed', error: msg });
                watermelonToast(msg, { type: 'error' });
            }
        } catch {
            const msg = 'Unable to reach authentication right now. Please try again.';
            dispatchLogin({ type: 'authFailed', error: msg });
            watermelonToast(msg, { type: 'error' });
        } finally {
            dispatchLogin({ type: 'authFinished' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        dispatchLogin({ type: 'authStarted' });
        try {
            const { error } = await signIn(email, password);
            if (error) {
                dispatchLogin({ type: 'authFailed', error: error.message });
                watermelonToast(error.message, { type: 'error' });
            } else {
                navigate(redirectTarget, {
                    replace: true,
                    state: {
                        watermelonToast: {
                            message: 'Welcome back!',
                            type: 'success',
                        },
                    },
                });
            }
        } catch {
            const msg = 'An unexpected error occurred';
            dispatchLogin({ type: 'authFailed', error: msg });
            watermelonToast(msg, { type: 'error' });
        } finally {
            dispatchLogin({ type: 'authFinished' });
        }
    };

    return (
        <PublicShell>
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                {/* Left — brand pitch (landing style) */}
                <div className="hidden lg:flex flex-col gap-8">
                    <BlurFade delay={0.05} yOffset={12}>
                        <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[rgb(13, 148, 136)]">
                            <span className="inline-block w-8 h-[2px] bg-[rgb(13, 148, 136)]" /> Welcome back
                        </div>
                    </BlurFade>
                    <BlurFade delay={0.12} yOffset={14}>
                        <h1 className="text-5xl xl:text-6xl font-semibold leading-[1.05] tracking-tight">
                            Your AI
                            <br />
                            <span className="text-[rgb(13, 148, 136)]">study</span>
                            <br />
                            <span className="inline-flex items-center gap-3">
                                <ArrowBadge size={44} /> companion
                            </span>
                        </h1>
                    </BlurFade>
                    <BlurFade delay={0.2} yOffset={10}>
                        <p className="text-[#687384] text-base leading-relaxed max-w-md">
                            Upload your course materials and get instant lessons, smart quizzes, and an AI tutor that understands your content.
                        </p>
                    </BlurFade>
                    <div className="flex items-center gap-4 pt-4 border-t border-[#E7E0D4]">
                        <div className="flex">
                            {['/chewnpour/img1.jpg', '/chewnpour/img2.jpg', '/chewnpour/img3.jpg', '/chewnpour/img4.jpg'].map((src, i) => (
                                <img
                                    key={src}
                                    src={src}
                                    alt=""
                                    aria-hidden="true"
                                    className="size-9 -ml-2 first:ml-0 rounded-full border-2 border-white object-cover shadow-md login-avatar-bob"
                                    style={{ animationDelay: `${i * 0.35}s`, zIndex: 10 - i }}
                                    decoding="async"
                                    loading="lazy"
                                />
                            ))}
                        </div>
                        <p className="text-sm text-[#687384]">
                            Join thousands of students already studying smarter
                        </p>
                    </div>
                </div>

                {/* Right — form card */}
                <BlurFade delay={0.05} yOffset={12} className="cp-card">
                    <div className="mb-6">
                        <h2 className="text-2xl font-semibold mb-1">Welcome back</h2>
                        <p className="text-sm text-[#687384]">Sign in to continue studying.</p>
                    </div>

                    {error && (
                        <Motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="mb-5 rounded-xl border border-[#E8651B]/40 bg-[#E8651B]/10 px-4 py-3 text-sm text-[rgb(13, 148, 136)] flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {error}
                        </Motion.div>
                    )}

                    <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="cp-btn-secondary mb-4"
                    >
                        <svg className="size-[18px]" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span>{loading && !email ? 'Connecting…' : 'Continue with Google'}</span>
                    </button>

                    <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 border-t border-[#E7E0D4]" />
                        <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#8A94A6]">or</span>
                        <div className="flex-1 border-t border-[#E7E0D4]" />
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label className="cp-label" htmlFor="email">Email</label>
                            <input
                                className="cp-input"
                                id="email"
                                placeholder="student@university.edu"
                                type="email"
                                value={email}
                                onChange={(e) => dispatchLogin({
                                    type: 'fieldChanged',
                                    field: 'email',
                                    value: e.target.value,
                                })}
                                required
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <label className="cp-label" htmlFor="password">Password</label>
                                <Link to="/reset-password" className="text-xs font-semibold text-[rgb(13, 148, 136)] hover:underline">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    className="cp-input pr-11"
                                    id="password"
                                    placeholder="Enter your password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => dispatchLogin({
                                        type: 'fieldChanged',
                                        field: 'password',
                                        value: e.target.value,
                                    })}
                                    required
                                />
                                <button
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A94A6] hover:text-[#1F2933] transition-colors"
                                    type="button"
                                    onClick={() => dispatchLogin({ type: 'togglePassword' })}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        {showPassword ? 'visibility' : 'visibility_off'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="cp-btn-primary mt-2">
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full size-4 border-2 border-white/30 border-t-white" />
                                    <span>Signing in…</span>
                                </>
                            ) : (
                                <span>Sign in</span>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-[#687384]">
                        New here?{' '}
                        <Link to="/signup" className="font-semibold text-[rgb(13, 148, 136)] hover:underline">
                            Create an account
                        </Link>
                    </p>
                </BlurFade>
            </div>
            <WatermelonToaster position="bottom-center" />
        </PublicShell>
    );
};

export default Login;
