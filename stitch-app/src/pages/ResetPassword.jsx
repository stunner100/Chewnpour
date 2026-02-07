import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { requestPasswordReset, resetPassword } from '../lib/auth-client';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRequest = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const redirectTo = `${window.location.origin}/reset-password`;
            const { error } = await requestPasswordReset({
                email,
                redirectTo,
            });
            if (error) {
                setError(error.message || 'Failed to send reset email.');
            } else {
                setSuccess(
                    'If this email exists, a reset link has been sent. In dev, check the server logs for the reset URL.'
                );
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!newPassword || newPassword.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const { error } = await resetPassword({
                newPassword,
                token,
            });
            if (error) {
                setError(error.message || 'Failed to reset password.');
            } else {
                setSuccess('Password updated. You can now log in.');
                setTimeout(() => navigate('/login'), 800);
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-[#0d111b] dark:text-white min-h-screen flex flex-col antialiased">
            <div className="flex items-center p-4 pb-2 justify-between sticky top-0 z-10 bg-background-light dark:bg-background-dark">
                <Link to="/login" className="flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined text-[#0d111b] dark:text-white" style={{ fontSize: '24px' }}>arrow_back</span>
                </Link>
            </div>
            <main className="flex-1 flex flex-col px-6 max-w-md mx-auto w-full pb-8">
                <div className="pt-4 pb-8">
                    <h1 className="text-[#0d111b] dark:text-white tracking-tight text-[32px] font-bold leading-tight text-left mb-2">
                        {token ? 'Set a new password' : 'Reset your password'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">
                        {token
                            ? 'Choose a strong password you haven’t used before.'
                            : 'Enter your email and we’ll send a reset link.'}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                        {success}
                    </div>
                )}

                {!token ? (
                    <form className="flex flex-col gap-5" onSubmit={handleRequest}>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-[#0d111b] dark:text-white ml-1" htmlFor="email">Email Address</label>
                            <input
                                className="w-full h-12 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0d111b] dark:text-white px-4 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                id="email"
                                placeholder="student@university.edu"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <button
                            className="mt-4 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-4 bg-primary hover:bg-blue-700 dark:hover:bg-blue-600 text-white gap-2 text-base font-bold leading-normal tracking-[0.015em] transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            type="submit"
                            disabled={loading}
                        >
                            <span className="truncate">{loading ? 'Sending...' : 'Send reset link'}</span>
                        </button>
                    </form>
                ) : (
                    <form className="flex flex-col gap-5" onSubmit={handleReset}>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-[#0d111b] dark:text-white ml-1" htmlFor="newPassword">New password</label>
                            <input
                                className="w-full h-12 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0d111b] dark:text-white px-4 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                id="newPassword"
                                placeholder="At least 8 characters"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-[#0d111b] dark:text-white ml-1" htmlFor="confirmPassword">Confirm password</label>
                            <input
                                className="w-full h-12 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0d111b] dark:text-white px-4 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                id="confirmPassword"
                                placeholder="Repeat new password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button
                            className="mt-4 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-4 bg-primary hover:bg-blue-700 dark:hover:bg-blue-600 text-white gap-2 text-base font-bold leading-normal tracking-[0.015em] transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            type="submit"
                            disabled={loading}
                        >
                            <span className="truncate">{loading ? 'Updating...' : 'Update password'}</span>
                        </button>
                    </form>
                )}
            </main>
        </div>
    );
};

export default ResetPassword;
