import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    buildUploadLimitMessageFromOptions,
    formatPlanPrice,
    normalizeTopUpOptions,
} from '../lib/pricingCurrency';
import { ShimmerButton } from '../components/magicui/ShimmerButton';
import { WatermelonWidget, WatermelonWidgetsGrid } from '../components/watermelon/WatermelonWidgets';
import { WatermelonDisclosure } from '../components/watermelon/WatermelonDisclosure';
import { watermelonToast } from '../components/watermelon/watermelonToast';
import AppIcon from '../components/AppIcon';

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

const DEFAULT_TOP_UP_OPTIONS = [
    { id: 'first-time-starter', amountMajor: 15, credits: 5, currency: 'GHS' },
    { id: 'starter', amountMajor: 20, credits: 5, currency: 'GHS' },
    { id: 'max', amountMajor: 40, credits: 12, currency: 'GHS' },
    { id: 'semester', amountMajor: 60, credits: 20, currency: 'GHS', validityDays: 120, unlimitedAiChat: true },
];

const fetchBillingQuota = async () => {
    const response = await fetch('/api/billing', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || `Failed to load billing (${response.status})`);
    }
    return payload;
};

const startCheckout = async ({ returnPath, topUpPlanId }) => {
    const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ returnPath, topUpPlanId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || `Checkout failed (${response.status})`);
    }
    return payload;
};

const Subscription = () => {
    const routerLocation = useLocation();
    const { user } = useAuth();
    const userId = user?.id;

    const [loading, setLoading] = useState(false);
    const [checkoutError, setCheckoutError] = useState('');
    const [providerHint, setProviderHint] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState(DEFAULT_TOP_UP_OPTIONS[0].id);
    const [quota, setQuota] = useState(null);
    const [quotaLoading, setQuotaLoading] = useState(true);

    const searchParams = useMemo(() => new URLSearchParams(routerLocation.search), [routerLocation.search]);
    const returnPath = useMemo(
        () => sanitizeReturnPath(searchParams.get('from') || '/dashboard'),
        [searchParams],
    );
    const paywallStateMessage = typeof routerLocation.state?.paywallMessage === 'string'
        ? routerLocation.state.paywallMessage.trim()
        : '';

    useEffect(() => {
        if (!userId) {
            setQuota(null);
            setQuotaLoading(false);
            return undefined;
        }

        let cancelled = false;
        setQuotaLoading(true);
        (async () => {
            try {
                const payload = await fetchBillingQuota();
                if (cancelled) return;
                setQuota(payload?.quota || null);
                const options = normalizeTopUpOptions(payload?.quota?.topUpOptions);
                if (options[0]?.id) {
                    setSelectedPlanId(options[0].id);
                }
            } catch (error) {
                console.error('Failed to load billing quota:', error);
                if (!cancelled) {
                    setCheckoutError(error.message || 'Could not load top-up plans.');
                    setQuota(null);
                }
            } finally {
                if (!cancelled) setQuotaLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userId]);

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
        [safeQuota.topUpOptions, currency],
    );
    const selectedTopUpPlan = topUpOptions.find((plan) => plan.id === selectedPlanId) || topUpOptions[0];
    const uploadLimitMessage = useMemo(
        () => buildUploadLimitMessageFromOptions(topUpOptions, currency),
        [topUpOptions, currency],
    );
    const routeError = useMemo(() => {
        const reason = String(searchParams.get('reason') || '').trim();
        if (!reason) {
            return remaining <= 0 ? paywallStateMessage : '';
        }

        if (reason === 'upload_limit') {
            return remaining <= 0 ? (paywallStateMessage || uploadLimitMessage) : '';
        }

        if (reason === 'ai_message_limit') {
            return (
                paywallStateMessage
                || "You've used your free AI messages today. Upgrade to premium for unlimited AI chat."
            );
        }

        const reasonMessages = {
            payment_failed: 'Payment was not completed. Please try again.',
            verification_failed: 'Could not verify payment yet. Please try again.',
            invalid_reference: 'This payment reference is invalid for your account.',
            payment_not_success: 'Payment is still pending or failed. Please complete payment to continue.',
            payment_mismatch: 'Payment details did not match your selected top-up plan.',
            missing_reference: 'Missing payment reference. Start checkout again.',
        };

        return reasonMessages[reason] || 'Could not complete payment. Please try again.';
    }, [paywallStateMessage, remaining, searchParams, uploadLimitMessage]);
    const error = loading ? checkoutError : (checkoutError || routeError);

    const handlePlanSelect = (planId) => {
        setSelectedPlanId(planId);
        setCheckoutError('');
    };

    const handleCheckout = async (event) => {
        event.preventDefault();
        if (!selectedTopUpPlan) {
            const message = 'No top-up plan is available right now. Please refresh and try again.';
            setCheckoutError(message);
            watermelonToast(message, { type: 'warning', duration: 4500 });
            return;
        }

        setLoading(true);
        setCheckoutError('');

        try {
            const result = await startCheckout({
                returnPath,
                topUpPlanId: selectedTopUpPlan.id,
            });
            setProviderHint(normalizeProviderHint(result?.provider));
            const authorizationUrl = String(result?.authorizationUrl || '').trim();
            if (!authorizationUrl) {
                throw new Error('Could not start checkout right now.');
            }
            window.location.assign(authorizationUrl);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not initialize checkout.';
            setCheckoutError(message);
            watermelonToast(message, { type: 'warning', duration: 4500 });
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto px-4 md:px-8 py-8 pb-24 md:pb-12 space-y-6">
            <div>
                <Link
                    to={returnPath}
                    className="inline-flex items-center gap-1 text-caption font-semibold text-text-faint-light dark:text-text-faint-dark hover:text-primary transition-colors mb-4"
                >
                    <AppIcon name="arrow_back" className="text-[16px]" />
                    Back
                </Link>
                <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark">Choose Your Plan</h1>
                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-1">
                    Add uploads anytime. Semester Pass includes unlimited AI chat and 4 months of access.
                </p>
            </div>

            {error && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                    <p className="text-body-sm text-amber-800 dark:text-amber-300">{error}</p>
                </div>
            )}
            {!error && remaining === 0 && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 flex items-start gap-2.5">
                    <AppIcon name="warning" className="text-red-500 text-[18px] mt-0.5" />
                    <div>
                        <p className="text-body-sm font-semibold text-red-700 dark:text-red-300">No uploads remaining</p>
                        <p className="text-caption text-red-600 dark:text-red-400 mt-0.5">
                            Top up to keep studying with AI and ace your exams.
                        </p>
                    </div>
                </div>
            )}

            <WatermelonWidgetsGrid cols={3}>
                <WatermelonWidget
                    title="Used"
                    value={consumed}
                    subtitle="uploads consumed"
                    icon="upload_file"
                    accent="primary"
                />
                <WatermelonWidget
                    title="Total"
                    value={totalAllowed}
                    subtitle="upload allowance"
                    icon="inventory_2"
                    accent="indigo"
                />
                <WatermelonWidget
                    title="Remaining"
                    value={remaining}
                    subtitle={remaining === 0 ? 'top up to keep going' : 'available to use'}
                    icon={remaining === 0 ? 'warning' : 'bolt'}
                    accent={remaining === 0 ? 'rose' : 'emerald'}
                />
            </WatermelonWidgetsGrid>

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
                                onClick={() => handlePlanSelect(plan.id)}
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
                                            <AppIcon name="all_inclusive" className="text-[14px]" />
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
                        <AppIcon name="verified_user" className="text-[14px]" />
                        Secure checkout
                    </div>
                </div>
            </div>

            <ShimmerButton
                onClick={handleCheckout}
                disabled={loading || quotaLoading || !selectedTopUpPlan}
                className="w-full btn-primary text-body-base py-3 flex items-center justify-center gap-2"
                shimmerColor="#0D9488"
            >
                {loading ? (
                    <>
                        <AppIcon name="progress_activity" className="text-[18px] animate-spin" />
                        Redirecting to {providerHint || 'checkout'}...
                    </>
                ) : `Pay ${formatPlanPrice(selectedTopUpPlan?.amountMajor || 0, selectedTopUpPlan?.currency || currency)} and get +${selectedTopUpPlan?.credits || 0} uploads`}
            </ShimmerButton>

            <div className="space-y-2">
                <h3 className="text-overline text-text-faint-light dark:text-text-faint-dark mb-3">Frequently Asked Questions</h3>
                <WatermelonDisclosure title="What does an upload credit cover?">
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        One upload credit lets you process a single document (PDF, DOCX, PPTX, or image). ChewnPour turns it into a structured course with lessons, quizzes, and a revision plan.
                    </p>
                </WatermelonDisclosure>
                <WatermelonDisclosure title="Do credits expire?">
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        Top-up credits never expire as long as your account is active. The Semester Pass is valid for 4 months and includes unlimited AI chat during that period.
                    </p>
                </WatermelonDisclosure>
                <WatermelonDisclosure title="What happens after I run out of credits?">
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        You can keep studying with all the courses you&apos;ve already uploaded. To process new documents, top up anytime, credits are added instantly after a successful payment.
                    </p>
                </WatermelonDisclosure>
                <WatermelonDisclosure title="Is my payment secure?">
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        Yes. All payments are processed by Paystack with bank-grade encryption. ChewnPour never stores your card details.
                    </p>
                </WatermelonDisclosure>
                <WatermelonDisclosure title="Can I get a refund?">
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        Unused credits are refundable within 7 days of purchase. Reach out at info@chewnpour.com and we&apos;ll sort it for you.
                    </p>
                </WatermelonDisclosure>
            </div>
        </div>
    );
};

export default Subscription;
