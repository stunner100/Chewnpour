import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
        // Persist referral code so it survives the OAuth redirect
        if (refCode) {
            try { sessionStorage.setItem('pending_referral_code', refCode.trim().toUpperCase()); } catch {}
        }
        try {
            const { error: signInError } = await signInWithGoogle();
            if (signInError) {
                setError(resolveGoogleErrorMessage(signInError));
            }
        } catch {
            setError('Unable to reach authentication right now. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex flex-col bg-background-light dark:bg-background-dark font-body antialiased overflow-hidden">
            {/* ... (background effects remain same) */}
            <div className="fixed inset-0 bg-mesh-light dark:bg-mesh-dark pointer-events-none"></div>
            <div className="fixed top-[-20%] left-[-20%] w-[40%] md:w-[60%] h-[40%] md:h-[60%] bg-primary/12 rounded-full blur-[150px] pointer-events-none animate-float-slow"></div>
            <div className="fixed bottom-[-20%] right-[-20%] w-[35%] md:w-[50%] h-[35%] md:h-[50%] bg-accent-cyan/10 rounded-full blur-[120px] pointer-events-none animate-float-slow animate-delay-500"></div>
            <div className="fixed top-[40%] right-[10%] w-[25%] md:w-[30%] h-[25%] md:h-[30%] bg-secondary/8 rounded-full blur-[100px] pointer-events-none animate-pulse-subtle"></div>

            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10">
                <div className="w-full max-w-[420px] animate-fade-in-up">
                    {/* ... (Logo and Header remain same) */}
                    <div className="mb-8 flex justify-center">
                        <Link to="/" className="group flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-button hover:shadow-button-hover hover:scale-105 transition-all">
                            <span className="material-symbols-outlined text-[32px] filled group-hover:rotate-12 transition-transform">school</span>
                        </Link>
                    </div>

                    <div className="mb-10 text-center">
                        <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-text-main-light dark:text-text-main-dark mb-3">
                            Create your account
                        </h1>
                        <p className="text-base font-medium text-text-sub-light dark:text-text-sub-dark">
                            Join your campus community today to discover resources and study groups.
                        </p>
                    </div>

                    {refCode && (
                        <div className="mb-6 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-sm font-medium text-emerald-700 dark:text-emerald-300 text-center flex items-center justify-center gap-2 animate-scale-in">
                            <span className="text-lg">🎁</span>
                            <span>You were referred! Sign up and upload to earn a free credit.</span>
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 rounded-2xl border border-secondary/20 bg-secondary/10 p-4 text-sm font-medium text-secondary animate-scale-in">
                            {error}
                        </div>
                    )}

                    {/* Auth Buttons */}
                    <div className="flex flex-col gap-3">
                        <button onClick={handleGoogleSignIn} disabled={loading} className="group flex h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 px-6 transition-all hover:border-primary/30 hover:shadow-card-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                            <svg className="h-5 w-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                            </svg>
                            <span className="text-base font-bold text-text-main-light dark:text-text-main-dark">
                                {loading ? 'Connect...' : 'Continue with Google'}
                            </span>
                        </button>

                        {/* Divider */}
                        <div className="relative my-4 flex items-center justify-center">
                            <div aria-hidden="true" className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-neutral-200 dark:border-neutral-800"></div>
                            </div>
                            <div className="relative flex justify-center bg-background-light dark:bg-background-dark px-4">
                                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">or</span>
                            </div>
                        </div>

                        <Link to={`/onboarding/name${refCode ? `?ref=${encodeURIComponent(refCode)}` : ''}`} className="group btn-primary h-14 flex items-center justify-center gap-3 text-base">
                            <span className="material-symbols-outlined text-[22px] group-hover:scale-110 transition-transform">mail</span>
                            <span>Continue with Email</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 w-full py-6 text-center">
                <p className="text-sm font-medium text-text-sub-light dark:text-text-sub-dark">
                    Already have an account?
                    <Link to="/login" className="font-bold text-primary hover:text-primary-dark transition-colors ml-1 animated-underline">Log in</Link>
                </p>
                <div className="mt-6 flex justify-center gap-6">
                    <a className="text-xs font-medium text-neutral-400 hover:text-primary transition-colors animated-underline" href="#">Terms of Service</a>
                    <a className="text-xs font-medium text-neutral-400 hover:text-primary transition-colors animated-underline" href="#">Privacy Policy</a>
                </div>
            </div>
        </div>
    );
};

export { SignUp };
export default SignUp;
