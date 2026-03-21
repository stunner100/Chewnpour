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
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col">
            <div className="flex items-center p-4 pb-2 sticky top-0 z-10 bg-background-light dark:bg-background-dark">
                <Link to="/login" className="btn-icon w-10 h-10">
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </Link>
            </div>
            <main className="flex-1 flex flex-col px-4 max-w-md mx-auto w-full pb-8">
                <div className="pt-4 pb-6">
                    <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-2">
                        {token ? 'Set a new password' : 'Reset your password'}
                    </h1>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        {token
                            ? 'Choose a strong password you haven\u2019t used before.'
                            : 'Enter your email and we\u2019ll send a reset link.'}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-body-sm text-red-700 dark:text-red-300">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-3 rounded-xl bg-accent-emerald/10 border border-accent-emerald/20 text-body-sm text-accent-emerald">
                        {success}
                    </div>
                )}

                {!token ? (
                    <form className="flex flex-col gap-5" onSubmit={handleRequest}>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-caption font-semibold text-text-main-light dark:text-text-main-dark ml-1" htmlFor="email">Email Address</label>
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
                        <button
                            className="btn-primary w-full py-3 text-body-sm"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Sending...' : 'Send reset link'}
                        </button>
                    </form>
                ) : (
                    <form className="flex flex-col gap-5" onSubmit={handleReset}>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-caption font-semibold text-text-main-light dark:text-text-main-dark ml-1" htmlFor="newPassword">New password</label>
                            <input
                                className="input-field"
                                id="newPassword"
                                placeholder="At least 8 characters"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-caption font-semibold text-text-main-light dark:text-text-main-dark ml-1" htmlFor="confirmPassword">Confirm password</label>
                            <input
                                className="input-field"
                                id="confirmPassword"
                                placeholder="Repeat new password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button
                            className="btn-primary w-full py-3 text-body-sm"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Updating...' : 'Update password'}
                        </button>
                    </form>
                )}
            </main>
        </div>
    );
};

export default ResetPassword;
