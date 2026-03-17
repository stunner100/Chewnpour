import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
        <div className="relative min-h-screen flex flex-col bg-background-light dark:bg-background-dark font-body antialiased overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 bg-mesh-light dark:bg-mesh-dark pointer-events-none"></div>
            <div className="fixed top-[-30%] right-[-20%] w-[40%] md:w-[60%] h-[40%] md:h-[60%] bg-primary/10 rounded-full blur-[150px] pointer-events-none animate-float-slow"></div>
            <div className="fixed bottom-[-30%] left-[-20%] w-[40%] md:w-[60%] h-[40%] md:h-[60%] bg-secondary/8 rounded-full blur-[150px] pointer-events-none animate-float-slow animate-delay-500"></div>

            <div className="relative z-10 flex items-center p-4 justify-between">
                <Link to="/" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm hover:bg-primary/10 transition-all shadow-sm border border-neutral-200/50 dark:border-neutral-800/50">
                    <span className="material-symbols-outlined text-text-main-light dark:text-text-main-dark" style={{ fontSize: '22px' }}>arrow_back</span>
                </Link>
            </div>

            <main className="relative z-10 flex-1 flex flex-col px-6 max-w-md mx-auto w-full pb-8">
                <div className="pt-4 pb-8 animate-fade-in-up">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white shadow-button mb-6">
                        <span className="material-symbols-outlined text-[32px] filled">school</span>
                    </div>
                    <h1 className="text-text-main-light dark:text-text-main-dark tracking-tight text-2xl md:text-3xl font-display font-bold leading-tight mb-2">Welcome back</h1>
                    <p className="text-text-sub-light dark:text-text-sub-dark text-base font-medium">Login to your campus account</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-2xl bg-secondary/10 border border-secondary/20 text-secondary text-sm font-medium flex items-center gap-3 animate-scale-in">
                        <span className="material-symbols-outlined text-[20px]">error</span>
                        {error}
                    </div>
                )}

                <div className="flex flex-col gap-3 animate-fade-in-up animate-delay-100">
                    <button onClick={handleGoogleSignIn} disabled={loading} className="group relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl h-14 px-4 bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 hover:border-primary/30 hover:shadow-card-hover transition-all gap-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                        </svg>
                        <span className="text-text-main-light dark:text-text-main-dark">
                            {loading && !email ? 'Connecting...' : 'Login with Google'}
                        </span>
                    </button>
                </div>

                <div className="relative py-8 flex items-center animate-fade-in-up animate-delay-200">
                    <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                    <span className="flex-shrink-0 mx-4 text-neutral-400 dark:text-neutral-500 text-xs font-bold uppercase tracking-wider">or continue with email</span>
                    <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                </div>

                <form className="flex flex-col gap-5 animate-fade-in-up animate-delay-300" onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-text-main-light dark:text-text-main-dark ml-1" htmlFor="email">Email Address</label>
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
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-text-main-light dark:text-text-main-dark ml-1" htmlFor="password">Password</label>
                        <div className="relative group">
                            <input
                                className="input-field !pr-12"
                                id="password"
                                placeholder="Enter your password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-primary transition-colors"
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                    {showPassword ? 'visibility' : 'visibility_off'}
                                </span>
                            </button>
                        </div>
                        <div className="flex justify-end mt-1">
                            <Link className="inline-block py-2 text-primary hover:text-primary-dark text-sm font-semibold transition-colors animated-underline" to="/reset-password">
                                Forgot Password?
                            </Link>
                        </div>
                    </div>
                    <button
                        className="mt-4 btn-primary h-14 w-full flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                <span>Logging in...</span>
                            </>
                        ) : (
                            <>
                                <span>Log In</span>
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </>
                        )}
                    </button>
                </form>
            </main>

            <footer className="relative z-10 p-6 text-center">
                <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">
                    New here? <Link to="/signup" className="inline-block py-2 text-primary hover:text-primary-dark font-bold ml-1 transition-colors animated-underline">Sign up</Link>
                </p>
            </footer>
        </div>
    );
};

export default Login;
