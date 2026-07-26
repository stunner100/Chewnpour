import React, { useMemo, useReducer } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { requestPasswordReset, resetPassword } from '../lib/auth-client';
import PublicShell, { ArrowBadge } from '../components/PublicShell';
import AppIcon from '../components/AppIcon';

const initialResetState = {
    email: '',
    newPassword: '',
    confirmPassword: '',
    error: '',
    success: '',
    loading: false,
};

const resetFormReducer = (state, action) => {
    switch (action.type) {
        case 'fieldChanged':
            return {
                ...state,
                [action.field]: action.value,
            };
        case 'requestStarted':
            return {
                ...state,
                error: '',
                success: '',
                loading: true,
            };
        case 'failed':
            return {
                ...state,
                error: action.error,
                success: '',
                loading: false,
            };
        case 'succeeded':
            return {
                ...state,
                error: '',
                success: action.success,
                loading: false,
            };
        case 'finished':
            return {
                ...state,
                loading: false,
            };
        default:
            return state;
    }
};

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

    const [{
        email,
        newPassword,
        confirmPassword,
        error,
        success,
        loading,
    }, dispatchResetForm] = useReducer(resetFormReducer, initialResetState);

    const handleRequest = async (e) => {
        e.preventDefault();
        dispatchResetForm({ type: 'requestStarted' });

        try {
            const redirectTo = `${window.location.origin}/reset-password`;
            const { error } = await requestPasswordReset({ email, redirectTo });
            if (error) {
                dispatchResetForm({
                    type: 'failed',
                    error: error.message || 'Failed to send reset email.',
                });
            } else {
                dispatchResetForm({
                    type: 'succeeded',
                    success: 'If this email exists, a reset link has been sent.',
                });
            }
        } catch {
            dispatchResetForm({ type: 'failed', error: 'An unexpected error occurred' });
        }
    };

    const handleReset = async (e) => {
        e.preventDefault();

        if (!newPassword || newPassword.length < 8) {
            dispatchResetForm({ type: 'failed', error: 'Password must be at least 8 characters.' });
            return;
        }
        if (newPassword !== confirmPassword) {
            dispatchResetForm({ type: 'failed', error: 'Passwords do not match.' });
            return;
        }

        dispatchResetForm({ type: 'requestStarted' });
        try {
            const { error } = await resetPassword({ newPassword, token });
            if (error) {
                dispatchResetForm({
                    type: 'failed',
                    error: error.message || 'Failed to reset password.',
                });
            } else {
                dispatchResetForm({
                    type: 'succeeded',
                    success: 'Password updated. You can now log in.',
                });
                setTimeout(() => navigate('/login'), 800);
            }
        } catch {
            dispatchResetForm({ type: 'failed', error: 'An unexpected error occurred' });
        }
    };

    return (
        <PublicShell>
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                {/* Left — pitch */}
                <div className="hidden lg:flex flex-col gap-8">
                    <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#007AFF]">
                        <span className="inline-block w-8 h-[2px] bg-[#007AFF]" /> Account recovery
                    </div>
                    <h1 className="text-5xl xl:text-6xl font-semibold leading-[1.05] tracking-tight">
                        {token ? (
                            <>
                                Set a<br />
                                <span className="text-[#007AFF]">new</span>
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
                    <p className="text-[#6B6B70] text-base leading-relaxed max-w-md">
                        {token
                            ? 'Choose a strong password you haven\u2019t used before. Eight characters minimum — no previously leaked passwords please.'
                            : 'Enter the email tied to your account and we\u2019ll send a reset link. No spam, ever.'}
                    </p>
                </div>

                {/* Right — form card */}
                <div className="cp-card">
                    <div className="mb-6">
                        <h2 className="text-2xl font-semibold mb-1">
                            {token ? 'Set a new password' : 'Reset your password'}
                        </h2>
                        <p className="text-sm text-[#6B6B70]">
                            {token
                                ? 'Choose a strong password you haven\u2019t used before.'
                                : 'Enter your email and we\u2019ll send a reset link.'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-5 rounded-xl border border-[#E8651B]/40 bg-[#007AFF]/10 px-4 py-3 text-sm text-[#B45309] flex items-center gap-2">
                            <AppIcon name="error" className="text-[18px]" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-5 rounded-xl border border-[#B39DFF]/40 bg-[#B39DFF]/10 px-4 py-3 text-sm text-[#B39DFF] flex items-center gap-2">
                            <AppIcon name="check_circle" className="text-[18px]" />
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
                                    onChange={(e) => dispatchResetForm({
                                        type: 'fieldChanged',
                                        field: 'email',
                                        value: e.target.value,
                                    })}
                                    required
                                />
                            </div>
                            <button type="submit" disabled={loading} className="cp-btn-primary mt-2">
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full size-4 border-2 border-white/30 border-t-white" />
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
                                    onChange={(e) => dispatchResetForm({
                                        type: 'fieldChanged',
                                        field: 'newPassword',
                                        value: e.target.value,
                                    })}
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
                                    onChange={(e) => dispatchResetForm({
                                        type: 'fieldChanged',
                                        field: 'confirmPassword',
                                        value: e.target.value,
                                    })}
                                    required
                                />
                            </div>
                            <button type="submit" disabled={loading} className="cp-btn-primary mt-2">
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full size-4 border-2 border-white/30 border-t-white" />
                                        <span>Updating…</span>
                                    </>
                                ) : (
                                    <span>Update password</span>
                                )}
                            </button>
                        </form>
                    )}

                    <p className="mt-6 text-center text-sm text-[#6B6B70]">
                        Remembered it?{' '}
                        <Link to="/login" className="font-semibold text-[#007AFF] hover:underline">
                            Back to sign in
                        </Link>
                    </p>
                </div>
            </div>
        </PublicShell>
    );
};

export default ResetPassword;
