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
        if (refCode) {
            try { sessionStorage.setItem('pending_referral_code', refCode.trim().toUpperCase()); } catch { void 0; }
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
        <div className="min-h-screen flex font-body antialiased bg-background-light dark:bg-background-dark">
            {/* Left decorative panel */}
            <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden bg-gradient-to-br from-accent-teal via-accent-emerald to-primary">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-[15%] right-[10%] w-80 h-80 rounded-full bg-white/20 blur-3xl" />
                    <div className="absolute bottom-[15%] left-[10%] w-96 h-96 rounded-full bg-white/10 blur-3xl" />
                </div>
                <div className="relative z-10 flex flex-col justify-center px-16 xl:px-20 text-white">
                    <div className="mb-8">
                        <img src="/chewnpourlogo.png" alt="ChewnPour" className="h-16 w-auto" />
                    </div>
                    <h2 className="text-display-xl text-white mb-4 max-w-lg">
                        Study smarter, not harder
                    </h2>
                    <p className="text-lg text-white/70 max-w-md leading-relaxed">
                        Upload your slides and notes. Get AI-generated lessons, practice quizzes, and a personal tutor in seconds.
                    </p>
                    <div className="mt-12 grid grid-cols-3 gap-4 max-w-sm">
                        {[
                            { icon: 'menu_book', label: 'Smart Lessons' },
                            { icon: 'quiz', label: 'AI Quizzes' },
                            { icon: 'psychology', label: 'AI Tutor' },
                        ].map((f) => (
                            <div key={f.label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/10 backdrop-blur-sm">
                                <span className="material-symbols-outlined text-[22px]">{f.icon}</span>
                                <span className="text-xs font-medium text-white/80">{f.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right content */}
            <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between p-4 lg:p-6">
                    <Link to="/" className="btn-icon w-10 h-10">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </Link>
                    <Link to="/login" className="text-sm font-semibold text-primary hover:text-primary-hover transition-colors">
                        Sign in
                    </Link>
                </div>

                <main className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-20 max-w-lg mx-auto w-full">
                    <div className="lg:hidden mb-8">
                        <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-[22px] filled">school</span>
                        </div>
                    </div>

                    <div className="mb-8 animate-fade-in">
                        <h1 className="text-display-lg text-text-main-light dark:text-text-main-dark mb-2">
                            Create your account
                        </h1>
                        <p className="text-body-lg text-text-sub-light dark:text-text-sub-dark">
                            Join your campus community and start studying smarter.
                        </p>
                    </div>

                    {refCode && (
                        <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40 text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2.5 animate-scale-in">
                            <span className="material-symbols-outlined text-[18px]">redeem</span>
                            You were referred! Sign up and upload to earn a free credit.
                        </div>
                    )}

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
                            <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
                        </button>

                        <div className="relative flex items-center py-2">
                            <div className="flex-1 border-t border-border-light dark:border-border-dark" />
                            <span className="px-4 text-overline text-text-faint-light dark:text-text-faint-dark uppercase">or</span>
                            <div className="flex-1 border-t border-border-light dark:border-border-dark" />
                        </div>

                        <Link
                            to={`/onboarding/name${refCode ? `?ref=${encodeURIComponent(refCode)}` : ''}`}
                            className="btn-primary w-full h-12 gap-2.5 text-sm"
                        >
                            <span className="material-symbols-outlined text-[20px]">mail</span>
                            <span>Continue with Email</span>
                        </Link>
                    </div>
                </main>

                <footer className="p-6 text-center space-y-4">
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold text-primary hover:text-primary-hover transition-colors">
                            Sign in
                        </Link>
                    </p>
                    <div className="flex justify-center gap-6">
                        <Link className="text-caption text-text-faint-light hover:text-text-sub-light transition-colors" to="/terms">Terms</Link>
                        <Link className="text-caption text-text-faint-light hover:text-text-sub-light transition-colors" to="/privacy">Privacy</Link>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export { SignUp };
export default SignUp;
