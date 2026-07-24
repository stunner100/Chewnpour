import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const sanitizeReturnPath = (value) => {
    const fallback = '/dashboard';
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed.startsWith('/')) return fallback;
    if (trimmed.startsWith('//')) return fallback;
    return trimmed;
};

const verifyTopUpPayment = async ({ reference, returnPath }) => {
    const response = await fetch('/api/billing/verify', {
        method: 'POST',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reference, returnPath }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || `Verification failed (${response.status})`);
    }
    return payload;
};

const SubscriptionCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const reference = useMemo(() => String(searchParams.get('reference') || '').trim(), [searchParams]);
    const returnPath = useMemo(() => sanitizeReturnPath(searchParams.get('from') || '/dashboard'), [searchParams]);

    const [verificationState, setVerificationState] = useState({
        status: 'verifying',
        errorMessage: '',
    });
    const { status, errorMessage } = verificationState;

    useEffect(() => {
        let cancelled = false;

        const runVerification = async () => {
            if (!reference) {
                const fallback = `/subscription?from=${encodeURIComponent(returnPath)}&reason=missing_reference`;
                navigate(fallback, { replace: true });
                return;
            }

            try {
                const result = await verifyTopUpPayment({
                    reference,
                    returnPath,
                });

                if (cancelled) return;

                if (result?.success) {
                    const redirectTo = sanitizeReturnPath(result?.redirectTo || returnPath);
                    const grantedCredits = Number.isFinite(Number(result?.grantedCredits))
                        ? Math.max(0, Math.floor(Number(result.grantedCredits)))
                        : 0;
                    navigate(redirectTo, {
                        replace: true,
                        state: {
                            paywallToastMessage: grantedCredits > 0
                                ? `Payment successful. ${grantedCredits} uploads added to your quota.`
                                : 'Payment successful. Your upload quota has been updated.',
                        },
                    });
                    return;
                }

                const failureRedirect = String(result?.redirectTo || '').trim();
                if (failureRedirect.startsWith('/')) {
                    navigate(failureRedirect, { replace: true });
                } else {
                    navigate(`/subscription?from=${encodeURIComponent(returnPath)}&reason=payment_failed`, {
                        replace: true,
                    });
                }
            } catch (error) {
                if (cancelled) return;
                setVerificationState({
                    status: 'failed',
                    errorMessage: error instanceof Error ? error.message : 'Could not verify payment.',
                });
                navigate(`/subscription?from=${encodeURIComponent(returnPath)}&reason=verification_failed`, {
                    replace: true,
                });
            }
        };

        runVerification();

        return () => {
            cancelled = true;
        };
    }, [navigate, reference, returnPath]);

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
            <div className="w-full max-w-md card-base p-8 text-center">
                <div className={`mx-auto size-14 rounded-2xl flex items-center justify-center mb-4 ${
                    status === 'failed'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'bg-primary/8 text-primary'
                }`}>
                    <span className="material-symbols-outlined text-[24px]">
                        {status === 'failed' ? 'error' : 'sync'}
                    </span>
                </div>
                <h1 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">
                    {status === 'failed' ? 'Payment Verification Failed' : 'Verifying Payment'}
                </h1>
                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                    {status === 'failed'
                        ? (errorMessage || 'We could not confirm your payment right now. Redirecting...')
                        : 'Please wait while we confirm your payment and unlock uploads.'}
                </p>
                <div className="mt-6 flex justify-center">
                    <div className="animate-spin rounded-full size-8 border-2 border-border-light dark:border-border-dark border-t-primary"></div>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionCallback;
