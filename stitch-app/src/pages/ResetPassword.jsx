import React from 'react';
import { Link } from 'react-router-dom';
import PublicShell from '../components/PublicShell';

/**
 * Password reset email transport is not wired yet.
 * Keep the route so old links do not 404, but do not call the disabled API.
 */
const ResetPassword = () => (
  <PublicShell>
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-8 shadow-sm">
        <h1 className="font-headline-md text-headline-md font-bold text-text-primary">
          Password reset unavailable
        </h1>
        <p className="mt-3 text-body-base text-text-secondary">
          Email password reset is temporarily disabled. Sign in with Google if you used it to create your account,
          or contact{' '}
          <a className="font-semibold text-primary hover:underline" href="mailto:info@chewnpour.com">
            info@chewnpour.com
          </a>{' '}
          for help recovering access.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-3 font-label-md text-on-primary hover:bg-primary-hover"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  </PublicShell>
);

export default ResetPassword;
