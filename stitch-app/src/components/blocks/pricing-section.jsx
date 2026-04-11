import React from 'react';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { formatPlanPrice } from '../../lib/pricingCurrency';

const defaultStarterPlan = { id: 'starter', amountMajor: 20, credits: 5, currency: 'GHS' };
const defaultMaxPlan = { id: 'max', amountMajor: 40, credits: 12, currency: 'GHS' };
const defaultSemesterPlan = {
    id: 'semester',
    amountMajor: 60,
    credits: 20,
    currency: 'GHS',
    validityDays: 120,
    unlimitedAiChat: true,
};

const getSavingsPercent = (starterPlan, candidatePlan) => {
    const starterCredits = Number(starterPlan?.credits || 0);
    const candidateCredits = Number(candidatePlan?.credits || 0);
    if (starterCredits <= 0 || candidateCredits <= 0) return 0;

    const starterPerUpload = Number(starterPlan.amountMajor || 0) / starterCredits;
    const candidatePerUpload = Number(candidatePlan.amountMajor || 0) / candidateCredits;
    if (!Number.isFinite(starterPerUpload) || !Number.isFinite(candidatePerUpload) || starterPerUpload <= 0) {
        return 0;
    }

    return Math.max(0, Math.round((1 - candidatePerUpload / starterPerUpload) * 100));
};

const buildTierSubtext = (plan, savingsPercent = 0) => {
    const perUploadCopy = `${formatPlanPrice(plan.amountMajor / plan.credits, plan.currency)}/upload`;
    if (!savingsPercent) return perUploadCopy;

    return (
        <span className="flex items-center gap-2">
            {perUploadCopy}
            <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-md">
                Save {savingsPercent}%
            </span>
        </span>
    );
};

export function PricingSection({
    starterPlan = defaultStarterPlan,
    maxPlan = defaultMaxPlan,
    semesterPlan = defaultSemesterPlan,
    onCtaClick = () => {},
}) {
    const pricingTiers = [
        {
            name: 'Free',
            badge: null,
            price: formatPlanPrice(0, starterPlan.currency),
            period: '/forever',
            subtext: 'No credit card required',
            features: [
                '3 document uploads',
                'AI-powered lessons',
                'Interactive quizzes',
                'AI Tutor chat',
                'Progress tracking',
            ],
            ctaText: 'Get Started Free',
            ctaLink: '/signup',
            ctaName: 'pricing_free',
            highlight: false,
            theme: 'zinc',
        },
        {
            name: 'Starter',
            badge: `FIRST PURCHASE ${formatPlanPrice(15, starterPlan.currency)}`,
            price: formatPlanPrice(starterPlan.amountMajor, starterPlan.currency),
            period: '/top-up',
            subtext: buildTierSubtext(starterPlan),
            features: [
                `+${starterPlan.credits} uploads`,
                'Everything in Free',
                'Priority AI processing',
                'Assignment Helper',
                'AI Humanizer tool',
                'Premium support',
            ],
            ctaText: 'Choose Starter',
            ctaLink: '/signup',
            ctaName: 'pricing_starter',
            highlight: false,
            theme: 'orange',
        },
        {
            name: 'Max',
            badge: null,
            price: formatPlanPrice(maxPlan.amountMajor, maxPlan.currency),
            period: '/top-up',
            subtext: buildTierSubtext(maxPlan, getSavingsPercent(starterPlan, maxPlan)),
            features: [
                `+${maxPlan.credits} uploads`,
                'Everything in Free',
                'Priority AI processing',
                'Assignment Helper',
                'AI Humanizer tool',
                'Premium support',
            ],
            ctaText: 'Choose Max',
            ctaLink: '/signup',
            ctaName: 'pricing_max',
            highlight: false,
            theme: 'zinc',
        },
        {
            name: 'Semester Pass',
            badge: 'BEST VALUE',
            price: formatPlanPrice(semesterPlan.amountMajor, semesterPlan.currency),
            period: '/semester',
            subtext: buildTierSubtext(semesterPlan, getSavingsPercent(starterPlan, semesterPlan)),
            features: [
                `+${semesterPlan.credits} uploads`,
                'Unlimited AI chat messages',
                'Everything in Free',
                'Priority AI processing',
                'Assignment Helper',
                'AI Humanizer tool',
                `Valid for ~${Math.max(1, Math.round((semesterPlan.validityDays || 120) / 30))} months`,
            ],
            ctaText: 'Get Semester Pass',
            ctaLink: '/signup',
            ctaName: 'pricing_semester',
            highlight: true,
            theme: 'primary',
        },
    ];

    return (
        <section id="pricing" className="relative overflow-hidden border-t border-border/40 bg-background py-20 md:py-28">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="mx-auto mb-16 max-w-3xl text-center">
                    <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">Flexible pricing</p>
                    <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                        Choose the right plan for you
                    </h2>
                    <p className="mt-4 text-base md:text-lg text-muted-foreground">
                        Affordable study tools designed to fit any student&apos;s budget. Upgrade anytime.
                    </p>
                </div>

                <div className="isolate mx-auto grid max-w-md grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-4">
                    {pricingTiers.map((tier) => (
                        <div
                            key={tier.name}
                            className={`flex flex-col relative rounded-[2rem] p-8 xl:p-10 ring-1 transition-all duration-300 hover:-translate-y-1 bg-background/60 backdrop-blur-xl shadow-xl hover:shadow-2xl
                                ${tier.highlight
                                    ? 'ring-2 ring-primary scale-[1.02] lg:scale-105 z-10 shadow-primary/20 bg-background/90'
                                    : 'ring-border/60 hover:ring-border'}
                                ${tier.theme === 'emerald' ? 'hover:ring-emerald-500/50' : ''}
                                ${tier.theme === 'orange' ? 'hover:ring-orange-500/50' : ''}
                            `}
                        >
                            {tier.badge && (
                                <span className={`absolute -top-4 inset-x-0 mx-auto w-fit rounded-full px-4 py-1.5 text-[0.65rem] sm:text-xs font-bold uppercase tracking-wider shadow-sm
                                    ${tier.theme === 'primary' ? 'bg-primary text-primary-foreground' : ''}
                                    ${tier.theme === 'emerald' ? 'bg-emerald-500 text-white' : ''}
                                    ${tier.theme === 'orange' ? 'bg-orange-500 text-white' : ''}
                                `}>
                                    {tier.badge}
                                </span>
                            )}

                            <div className="mb-6">
                                <h4 className={`text-lg font-bold leading-8 mb-4 tracking-wide
                                    ${tier.theme === 'primary' ? 'text-primary' : ''}
                                    ${tier.theme === 'emerald' ? 'text-emerald-500' : ''}
                                    ${tier.theme === 'orange' ? 'text-orange-500' : ''}
                                    ${tier.theme === 'zinc' ? 'text-foreground' : ''}
                                `}>
                                    {tier.name}
                                </h4>
                                <div className="flex items-baseline gap-x-1">
                                    <span className="text-4xl font-bold tracking-tight text-foreground">{tier.price}</span>
                                    <span className="text-sm font-semibold leading-6 text-muted-foreground">{tier.period}</span>
                                </div>
                                <div className="mt-2 text-sm leading-6 text-muted-foreground min-h-6 flex items-center">{tier.subtext}</div>
                            </div>

                            <ul role="list" className="mt-2 space-y-4 text-sm leading-6 text-foreground/90 flex-1">
                                {tier.features.map((feature) => (
                                    <li key={feature} className="flex gap-x-3 items-start font-medium">
                                        <Check className={`h-5 w-5 flex-none shrink-0 mt-0.5
                                            ${tier.theme === 'primary' ? 'text-primary' : ''}
                                            ${tier.theme === 'emerald' ? 'text-emerald-500' : ''}
                                            ${tier.theme === 'orange' ? 'text-orange-500' : ''}
                                            ${tier.theme === 'zinc' ? 'text-muted-foreground' : ''}
                                        `} aria-hidden="true" />
                                        {feature.includes('Unlimited AI chat messages') ? (
                                            <span className="font-semibold text-emerald-500">{feature}</span>
                                        ) : (
                                            feature
                                        )}
                                    </li>
                                ))}
                            </ul>

                            <Button
                                asChild
                                variant={tier.highlight ? 'default' : 'outline'}
                                className={`mt-8 w-full rounded-2xl h-12 text-base font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]
                                    ${tier.theme === 'emerald' ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-0' : ''}
                                    ${tier.theme === 'zinc' ? 'hover:bg-muted font-medium' : ''}
                                    ${tier.highlight ? 'shadow-primary/30' : ''}
                                `}
                            >
                                <Link to={tier.ctaLink} onClick={() => onCtaClick(tier.ctaName)}>
                                    {tier.ctaText}
                                </Link>
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
