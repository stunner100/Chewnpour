import React from 'react';
import { Button } from '../ui/button';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';

const pricingTiers = [
    {
        name: 'Free',
        badge: null,
        price: '0.00',
        period: '/forever',
        subtext: 'Get started with no risk',
        features: [
            '3 document uploads',
            'AI-powered lessons',
            'Interactive quizzes',
            'AI Tutor chat',
            'Progress tracking',
        ],
        ctaText: 'Get Started Free',
        ctaLink: '/signup',
        highlight: false,
        theme: 'zinc'
    },
    {
        name: 'Starter',
        badge: 'FIRST PURCHASE GHS 15.00',
        price: '20.00',
        period: '/top-up',
        subtext: 'GHS 4.00 per upload',
        features: [
            '+5 uploads',
            'Everything in Free',
            'Priority AI processing',
            'Assignment Helper',
            'AI Humanizer tool',
            'Premium support',
        ],
        ctaText: 'Choose Starter',
        ctaLink: '/signup',
        highlight: false,
        theme: 'orange'
    },
    {
        name: 'Max',
        badge: 'POPULAR',
        price: '40.00',
        period: '/top-up',
        subtext: (
            <span className="flex items-center gap-2">
                GHS 3.33 per upload
                <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-md">Save 17%</span>
            </span>
        ),
        features: [
            '+12 uploads',
            'Everything in Free',
            'Priority AI processing',
            'Assignment Helper',
            'AI Humanizer tool',
            'Premium support',
        ],
        ctaText: 'Choose Max',
        ctaLink: '/signup',
        highlight: true,
        theme: 'primary'
    },
    {
        name: 'Semester Pass',
        badge: 'BEST VALUE',
        price: '60.00',
        period: '/semester',
        subtext: (
            <span className="flex items-center gap-2">
                GHS 3.00/upload
                <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-md">Save 25%</span>
            </span>
        ),
        features: [
            '+20 uploads',
            'Unlimited AI chat messages',
            'Everything in Free',
            'Priority AI processing',
            'Assignment Helper',
            'AI Humanizer tool',
            'Valid for ~4 months',
        ],
        ctaText: 'Get Semester Pass',
        ctaLink: '/signup',
        highlight: false,
        theme: 'emerald'
    }
];

export function PricingSection() {
    return (
        <section id="pricing" className="bg-background py-24 sm:py-32 relative overflow-hidden border-t border-border/40">
            {/* Subtle background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-2xl sm:text-center mb-16">
                    <h2 className="text-base font-semibold leading-7 text-primary mb-2">Flexible Pricing</h2>
                    <h3 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl mb-6 font-['Outfit',sans-serif]">
                        Choose the right plan for you
                    </h3>
                    <p className="text-lg leading-8 text-muted-foreground">
                        Affordable study tools designed to fit any student's budget. Upgrade anytime.
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
                                    <span className="text-4xl font-bold tracking-tight text-foreground">
                                        <span className="text-xl mr-1 font-semibold text-muted-foreground">GHS</span>{tier.price}
                                    </span>
                                    <span className="text-sm font-semibold leading-6 text-muted-foreground">{tier.period}</span>
                                </div>
                                <div className="mt-2 text-sm leading-6 text-muted-foreground h-6 flex items-center">{tier.subtext}</div>
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
                                <Link to={tier.ctaLink}>{tier.ctaText}</Link>
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
