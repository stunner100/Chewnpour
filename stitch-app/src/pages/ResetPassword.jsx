import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { requestPasswordReset, resetPassword } from '../lib/auth-client';
import PublicShell, { ArrowBadge } from '../components/PublicShell';

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
            const { error } = await requestPasswordReset({ email, redirectTo });
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
            const { error } = await resetPassword({ newPassword, token });
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
        <PublicShell>
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                {/* Left — pitch */}
                <div className="hidden lg:flex flex-col gap-8">
                    <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#E8651B]">
                        <span className="inline-block w-8 h-[2px] bg-[#E8651B]" /> Account recovery
                    </div>
                    <h1 className="text-5xl xl:text-6xl font-bold leading-[1.05] tracking-tight">
                        {token ? (
                            <>
                                Set a<br />
                                <span className="text-[#E8651B]">new</span>
                                <br />
                                <span className="inline-flex items-center gap-3">
                                    <ArrowBadge size={44} /> password
                                </span>
                            </>
                        ) : (
                            <>
                                Forgot<br />
                                <span className="text-[#F3C64A]">your</span>
                                <br />
                                <span className="inline-flex items-center gap-3">
                                    <ArrowBadge size={44} /> password?
                                </span>
                            </>
                        )}
                    </h1>
                    <p className="text-white/70 text-base leading-relaxed max-w-md">
                        {token
                            ? 'Choose a strong password you haven\u2019t used before. Eight characters minimum — no previously leaked passwords please.'
                            : 'Enter the email tied to your account and we\u2019ll send a reset link. No spam, ever.'}
                    </p>
                </div>

                {/* Right — form card */}
                <div className="cp-card">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold mb-1">
                            {token ? 'Set a new password' : 'Reset your password'}
                        </h2>
                        <p className="text-sm text-white/60">
                            {token
                                ? 'Choose a strong password you haven\u2019t used before.'
                                : 'Enter your email and we\u2019ll send a reset link.'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-5 rounded-xl border border-[#E8651B]/40 bg-[#E8651B]/10 px-4 py-3 text-sm text-[#F3C64A] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-5 rounded-xl border border-[#B39DFF]/40 bg-[#B39DFF]/10 px-4 py-3 text-sm text-[#B39DFF] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            {success}
                        </div>
                    )}

                    {!token ? (
                        <form className="space-y-4" onSubmit={handleRequest}>
                            <div>
                                <label className="cp-label" htmlFor="email">Email</label>
                                <input
                                    className="cp-input"
                                    id="email"
                                    placeholder="student@university.edu"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" disabled={loading} className="cp-btn-primary mt-2">
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                        <span>Sending…</span>
                                    </>
                                ) : (
                                    <span>Send reset link</span>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form className="space-y-4" onSubmit={handleReset}>
                            <div>
                                <label className="cp-label" htmlFor="newPassword">New password</label>
                                <input
                                    className="cp-input"
                                    id="newPassword"
                                    placeholder="At least 8 characters"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="cp-label" htmlFor="confirmPassword">Confirm password</label>
                                <input
                                    className="cp-input"
                                    id="confirmPassword"
                                    placeholder="Repeat new password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" disabled={loading} className="cp-btn-primary mt-2">
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                        <span>Updating…</span>
                                    </>
                                ) : (
                                    <span>Update password</span>
                                )}
                            </button>
                        </form>
                    )}

                    <p className="mt-6 text-center text-sm text-white/60">
                        Remembered it?{' '}
                        <Link to="/login" className="font-semibold text-[#F3C64A] hover:underline">
                            Back to sign in
                        </Link>
                    </p>
                </div>
            </div>
        </PublicShell>
    );
};

export default ResetPassword;
