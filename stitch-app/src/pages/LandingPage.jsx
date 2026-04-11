import { useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { capturePostHogEvent } from '../lib/posthog';
import { normalizeTopUpOptions } from '../lib/pricingCurrency';
import { HeroSection } from '../components/blocks/hero-section';
import { SchoolsMarquee } from '../components/blocks/schools-marquee';
import { StatsBar } from '../components/blocks/stats-bar';
import { Features } from '../components/blocks/features-6';
import { CommunitySection } from '../components/blocks/community-section';
import { TestimonialsSection } from '../components/blocks/testimonials-section';
import { PricingSection } from '../components/blocks/pricing-section';
import { Footer } from '../components/blocks/footer';

const LandingPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const pricing = useQuery(api.subscriptions.getPublicTopUpPricing, {});
    const topUpOptions = useMemo(
        () => normalizeTopUpOptions(pricing?.topUpOptions),
        [pricing?.topUpOptions]
    );
    const starterPlan = topUpOptions.find((plan) => plan.id === 'starter') || topUpOptions[0] || {
        id: 'starter',
        amountMajor: 20,
        credits: 5,
        currency: 'GHS',
    };
    const maxPlan = topUpOptions.find((plan) => plan.id === 'max') || topUpOptions[topUpOptions.length - 1] || {
        id: 'max',
        amountMajor: 40,
        credits: 12,
        currency: starterPlan.currency || 'GHS',
    };
    const semesterPlan = topUpOptions.find((plan) => plan.id === 'semester') || {
        id: 'semester',
        amountMajor: 60,
        credits: 20,
        currency: starterPlan.currency || 'GHS',
        validityDays: 120,
        unlimitedAiChat: true,
    };

    const captureLandingEvent = (ctaName, properties = {}) => {
        capturePostHogEvent('landing_cta_clicked', {
            page: 'landing',
            pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
            cta_name: ctaName,
            ...properties,
        });
    };

    useEffect(() => {
        if (user) navigate('/dashboard', { replace: true });
    }, [user, navigate]);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <HeroSection onCtaClick={captureLandingEvent} />
            <SchoolsMarquee />
            <StatsBar />
            <Features />
            <CommunitySection onCtaClick={captureLandingEvent} />
            <TestimonialsSection />
            <PricingSection
                starterPlan={starterPlan}
                maxPlan={maxPlan}
                semesterPlan={semesterPlan}
                onCtaClick={captureLandingEvent}
            />
            <Footer onCtaClick={captureLandingEvent} />
        </div>
    );
};

export default LandingPage;
