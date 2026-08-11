import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PublicShell from '../components/PublicShell';
import { requestPasswordReset, resetPassword } from '../lib/auth-client';
import { watermelonToast } from '../components/watermelon/watermelonToast';
import { WatermelonToaster } from '../components/watermelon/WatermelonSonner';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(
    () => String(searchParams.get('token') || '').trim(),
    [searchParams],
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState('');

  const handleRequestReset = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: resetError } = await requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) {
        throw new Error(resetError.message || 'Could not send reset email');
      }
      setRequestSent(true);
      watermelonToast('If that email exists, a reset link is on the way.', {
        type: 'success',
      });
    } catch (err) {
      const message = err?.message || 'Could not send reset email';
      setError(message);
      watermelonToast(message, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await resetPassword({
        newPassword: password,
        token,
      });
      if (resetError) {
        throw new Error(resetError.message || 'Could not reset password');
      }
      watermelonToast('Password updated. Sign in with your new password.', {
        type: 'success',
      });
      navigate('/login', { replace: true });
    } catch (err) {
      const message = err?.message || 'Could not reset password';
      setError(message);
      watermelonToast(message, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicShell>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-8 shadow-sm">
          <h1 className="font-headline-md text-headline-md font-bold text-text-primary">
            {token ? 'Choose a new password' : 'Reset your password'}
          </h1>
          <p className="mt-3 text-body-base text-text-secondary">
            {token
              ? 'Enter a new password for your ChewnPour account.'
              : 'We will email you a secure link to reset your password.'}
          </p>

          {error ? (
            <p className="mt-4 rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-sm text-error">
              {error}
            </p>
          ) : null}

          {token ? (
            <form className="mt-6 space-y-4" onSubmit={handleSetPassword}>
              <div>
                <label className="cp-label" htmlFor="new-password">
                  New password
                </label>
                <input
                  id="new-password"
                  className="cp-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="cp-label" htmlFor="confirm-password">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  className="cp-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <button type="submit" disabled={loading} className="cp-btn-primary w-full">
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          ) : requestSent ? (
            <p className="mt-6 text-body-base text-text-secondary">
              Check your inbox for a reset link. It expires in about an hour.
            </p>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleRequestReset}>
              <div>
                <label className="cp-label" htmlFor="reset-email">
                  Email
                </label>
                <input
                  id="reset-email"
                  className="cp-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="cp-btn-primary w-full">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}

          <Link
            to="/login"
            className="mt-6 inline-flex min-h-11 items-center justify-center font-label-md text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </main>
      <WatermelonToaster position="bottom-center" />
    </PublicShell>
  );
};

export default ResetPassword;
