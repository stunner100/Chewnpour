import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAME_FORM_ID = 'onboarding-name-form';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const submitFormWithFallback = (formElement) => {
    if (!formElement) return;

    if (typeof formElement.requestSubmit === 'function') {
        formElement.requestSubmit();
        return;
    }

    const submitControl = formElement.querySelector('button[type="submit"], input[type="submit"]');
    if (submitControl && typeof submitControl.click === 'function') {
        submitControl.click();
        return;
    }

    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    formElement.dispatchEvent(submitEvent);
};

const OnboardingName = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [touched, setTouched] = useState({
        name: false,
        email: false,
        password: false,
    });
    const [loading, setLoading] = useState(false);
    const { signUp, profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const isNameValid = trimmedName.length > 0;
    const isEmailValid = EMAIL_PATTERN.test(trimmedEmail);
    const isPasswordValid = password.length >= 6;
    const isSubmitDisabled = loading || !isNameValid || !isEmailValid || !isPasswordValid;

    // Only redirect if onboarding is fully completed — don't redirect mid-onboarding
    // users back to /level, as that breaks the back button from Level → Name.
    useEffect(() => {
        if (authLoading) return;
        if (profile?.onboardingCompleted) {
            navigate('/dashboard', { replace: true });
        }
    }, [profile, authLoading, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isNameValid) {
            setError('Please enter your name');
            return;
        }
        if (!isEmailValid) {
            setError(trimmedEmail ? 'Please enter a valid email address' : 'Please enter your email');
            return;
        }
        if (!isPasswordValid) {
            setError('Password must be at least 6 characters');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const { error } = await signUp(trimmedEmail, password, trimmedName);
            if (error) {
                setError(error.message);
            } else {
                // Continue to next onboarding step
                navigate('/onboarding/level');
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-surface dark:bg-mono-dark text-mono-black dark:text-white min-h-screen flex flex-col overflow-x-hidden font-sans">
            <header className="w-full pt-16 pb-4 flex justify-center">
                <div className="flex flex-col items-center gap-2 w-80 max-w-full">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Step 1 of 3
                    </p>
                    <div aria-label="Progress" className="flex gap-4 w-full">
                        <div className="h-1 flex-1 rounded-full bg-accent-blue shadow-[0_0_12px_rgba(41,98,255,0.6)]"></div>
                        <div className="h-1 flex-1 rounded-full bg-gray-200 dark:bg-white/10"></div>
                        <div className="h-1 flex-1 rounded-full bg-gray-200 dark:bg-white/10"></div>
                    </div>
                </div>
            </header>
            {/* #9 — reduced bottom padding from pb-40 to pb-28 for small screens */}
            <main className="flex-1 w-full flex flex-col items-center justify-start pb-28 px-6 pt-4">
                <form
                    id={NAME_FORM_ID}
                    onSubmit={handleSubmit}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            submitFormWithFallback(event.currentTarget);
                        }
                    }}
                    className="w-full max-w-md flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700"
                >
                    <h1 className="text-center text-3xl md:text-4xl font-extrabold text-mono-black dark:text-white leading-[1.1] tracking-tight">
                        Create your account
                    </h1>

                    {error && (
                        <div className="w-full p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium text-center">
                            {error}
                        </div>
                    )}

                    <div className="w-full flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-mono-black dark:text-white ml-1">Your Name</label>
                            <input
                                className={`w-full h-14 px-5 text-lg font-semibold rounded-xl bg-white dark:bg-gray-800 border-2 text-mono-black dark:text-white outline-none focus:ring-2 focus:ring-accent-blue/20 placeholder:text-gray-400 transition-all duration-300 ${isNameValid
                                    ? 'border-emerald-400 dark:border-emerald-500 focus:border-emerald-500'
                                    : 'border-gray-200 dark:border-gray-700 focus:border-accent-blue'
                                    }`}
                                placeholder="What should we call you?"
                                type="text"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (error) setError('');
                                }}
                                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                                required
                            />
                            {(touched.name || name.length > 0) && (
                                <p className={`text-xs ml-1 ${isNameValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                    {isNameValid ? 'Looks good.' : 'Enter your name to continue.'}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-mono-black dark:text-white ml-1">Email Address</label>
                            <input
                                className="w-full h-14 px-5 text-lg font-semibold rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-mono-black dark:text-white outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 placeholder:text-gray-400 transition-all duration-300"
                                placeholder="student@university.edu"
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (error) setError('');
                                }}
                                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                                required
                            />
                            {(touched.email || email.length > 0) && (
                                <p className={`text-xs ml-1 ${isEmailValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                    {isEmailValid ? 'Valid email address.' : 'Enter a valid email address.'}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-mono-black dark:text-white ml-1">Password</label>
                            <input
                                className="w-full h-14 px-5 text-lg font-semibold rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-mono-black dark:text-white outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 placeholder:text-gray-400 transition-all duration-300"
                                placeholder="Create a strong password"
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (error) setError('');
                                }}
                                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                                minLength={6}
                                required
                            />
                            {(touched.password || password.length > 0) && (
                                <p className={`text-xs ml-1 ${isPasswordValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                    {isPasswordValid ? 'Strong enough.' : 'At least 6 characters required.'}
                                </p>
                            )}
                        </div>
                    </div>

                    <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
                        Already have an account? <Link to="/login" className="text-accent-blue font-bold hover:underline">Log in</Link>
                    </p>
                </form>
            </main>

            {/* #3 — added safe-area-inset-bottom via pb-[env(safe-area-inset-bottom)] */}
            <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-surface via-surface to-transparent dark:from-mono-dark dark:via-mono-dark pointer-events-none" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}>
                <div className="max-w-md mx-auto pointer-events-auto">
                    <button
                        type="submit"
                        form={NAME_FORM_ID}
                        disabled={isSubmitDisabled}
                        className="w-full h-16 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-900 dark:hover:bg-gray-100 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 rounded-full font-bold text-xl shadow-xl flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:text-white dark:disabled:bg-gray-600 dark:disabled:text-white"
                    >
                        {loading ? 'Creating account...' : 'Continue'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingName;
