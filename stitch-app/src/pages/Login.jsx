import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/BrandLogo';
import {
    readCampaignAttributionFromSearch,
    stashPendingCampaignAttribution,
} from '../lib/campaignAttribution';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn, signInWithGoogle } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const redirectTarget = (() => {
        const from = location.state?.from;
        if (!from || typeof from !== 'object') return '/dashboard';
        const pathname = typeof from.pathname === 'string' && from.pathname.startsWith('/')
            ? from.pathname
            : '/dashboard';
        const search = typeof from.search === 'string' ? from.search : '';
        const hash = typeof from.hash === 'string' ? from.hash : '';
        return `${pathname}${search}${hash}`;
    })();

    useEffect(() => {
        const from = location.state?.from;
        if (!from || typeof from !== 'object') return;
        const pendingAttribution = readCampaignAttributionFromSearch(
            typeof from.search === 'string' ? from.search : '',
            typeof from.pathname === 'string' ? from.pathname : '/dashboard',
        );
        if (pendingAttribution) {
            stashPendingCampaignAttribution(pendingAttribution);
        }
    }, [location.state]);

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
        setError('');
        setLoading(true);
        try {
            const { error: signInError } = await signInWithGoogle(redirectTarget);
            if (signInError) {
                setError(resolveGoogleErrorMessage(signInError));
            }
        } catch {
            setError('Unable to reach authentication right now. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { error } = await signIn(email, password);
            if (error) {
                setError(error.message);
            } else {
                navigate(redirectTarget, { replace: true });
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex font-body antialiased bg-background-light dark:bg-background-dark">
            {/* Left decorative panel — hidden on mobile */}
            <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary to-primary-400">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-[20%] left-[10%] w-72 h-72 rounded-full bg-white/20 blur-3xl" />
                    <div className="absolute bottom-[10%] right-[15%] w-96 h-96 rounded-full bg-white/10 blur-3xl" />
                </div>
                <div className="relative z-10 flex flex-col justify-center px-16 xl:px-20 text-white">
                    <div className="mb-8">
                        <BrandLogo theme="dark" className="h-12 w-auto" />
                    </div>
                    <h2 className="text-display-xl text-white mb-4 max-w-lg">
                        Your AI study companion
                    </h2>
                    <p className="text-lg text-white/70 max-w-md leading-relaxed">
                        Upload your course materials and get instant lessons, smart quizzes, and an AI tutor that understands your content.
                    </p>
                    <div className="mt-12 flex items-center gap-4">
                        <div className="flex -space-x-2">
                            {['#4d9ef6', '#1de9b6', '#ffab00', '#7c4dff'].map((c, i) => (
                                <div key={i} className="w-8 h-8 rounded-full border-2 border-primary-700" style={{ backgroundColor: c }} />
                            ))}
                        </div>
                        <p className="text-sm text-white/60">Join thousands of students already studying smarter</p>
                    </div>
                </div>
            </div>

            {/* Right content */}
            <div className="flex-1 flex flex-col">
                {/* Mobile header */}
                <div className="flex items-center justify-between p-4 lg:p-6">
                    <Link
                        to="/"
                        className="btn-icon w-10 h-10"
                    >
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </Link>
                    <Link to="/signup" className="text-sm font-semibold text-primary hover:text-primary-hover transition-colors">
                        Create account
                    </Link>
                </div>

                <main className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-20 max-w-lg mx-auto w-full">
                    {/* Logo — mobile only */}
                    <div className="lg:hidden mb-8">
                        <BrandLogo className="h-12 w-auto" />
                    </div>

                    <div className="mb-8 animate-fade-in">
                        <h1 className="text-display-lg text-text-main-light dark:text-text-main-dark mb-2">
                            Welcome back
                        </h1>
                        <p className="text-body-lg text-text-sub-light dark:text-text-sub-dark">
                            Sign in to continue studying
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-3.5 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40 text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2.5 animate-scale-in">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {error}
                        </div>
                    )}

                    <div className="space-y-4 animate-fade-in-up">
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="btn-secondary w-full h-12 gap-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            <span>{loading && !email ? 'Connecting...' : 'Continue with Google'}</span>
                        </button>

                        <div className="relative flex items-center py-2">
                            <div className="flex-1 border-t border-border-light dark:border-border-dark" />
                            <span className="px-4 text-overline text-text-faint-light dark:text-text-faint-dark uppercase">
                                or
                            </span>
                            <div className="flex-1 border-t border-border-light dark:border-border-dark" />
                        </div>

                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <div className="space-y-1.5">
                                <label className="text-body-sm font-medium text-text-main-light dark:text-text-main-dark" htmlFor="email">
                                    Email
                                </label>
                                <input
                                    className="input-field"
                                    id="email"
                                    placeholder="student@university.edu"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-body-sm font-medium text-text-main-light dark:text-text-main-dark" htmlFor="password">
                                        Password
                                    </label>
                                    <Link to="/reset-password" className="text-body-sm font-medium text-primary hover:text-primary-hover transition-colors">
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <input
                                        className="input-field pr-11"
                                        id="password"
                                        placeholder="Enter your password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint-light hover:text-text-sub-light dark:text-text-faint-dark dark:hover:text-text-sub-dark transition-colors"
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">
                                            {showPassword ? 'visibility' : 'visibility_off'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <button
                                className="btn-primary w-full h-12 text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                        <span>Signing in...</span>
                                    </>
                                ) : (
                                    <span>Sign in</span>
                                )}
                            </button>
                        </form>
                    </div>
                </main>

                <footer className="p-6 text-center">
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        New here?{' '}
                        <Link to="/signup" className="font-semibold text-primary hover:text-primary-hover transition-colors">
                            Create an account
                        </Link>
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default Login;
