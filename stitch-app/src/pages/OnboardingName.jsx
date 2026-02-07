import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const OnboardingName = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp, profile } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (profile?.onboardingCompleted) {
            navigate('/dashboard', { replace: true });
        }
    }, [profile, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Please enter your name');
            return;
        }
        if (!email.trim()) {
            setError('Please enter your email');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const { data, error } = await signUp(email, password, name);
            if (error) {
                setError(error.message);
            } else {
                // Continue to next onboarding step
                navigate('/onboarding/level');
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-surface dark:bg-mono-dark text-mono-black dark:text-white min-h-screen flex flex-col overflow-x-hidden font-sans">
            <header className="w-full pt-16 pb-4 flex justify-center">
                <div aria-label="Progress" className="flex gap-4 w-80 max-w-full">
                    <div className="h-1 flex-1 rounded-full bg-accent-blue shadow-[0_0_12px_rgba(41,98,255,0.6)]"></div>
                    <div className="h-1 flex-1 rounded-full bg-gray-200 dark:bg-white/10"></div>
                    <div className="h-1 flex-1 rounded-full bg-gray-200 dark:bg-white/10"></div>
                </div>
            </header>
            <main className="flex-1 w-full flex flex-col items-center justify-center pb-12 px-6">
                <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
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
                                autoFocus
                                className="w-full h-14 px-5 text-lg font-semibold rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-mono-black dark:text-white outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 placeholder:text-gray-400 transition-all duration-300"
                                placeholder="What should we call you?"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-mono-black dark:text-white ml-1">Email Address</label>
                            <input
                                className="w-full h-14 px-5 text-lg font-semibold rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-mono-black dark:text-white outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 placeholder:text-gray-400 transition-all duration-300"
                                placeholder="student@university.edu"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-mono-black dark:text-white ml-1">Password</label>
                            <input
                                className="w-full h-14 px-5 text-lg font-semibold rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-mono-black dark:text-white outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 placeholder:text-gray-400 transition-all duration-300"
                                placeholder="Create a strong password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                            <p className="text-xs text-gray-400 ml-1">At least 6 characters</p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-16 bg-mono-black dark:bg-white text-white dark:text-mono-black hover:bg-mono-dark/90 dark:hover:bg-gray-100 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 rounded-full font-bold text-xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating account...' : 'Continue'}
                    </button>

                    <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
                        Already have an account? <Link to="/login" className="text-accent-blue font-bold hover:underline">Log in</Link>
                    </p>
                </form>
            </main>
        </div>
    );
};

export default OnboardingName;
