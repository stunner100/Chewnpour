import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
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
    const [touched, setTouched] = useState({ name: false, email: false, password: false });
    const [loading, setLoading] = useState(false);
    const { signUp, profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const setReferredBy = useMutation(api.profiles.setReferredBy);

    const [referralCode] = useState(() => {
        const ref = searchParams.get('ref') || '';
        return ref.trim().toUpperCase();
    });

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const isNameValid = trimmedName.length > 0;
    const isEmailValid = EMAIL_PATTERN.test(trimmedEmail);
    const isPasswordValid = password.length >= 6;
    const isSubmitDisabled = loading || !isNameValid || !isEmailValid || !isPasswordValid;

    useEffect(() => {
        if (authLoading) return;
        if (profile?.onboardingCompleted) {
            navigate('/dashboard', { replace: true });
        }
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
            if (error) {
                setError(error.message);
            } else {
                if (referralCode) {
                    const newUserId = data?.user?.id ?? data?.id;
                    if (newUserId) {
                        setReferredBy({ userId: newUserId, referralCode }).catch(() => {});
                    }
                }
                navigate('/dashboard');
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const fieldState = (valid, touchedField, value) => {
        if (!touchedField && !value) return 'default';
        return valid ? 'valid' : 'error';
    };

    const fieldBorderClass = (state) => {
        if (state === 'valid') return 'border-accent-emerald focus:border-accent-emerald focus:ring-emerald-100 dark:focus:ring-emerald-900/30';
        if (state === 'error') return 'border-red-400 focus:border-red-400 focus:ring-red-100 dark:focus:ring-red-900/30';
        return 'border-border-light dark:border-border-dark focus:border-primary focus:ring-primary/10';
    };

    return (
        <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark font-body antialiased">
            {/* Progress bar */}
            <header className="w-full pt-6 pb-2 px-6">
                <div className="max-w-md mx-auto">
                    <div className="flex gap-2">
                        <div className="h-1 flex-1 rounded-full bg-primary" />
                        <div className="h-1 flex-1 rounded-full bg-border-light dark:bg-border-dark" />
                        <div className="h-1 flex-1 rounded-full bg-border-light dark:bg-border-dark" />
                    </div>
                    <div className="flex items-center justify-between mt-4">
                        <Link to="/signup" className="btn-icon w-9 h-9">
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </Link>
                        <span className="text-caption text-text-faint-light dark:text-text-faint-dark">Step 1 of 3</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full flex flex-col items-center justify-start px-6 pt-6 pb-32">
                <form
                    id={NAME_FORM_ID}
                    onSubmit={handleSubmit}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            submitFormWithFallback(event.currentTarget);
                        }
                    }}
                    className="w-full max-w-md animate-fade-in-up"
                >
                    <h1 className="text-display-lg text-text-main-light dark:text-text-main-dark mb-2">
                        Create your account
                    </h1>
                    <p className="text-body-lg text-text-sub-light dark:text-text-sub-dark mb-8">
                        Tell us a bit about yourself to get started.
                    </p>

                    {referralCode && (
                        <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40 text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2.5">
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

                    <div className="space-y-5">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <label className="text-body-sm font-medium text-text-main-light dark:text-text-main-dark">
                                Your name
                            </label>
                            <input
                                className={`input-lg ${fieldBorderClass(fieldState(isNameValid, touched.name, name))}`}
                                placeholder="What should we call you?"
                                type="text"
                                value={name}
                                onChange={(e) => { setName(e.target.value); if (error) setError(''); }}
                                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                                required
                            />
                            {(touched.name || name.length > 0) && (
                                <p className={`text-caption ${isNameValid ? 'text-accent-emerald' : 'text-red-500'}`}>
                                    {isNameValid ? 'Looks good.' : 'Enter your name to continue.'}
                                </p>
                            )}
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-body-sm font-medium text-text-main-light dark:text-text-main-dark">
                                Email address
                            </label>
                            <input
                                className={`input-lg ${fieldBorderClass(fieldState(isEmailValid, touched.email, email))}`}
                                placeholder="student@university.edu"
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                                required
                            />
                            {(touched.email || email.length > 0) && (
                                <p className={`text-caption ${isEmailValid ? 'text-accent-emerald' : 'text-red-500'}`}>
                                    {isEmailValid ? 'Valid email address.' : 'Enter a valid email address.'}
                                </p>
                            )}
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-body-sm font-medium text-text-main-light dark:text-text-main-dark">
                                Password
                            </label>
                            <input
                                className={`input-lg ${fieldBorderClass(fieldState(isPasswordValid, touched.password, password))}`}
                                placeholder="Create a strong password"
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                                minLength={6}
                                required
                            />
                            {(touched.password || password.length > 0) && (
                                <p className={`text-caption ${isPasswordValid ? 'text-accent-emerald' : 'text-red-500'}`}>
                                    {isPasswordValid ? 'Strong enough.' : 'At least 6 characters required.'}
                                </p>
                            )}
                        </div>
                    </div>

                    <p className="mt-6 text-center text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold text-primary hover:text-primary-hover transition-colors">
                            Sign in
                        </Link>
                    </p>
                </form>
            </main>

            {/* Fixed bottom CTA */}
            <div
                className="fixed bottom-0 left-0 w-full p-5 bg-gradient-to-t from-background-light via-background-light/95 to-transparent dark:from-background-dark dark:via-background-dark/95 pointer-events-none"
                style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))' }}
            >
                <div className="max-w-md mx-auto pointer-events-auto">
                    <button
                        type="submit"
                        form={NAME_FORM_ID}
                        disabled={isSubmitDisabled}
                        className="btn-primary w-full h-13 text-base rounded-2xl
                                   disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                <span>Creating account...</span>
                            </div>
                        ) : 'Continue'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingName;
