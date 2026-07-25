import React from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../AppIcon';

const DeniedCard = ({ reason, signedInEmail, signedInUserId }) => {
    const reasonMessage = (() => {
        if (reason === 'not_configured') {
            return 'Admin access is not configured yet. Set ADMIN_EMAILS or ADMIN_USER_IDS in environment variables.';
        }
        if (reason === 'forbidden') {
            return 'Your account is signed in but does not have admin access.';
        }
        return 'You must be signed in to access the admin dashboard.';
    })();

    return (
        <div className="flex-1 px-space-6 py-space-10">
            <div className="mx-auto w-full max-w-3xl rounded-xl border border-border-subtle bg-surface p-space-8 shadow-sm">
                <div className="flex items-center gap-3 text-amber-600">
                    <AppIcon name="lock" />
                    <h1 className="text-xl font-semibold text-text-primary">Admin access required</h1>
                </div>
                <p className="mt-3 text-sm text-text-secondary">{reasonMessage}</p>
                <div className="mt-space-4 rounded-xl border border-border-subtle bg-surface-soft p-space-4 text-sm">
                    <p className="text-text-secondary">
                        Signed in as: <span className="font-semibold text-text-primary">{signedInEmail || signedInUserId || 'Unknown user'}</span>
                    </p>
                </div>
                <div className="mt-6">
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary-hover transition-colors"
                    >
                        <AppIcon name="arrow_back" className="text-[18px]" />
                        Back to dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default DeniedCard;
