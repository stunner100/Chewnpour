import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAction, useQuery, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const sanitizeReturnPath = (value) => {
    const fallback = '/dashboard';
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed.startsWith('/')) return fallback;
    if (trimmed.startsWith('//')) return fallback;
    return trimmed;
};

const toPositiveInt = (value, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.floor(parsed));
};

const Subscription = () => {
    const location = useLocation();
    const { user } = useAuth();
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
    const userId = user?.id;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const quota = useQuery(
        api.subscriptions.getUploadQuotaStatus,
        userId && isConvexAuthenticated ? {} : 'skip'
    );
    const initializeCheckout = useAction(api.subscriptions.initializePaystackTopUpCheckout);

    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const returnPath = useMemo(
        () => sanitizeReturnPath(searchParams.get('from') || '/dashboard'),
        [searchParams]
    );

    useEffect(() => {
        const reason = String(searchParams.get('reason') || '').trim();
        const stateMessage = typeof location.state?.paywallMessage === 'string'
            ? location.state.paywallMessage.trim()
            : '';
        if (!reason) {
            setError(stateMessage || '');
            return;
        }

        const reasonMessages = {
            upload_limit: 'Upload limit reached. Pay GHS 20 to add 20 uploads and continue.',
            payment_failed: 'Payment was not completed. Please try again.',
            verification_failed: 'Could not verify payment yet. Please try again.',
            invalid_reference: 'This payment reference is invalid for your account.',
            payment_not_success: 'Payment is still pending or failed. Please complete payment to continue.',
            payment_mismatch: 'Payment details did not match the required top-up amount.',
            missing_reference: 'Missing payment reference. Start checkout again.',
        };

        setError(reasonMessages[reason] || 'Could not complete payment. Please try again.');
    }, [location.state, searchParams]);

    const safeQuota = quota || {
        freeLimit: 1,
        purchasedCredits: 0,
        consumedCredits: 0,
        totalAllowed: 1,
        remaining: 0,
        canTopUp: true,
        topUpPriceMajor: 20,
        currency: 'GHS',
        topUpCredits: 20,
    };

    const freeLimit = toPositiveInt(safeQuota.freeLimit, 1);
    const totalAllowed = toPositiveInt(safeQuota.totalAllowed, freeLimit);
    const remaining = toPositiveInt(safeQuota.remaining, 0);
    const consumed = Math.max(0, totalAllowed - remaining);
    const topUpCredits = toPositiveInt(safeQuota.topUpCredits, 20);
    const topUpPriceMajor = toPositiveInt(safeQuota.topUpPriceMajor, 20);
    const currency = String(safeQuota.currency || 'GHS').toUpperCase();
    const canTopUp = Boolean(safeQuota.canTopUp);

    const handleCheckout = async (event) => {
        event.preventDefault();

        if (!canTopUp) {
            setError('Top-up is available when your remaining uploads reach 0.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await initializeCheckout({ returnPath });
            const authorizationUrl = String(result?.authorizationUrl || '').trim();
            if (!authorizationUrl) {
                throw new Error('Could not start checkout right now.');
            }
            window.location.assign(authorizationUrl);
        } catch (checkoutError) {
            setError(checkoutError instanceof Error
                ? checkoutError.message
                : 'Could not initialize Paystack checkout.');
            setLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen px-4 py-10 md:py-14">
            <div className="w-full max-w-3xl mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-primary/10 to-blue-500/10">
                    <Link
                        to={returnPath}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        Back
                    </Link>
                    <h1 className="mt-3 text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                        Upload Top-Up
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Free users get {freeLimit} upload{freeLimit === 1 ? '' : 's'}. Add credits to continue uploading study and assignment files.
                    </p>
                </div>

                <div className="p-6 md:p-8 space-y-6">
                    {error && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm font-medium px-4 py-3">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Used</p>
                            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{consumed}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Allowed</p>
                            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{totalAllowed}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Remaining</p>
                            <p className={`mt-1 text-2xl font-bold ${remaining === 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                {remaining}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Top-Up Plan</p>
                                <p className="text-lg font-bold text-slate-900 dark:text-white">
                                    {currency} {topUpPriceMajor} for +{topUpCredits} uploads
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Credits are added once per successful payment.
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
                                <span className="material-symbols-outlined text-base">verified_user</span>
                                Secured by Paystack
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={loading || quota === undefined || !canTopUp}
                        className={`w-full h-14 rounded-2xl font-bold text-base transition-all disabled:cursor-not-allowed ${canTopUp
                            ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}
                    >
                        {loading
                            ? 'Redirecting to Paystack...'
                            : !canTopUp
                                ? `You still have ${remaining} upload${remaining === 1 ? '' : 's'} remaining`
                                : `Pay ${currency} ${topUpPriceMajor} and get +${topUpCredits} uploads`}
                    </button>

                    {!canTopUp && quota !== undefined && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                            Top-up becomes available when your remaining uploads reach 0.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Subscription;
