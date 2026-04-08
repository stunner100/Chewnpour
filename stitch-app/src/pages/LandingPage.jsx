import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HeroSection } from '../components/blocks/hero-section';
import { SchoolsMarquee } from '../components/blocks/schools-marquee';
import { Features } from '../components/blocks/features-6';
import { CommunitySection } from '../components/blocks/community-section';
import { TestimonialsSection } from '../components/blocks/testimonials-section';
import { PricingSection } from '../components/blocks/pricing-section';
import { Footer } from '../components/blocks/footer';

const LandingPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) navigate('/dashboard', { replace: true });
    }, [user, navigate]);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <HeroSection />
            <SchoolsMarquee />
            <Features />
            <CommunitySection />
            <TestimonialsSection />
            <PricingSection />
            <Footer />
        </div>
    );
};

export default LandingPage;
