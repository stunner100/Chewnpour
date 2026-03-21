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

const normalizeProviderHint = (provider) => {
    const normalized = String(provider || '').trim().toLowerCase();
    if (!normalized) return 'checkout';
    if (normalized === 'manual') return 'fallback checkout';
    return normalized;
};

const CONVEX_ERROR_WRAPPER_PATTERN = /\[CONVEX [^\]]+\]\s*\[Request ID:[^\]]+\]\s*/i;

const resolveConvexActionError = (error, fallbackMessage) => {
    const dataMessage = typeof error?.data === 'string'
        ? error.data
        : typeof error?.data?.message === 'string'
            ? error.data.message
            : '';
    const resolved = String(dataMessage || error?.message || fallbackMessage || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!resolved) return fallbackMessage;

    const unwrapped = resolved
        .replace(CONVEX_ERROR_WRAPPER_PATTERN, '')
        .replace(/^Uncaught (ConvexError|Error):\s*/i, '')
        .replace(/^ConvexError:\s*/i, '')
        .replace(/^Server Error\s*/i, '')
        .replace(/Called by client$/i, '')
        .trim();

    return unwrapped || fallbackMessage;
};

const DEFAULT_TOP_UP_OPTIONS = [
    { id: 'first-time-starter', amountMajor: 15, credits: 5, currency: 'GHS' },
    { id: 'starter', amountMajor: 20, credits: 5, currency: 'GHS' },
    { id: 'max', amountMajor: 40, credits: 12, currency: 'GHS' },
    { id: 'semester', amountMajor: 60, credits: 20, currency: 'GHS', validityDays: 120, unlimitedAiChat: true },
];

const Subscription = () => {
    const location = useLocation();
    const { user } = useAuth();
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
    const userId = user?.id;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [providerHint, setProviderHint] = useState('');
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
        freeLimit: 3,
        purchasedCredits: 0,
        consumedCredits: 0,
        totalAllowed: 3,
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
            setProviderHint(normalizeProviderHint(result?.provider));
            const authorizationUrl = String(result?.authorizationUrl || '').trim();
            if (!authorizationUrl) {
                throw new Error('Could not start checkout right now.');
            }
            window.location.assign(authorizationUrl);
        } catch (checkoutError) {
            setError(resolveConvexActionError(checkoutError, 'Could not initialize checkout.'));
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto px-4 md:px-8 py-8 pb-24 md:pb-12 space-y-6">
            {/* Header */}
            <div>
                <Link
                    to={returnPath}
                    className="inline-flex items-center gap-1 text-caption font-semibold text-text-faint-light dark:text-text-faint-dark hover:text-primary transition-colors mb-4"
                >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Back
                </Link>
                <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark">Choose Your Plan</h1>
                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-1">
                    Add uploads anytime. Semester Pass includes unlimited AI chat and 4 months of access.
                </p>
            </div>

            {/* Alerts */}
            {error && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                    <p className="text-body-sm text-amber-800 dark:text-amber-300">{error}</p>
                </div>
            )}
            {!error && remaining === 0 && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-red-500 text-[18px] mt-0.5">warning</span>
                    <div>
                        <p className="text-body-sm font-semibold text-red-700 dark:text-red-300">No uploads remaining</p>
                        <p className="text-caption text-red-600 dark:text-red-400 mt-0.5">
                            Top up to keep studying with AI and ace your exams.
                        </p>
                    </div>
                </div>
            )}

            {/* Usage Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="card-base p-4">
                    <p className="text-overline text-text-faint-light dark:text-text-faint-dark">Used</p>
                    <p className="text-display-sm text-text-main-light dark:text-text-main-dark mt-1">{consumed}</p>
                </div>
                <div className="card-base p-4">
                    <p className="text-overline text-text-faint-light dark:text-text-faint-dark">Total</p>
                    <p className="text-display-sm text-text-main-light dark:text-text-main-dark mt-1">{totalAllowed}</p>
                </div>
                <div className="card-base p-4">
                    <p className="text-overline text-text-faint-light dark:text-text-faint-dark">Remaining</p>
                    <p className={`text-display-sm mt-1 ${remaining === 0 ? 'text-red-500' : 'text-accent-emerald'}`}>
                        {remaining}
                    </p>
                </div>
            </div>

            {/* Top-Up Plans */}
            <div className="card-base p-5 space-y-4">
                <h3 className="text-overline text-text-faint-light dark:text-text-faint-dark">Top-Up Plans</h3>
                <div className={`grid grid-cols-1 ${topUpOptions.length > 3 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3`}>
                    {topUpOptions.map((plan) => {
                        const active = plan.id === selectedTopUpPlan?.id;
                        const isSemester = plan.id === 'semester';
                        const isFirstTime = plan.id === 'first-time-starter';
                        return (
                            <button
                                key={plan.id}
                                type="button"
                                onClick={() => setSelectedPlanId(plan.id)}
                                className={`relative rounded-xl border px-4 py-3 text-left transition-colors ${
                                    active
                                        ? isSemester
                                            ? 'border-accent-emerald bg-accent-emerald/5 ring-1 ring-accent-emerald/20'
                                            : isFirstTime
                                                ? 'border-accent-amber bg-accent-amber/5 ring-1 ring-accent-amber/20'
                                                : 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                        : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark'
                                }`}
                            >
                                {isSemester && (
                                    <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-accent-emerald text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                                        Best Value
                                    </span>
                                )}
                                {isFirstTime && (
                                    <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-accent-amber text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                                        First Purchase
                                    </span>
                                )}
                                <p className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">
                                    {formatPlanPrice(plan.amountMajor, plan.currency)}
                                </p>
                                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                    +{plan.credits} uploads
                                </p>
                                {isFirstTime && (
                                    <p className="mt-1 text-caption font-semibold text-accent-amber">
                                        25% off your first top-up
                                    </p>
                                )}
                                {isSemester && (
                                    <div className="mt-1.5 space-y-0.5">
                                        <p className="text-caption font-semibold text-accent-emerald">
                                            {formatPlanPrice(plan.amountMajor / plan.credits, plan.currency)}/upload
                                        </p>
                                        <p className="text-caption text-accent-emerald flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">all_inclusive</span>
                                            Unlimited AI chat
                                        </p>
                                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                            Valid for 4 months
                                        </p>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pt-2 border-t border-border-light dark:border-border-dark">
                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                        Credits are added once per successful payment.
                    </p>
                    <div className="inline-flex items-center gap-1.5 text-caption text-text-faint-light dark:text-text-faint-dark">
                        <span className="material-symbols-outlined text-[14px]">verified_user</span>
                        Secure checkout
                    </div>
                </div>
            </div>

            {/* Checkout Button */}
            <button
                type="button"
                onClick={handleCheckout}
                disabled={loading || quota === undefined || !selectedTopUpPlan}
                className="w-full btn-primary text-body-base py-3 flex items-center justify-center gap-2"
            >
                {loading ? (
                    <>
                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                        Redirecting to {providerHint || 'checkout'}...
                    </>
                ) : `Pay ${formatPlanPrice(selectedTopUpPlan?.amountMajor || 0, selectedTopUpPlan?.currency || currency)} and get +${selectedTopUpPlan?.credits || 0} uploads`}
            </button>
        </div>
    );
};

export default Subscription;
