import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAction, useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import {
    buildUploadLimitMessageFromOptions,
    formatPlanPrice,
    normalizeTopUpOptions,
} from '../lib/pricingCurrency';

const sanitizeReturnPath = (value) => {
    const fallback = '/dashboard';
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed.startsWith('/')) return fallback;
    if (trimmed.startsWith('//')) return fallback;
    return trimmed;
};

const toNonNegativeInt = (value, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.floor(parsed));
};

const DEFAULT_TOP_UP_OPTIONS = [
    { id: 'starter', amountMajor: 20, credits: 5, currency: 'GHS' },
    { id: 'max', amountMajor: 40, credits: 12, currency: 'GHS' },
];

const Subscription = () => {
    const location = useLocation();
    const { user } = useAuth();
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
    const userId = user?.id;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState(DEFAULT_TOP_UP_OPTIONS[0].id);

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

    const safeQuota = quota || {
        freeLimit: 1,
        purchasedCredits: 0,
        consumedCredits: 0,
        totalAllowed: 1,
        remaining: 0,
        canTopUp: true,
        topUpPriceMajor: 20,
        currency: 'GHS',
        topUpCredits: 5,
        topUpOptions: DEFAULT_TOP_UP_OPTIONS,
    };

    const freeLimit = toNonNegativeInt(safeQuota.freeLimit, 1);
    const totalAllowed = toNonNegativeInt(safeQuota.totalAllowed, freeLimit);
    const remaining = toNonNegativeInt(safeQuota.remaining, 0);
    const consumed = Math.max(0, totalAllowed - remaining);
    const currency = String(safeQuota.currency || 'GHS').toUpperCase();
    const topUpOptions = useMemo(
        () => normalizeTopUpOptions(safeQuota.topUpOptions, currency),
        [safeQuota.topUpOptions, currency]
    );
    const selectedTopUpPlan = topUpOptions.find((plan) => plan.id === selectedPlanId) || topUpOptions[0];
    const uploadLimitMessage = useMemo(
        () => buildUploadLimitMessageFromOptions(topUpOptions, currency),
        [topUpOptions, currency]
    );

    useEffect(() => {
        if (!selectedTopUpPlan) return;
        if (selectedTopUpPlan.id === selectedPlanId) return;
        setSelectedPlanId(selectedTopUpPlan.id);
    }, [selectedPlanId, selectedTopUpPlan]);

    useEffect(() => {
        const reason = String(searchParams.get('reason') || '').trim();
        const stateMessage = typeof location.state?.paywallMessage === 'string'
            ? location.state.paywallMessage.trim()
            : '';
        if (!reason) {
            setError(remaining <= 0 ? stateMessage : '');
            return;
        }

        if (reason === 'upload_limit') {
            setError(remaining <= 0 ? (stateMessage || uploadLimitMessage) : '');
            return;
        }

        if (reason === 'ai_message_limit') {
            setError(
                stateMessage
                || "You've used your free AI messages today. Upgrade to premium for unlimited AI chat."
            );
            return;
        }

        const reasonMessages = {
            payment_failed: 'Payment was not completed. Please try again.',
            verification_failed: 'Could not verify payment yet. Please try again.',
            invalid_reference: 'This payment reference is invalid for your account.',
            payment_not_success: 'Payment is still pending or failed. Please complete payment to continue.',
            payment_mismatch: 'Payment details did not match your selected top-up plan.',
            missing_reference: 'Missing payment reference. Start checkout again.',
        };

        setError(reasonMessages[reason] || 'Could not complete payment. Please try again.');
    }, [location.state, searchParams, uploadLimitMessage, remaining]);

    const handleCheckout = async (event) => {
        event.preventDefault();
        if (!selectedTopUpPlan) {
            setError('No top-up plan is available right now. Please refresh and try again.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await initializeCheckout({
                returnPath,
                topUpPlanId: selectedTopUpPlan.id,
            });
            const authorizationUrl = String(result?.authorizationUrl || '').trim();
            if (!authorizationUrl) {
                throw new Error('Could not start checkout right now.');
            }
            window.location.assign(authorizationUrl);
        } catch (checkoutError) {
            setError(
                checkoutError instanceof Error
                    ? checkoutError.message
                    : 'Could not initialize Paystack checkout.'
            );
            setLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen px-4 py-10 pb-28 md:py-14 md:pb-14">
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
                        Free users get {freeLimit} upload{freeLimit === 1 ? '' : 's'}. Add credits anytime to increase your upload balance.
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
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Top-Up Plans</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {topUpOptions.map((plan) => {
                                    const active = plan.id === selectedTopUpPlan?.id;
                                    return (
                                        <button
                                            key={plan.id}
                                            type="button"
                                            onClick={() => setSelectedPlanId(plan.id)}
                                            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                                                active
                                                    ? 'border-primary bg-primary/10'
                                                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900'
                                            }`}
                                        >
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                                                {formatPlanPrice(plan.amountMajor, plan.currency)}
                                            </p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                +{plan.credits} uploads
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Credits are added once per successful payment.
                                </p>
                                <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <span className="material-symbols-outlined text-base">verified_user</span>
                                    Secured by Paystack
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={loading || quota === undefined || !selectedTopUpPlan}
                        className="w-full h-14 rounded-2xl font-bold text-base transition-all disabled:cursor-not-allowed bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25"
                    >
                        {loading
                            ? 'Redirecting to Paystack...'
                            : `Pay ${formatPlanPrice(selectedTopUpPlan?.amountMajor || 0, selectedTopUpPlan?.currency || currency)} and get +${selectedTopUpPlan?.credits || 0} uploads`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Subscription;
