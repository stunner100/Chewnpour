import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/BrandLogo';
import { capturePostHogEvent } from '../lib/posthog';
import {
    formatPlanPrice,
    normalizeTopUpOptions,
} from '../lib/pricingCurrency';

const features = [
    {
        title: 'Instant Lessons',
        description: 'Upload any PDF or lecture slide and get structured, easy-to-read lessons generated in seconds.',
        icon: 'menu_book',
    },
    {
        title: 'Smart Quizzes',
        description: 'AI creates practice exams from your material that test what you actually need to know.',
        icon: 'quiz',
    },
    {
        title: 'AI Tutor',
        description: 'Ask questions about your course material and get clear, personalized explanations instantly.',
        icon: 'psychology',
    },
];

const testimonials = [
    {
        name: 'Akosua Mensah',
        university: 'University of Ghana',
        course: 'Biological Sciences',
        quote: 'I uploaded my Biochemistry slides the night before my exam and ChewnPour turned them into clear, structured lessons. I finally understood enzyme kinetics and scored an A. This app is a lifesaver.',
        stars: 5,
        avatarColor: 'bg-primary',
    },
    {
        name: 'Kwame Boateng',
        university: 'KNUST',
        course: 'Mechanical Engineering',
        quote: 'The AI Tutor explained thermodynamics concepts better than any textbook I have read. I use it every single week now and my grades have gone from Cs to Bs consistently.',
        stars: 5,
        avatarColor: 'bg-violet-500',
    },
    {
        name: 'Efua Owusu',
        university: 'University of Cape Coast',
        course: 'Nursing',
        quote: 'The quizzes are so close to what actually comes in exams. I practised with ChewnPour for two weeks and my Anatomy score jumped from 52 to 78. Absolutely worth it.',
        stars: 5,
        avatarColor: 'bg-emerald-500',
    },
    {
        name: 'Yaw Asante',
        university: 'Ashesi University',
        course: 'Computer Science',
        quote: 'I was struggling with Data Structures until I started uploading my lecture notes here. The lessons break everything down step by step. It is like having a personal tutor available 24/7.',
        stars: 4,
        avatarColor: 'bg-amber-500',
    },
    {
        name: 'Abena Darko',
        university: 'University of Ghana',
        course: 'Political Science',
        quote: 'My friends thought I was joking when I said an app helped me study. Now the whole study group uses ChewnPour before every test. The AI-generated questions are spot on.',
        stars: 5,
        avatarColor: 'bg-rose-500',
    },
    {
        name: 'Kofi Agyeman',
        university: 'KNUST',
        course: 'Pharmacy',
        quote: 'Pharmacology has so much content to memorise. ChewnPour organises everything and the quizzes help me figure out what I actually know vs what I just think I know.',
        stars: 4,
        avatarColor: 'bg-cyan-500',
    },
];

const stats = [
    { value: '10,000+', label: 'Documents processed' },
    { value: '50,000+', label: 'Lessons generated' },
    { value: '200,000+', label: 'Quiz questions created' },
];

const LandingPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

    const captureLandingEvent = (eventName, properties = {}) => {
        capturePostHogEvent(eventName, {
            page: 'landing',
            pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
            ...properties,
        });
    };

    useEffect(() => {
        let ticking = false;
        let frameId = null;
        const handleScroll = () => {
            if (!ticking) {
                frameId = window.requestAnimationFrame(() => {
                    setScrolled(window.scrollY > 20);
                    ticking = false;
                    frameId = null;
                });
                ticking = true;
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
        };
    }, []);

    useEffect(() => {
        if (mobileMenuOpen) setMobileMenuOpen(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scrolled]);

    useEffect(() => {
        if (user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate]);

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark selection:bg-primary/20">

            {/* Header */}
            <header
                className={`fixed top-0 z-50 w-full transition-all duration-300 ${scrolled
                    ? 'bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-xl border-b border-border-light dark:border-border-dark py-3'
                    : 'bg-transparent py-5'
                    }`}
            >
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 lg:px-8">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2.5">
                        <BrandLogo className="h-10 w-auto" />
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-8 text-body-sm font-semibold text-text-faint-light dark:text-text-faint-dark">
                        <a href="#features" className="hover:text-text-main-light dark:hover:text-text-main-dark transition-colors">Features</a>
                        <a href="#pricing" className="hover:text-text-main-light dark:hover:text-text-main-dark transition-colors">Pricing</a>
                    </nav>

                    {/* Desktop Actions */}
                    <div className="hidden md:flex items-center gap-3">
                        <Link
                            to="/login"
                            onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'header_login' })}
                            className="px-4 py-2 text-body-sm font-semibold text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark transition-colors"
                        >
                            Log in
                        </Link>
                        <Link
                            to="/signup"
                            onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'header_get_started' })}
                            className="btn-primary px-5 py-2.5 text-body-sm"
                        >
                            Get Started
                        </Link>
                    </div>

                    {/* Mobile Hamburger */}
                    <button
                        onClick={() => setMobileMenuOpen((o) => !o)}
                        className="md:hidden btn-icon w-10 h-10"
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                    >
                        <span className="material-symbols-outlined text-[22px]">
                            {mobileMenuOpen ? 'close' : 'menu'}
                        </span>
                    </button>
                </div>

                {/* Mobile Drawer */}
                <div
                    className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'max-h-[320px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                    <div className="bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-xl border-t border-border-light dark:border-border-dark px-6 pt-4 pb-6">
                        <nav className="flex flex-col gap-1 mb-5">
                            {[
                                { label: 'Features', href: '#features' },
                                { label: 'Pricing', href: '#pricing' },
                            ].map(({ label, href }) => (
                                <a
                                    key={href}
                                    href={href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="py-3 text-body-base font-semibold text-text-main-light dark:text-text-main-dark hover:text-primary transition-colors"
                                >
                                    {label}
                                </a>
                            ))}
                        </nav>
                        <div className="flex flex-col gap-3">
                            <Link
                                to="/login"
                                onClick={() => {
                                    setMobileMenuOpen(false);
                                    captureLandingEvent('landing_cta_clicked', { cta_name: 'mobile_menu_login' });
                                }}
                                className="btn-secondary flex items-center justify-center w-full py-3 text-body-sm"
                            >
                                Log in
                            </Link>
                            <Link
                                to="/signup"
                                onClick={() => {
                                    setMobileMenuOpen(false);
                                    captureLandingEvent('landing_cta_clicked', { cta_name: 'mobile_menu_get_started' });
                                }}
                                className="btn-primary flex items-center justify-center w-full py-3 text-body-sm"
                            >
                                Get Started Free
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative z-10">
                {/* ─── Hero ─── */}
                <section className="mx-auto max-w-6xl px-6 lg:px-8 pt-32 md:pt-40 pb-16 md:pb-24">
                    <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
                        <h1 className="text-display-xl leading-[1.1] tracking-tight text-text-main-light dark:text-text-main-dark mb-5 md:mb-6 animate-fade-in-up">
                            Upload your PDF.{' '}
                            <br className="hidden sm:block" />
                            Get lessons, quizzes, and{' '}
                            <br className="hidden md:block" />
                            <span className="text-primary">an AI tutor</span> in 30 seconds.
                        </h1>
                        <p className="text-body-lg text-text-sub-light dark:text-text-sub-dark leading-relaxed mb-8 md:mb-10 max-w-xl mx-auto animate-fade-in-up animate-delay-100">
                            Built for university students who want to study smarter, not harder.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up animate-delay-200">
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'hero_get_started' })}
                                className="w-full sm:w-auto btn-primary h-12 px-8 text-body-base"
                            >
                                Get Started Free
                            </Link>
                            <a
                                href="#features"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'hero_see_features' })}
                                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-8 text-body-base font-bold text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-all duration-200"
                            >
                                Learn More
                                <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
                            </a>
                        </div>
                    </div>

                    {/* Image Bento Grid */}
                    <div className="mx-auto max-w-5xl mb-20 md:mb-28 animate-fade-in-up animate-delay-300">
                        <div className="grid grid-cols-2 lg:grid-cols-4 grid-rows-4 lg:grid-rows-2 gap-3 md:gap-4 lg:gap-5 h-[600px] lg:h-[480px]">
                            {/* Main large image */}
                            <div className="col-span-2 row-span-2 rounded-[2rem] overflow-hidden shadow-soft hover:shadow-card-hover transition-all duration-300">
                                <img src="/chewnpour/img1.jpg" alt="Students studying together" className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-700" />
                            </div>
                            {/* Top small image */}
                            <div className="col-span-2 lg:col-span-1 row-span-1 rounded-3xl overflow-hidden shadow-soft hover:shadow-card-hover transition-all duration-300">
                                <img src="/chewnpour/img2.jpg" alt="Student smiling" className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-700" />
                            </div>
                            {/* Tall right image */}
                            <div className="hidden lg:block col-span-1 row-span-2 rounded-[2rem] overflow-hidden shadow-soft hover:shadow-card-hover transition-all duration-300">
                                <img src="/chewnpour/img3.jpg" alt="Library setup" className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-700" />
                            </div>
                            {/* Bottom small image */}
                            <div className="col-span-2 lg:col-span-1 row-span-1 rounded-3xl overflow-hidden shadow-soft hover:shadow-card-hover transition-all duration-300">
                                <img src="/chewnpour/img4.jpg" alt="Laptop collaboration" className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-700" />
                            </div>
                        </div>
                    </div>

                    {/* Product Flow Mockup — 3 steps */}
                    <div className="animate-fade-in-up animate-delay-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 max-w-4xl mx-auto">
                            {/* Step 1: Upload */}
                            <div className="card-base p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-extrabold">1</div>
                                    <span className="text-overline">Upload</span>
                                </div>
                                <div className="rounded-xl border-2 border-dashed border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark p-4 flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-red-500 text-[24px]">picture_as_pdf</span>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark truncate">Organic_Chemistry_Ch4.pdf</p>
                                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark">2.4 MB</p>
                                    </div>
                                    <div className="w-full h-1.5 bg-border-light dark:bg-border-dark rounded-full overflow-hidden">
                                        <div className="h-full w-full bg-primary rounded-full" />
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Lessons */}
                            <div className="card-base p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-emerald/10 text-accent-emerald text-xs font-extrabold">2</div>
                                    <span className="text-overline">Learn</span>
                                </div>
                                <div className="space-y-2.5">
                                    {[
                                        { title: 'Alkene Reactions', progress: 85, color: 'bg-primary' },
                                        { title: 'Stereochemistry', progress: 60, color: 'bg-cyan-500' },
                                        { title: 'Spectroscopy', progress: 30, color: 'bg-accent-amber' },
                                    ].map((topic) => (
                                        <div key={topic.title} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-caption font-semibold text-text-main-light dark:text-text-main-dark truncate">{topic.title}</p>
                                                <div className="mt-1.5 h-1 bg-border-light dark:bg-border-dark rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${topic.color}`} style={{ width: `${topic.progress}%` }} />
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-text-faint-light dark:text-text-faint-dark tabular-nums">{topic.progress}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Step 3: AI Tutor */}
                            <div className="card-base p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-extrabold">3</div>
                                    <span className="text-overline">Ask</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-end">
                                        <div className="bg-primary text-white px-3.5 py-2 rounded-2xl rounded-br-md text-caption leading-relaxed max-w-[85%]">
                                            Explain SN1 vs SN2 reactions simply?
                                        </div>
                                    </div>
                                    <div className="flex justify-start">
                                        <div className="bg-surface-hover-light dark:bg-surface-hover-dark text-text-main-light dark:text-text-main-dark px-3.5 py-2 rounded-2xl rounded-bl-md text-caption leading-relaxed max-w-[85%]">
                                            <span className="font-bold text-primary text-[10px] block mb-1">ChewnPour AI</span>
                                            Think of SN1 as a two-step dance — the leaving group exits first, then the nucleophile joins. SN2 is a one-step swap...
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Connecting arrows (desktop only) */}
                        <div className="hidden md:flex items-center justify-center gap-0 mt-[-180px] mb-[100px] pointer-events-none relative z-10">
                            <div className="w-1/3" />
                            <span className="material-symbols-outlined text-text-faint-light dark:text-text-faint-dark text-[20px]">arrow_forward</span>
                            <div className="w-1/3" />
                            <span className="material-symbols-outlined text-text-faint-light dark:text-text-faint-dark text-[20px]">arrow_forward</span>
                            <div className="w-1/3" />
                        </div>
                    </div>
                </section>

                {/* ─── Stats Bar ─── */}
                <section className="border-y border-border-light dark:border-border-dark bg-surface-light/50 dark:bg-surface-dark/50">
                    <div className="mx-auto max-w-6xl px-6 lg:px-8 py-10 md:py-12">
                        <div className="grid grid-cols-3 gap-6 md:gap-12 text-center">
                            {stats.map((stat) => (
                                <div key={stat.label}>
                                    <div className="text-display-sm text-text-main-light dark:text-text-main-dark tracking-tight">{stat.value}</div>
                                    <div className="text-overline mt-1">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── Features ─── */}
                <section id="features" className="mx-auto max-w-6xl px-6 lg:px-8 py-20 md:py-28">
                    <div className="text-center mb-12 md:mb-16">
                        <h2 className="text-display-lg text-text-main-light dark:text-text-main-dark mb-3">
                            Everything you need to ace your courses
                        </h2>
                        <p className="text-text-faint-light dark:text-text-faint-dark max-w-lg mx-auto text-body-sm">
                            Powerful tools that turn your course material into an interactive study experience.
                        </p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-3">
                        {features.map((feature) => (
                            <div
                                key={feature.title}
                                className="card-interactive p-6 md:p-8"
                            >
                                <div className="h-12 w-12 rounded-xl bg-primary/8 flex items-center justify-center mb-5 group-hover:bg-primary/12 transition-colors">
                                    <span className="material-symbols-outlined text-primary text-[24px]">{feature.icon}</span>
                                </div>
                                <h3 className="text-body-lg font-bold text-text-main-light dark:text-text-main-dark mb-2">{feature.title}</h3>
                                <p className="text-body-sm text-text-faint-light dark:text-text-faint-dark leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ─── Testimonials ─── */}
                <section className="border-y border-border-light dark:border-border-dark bg-surface-light/50 dark:bg-surface-dark/50">
                    <div className="mx-auto max-w-6xl px-6 lg:px-8 py-20 md:py-28">
                        <div className="text-center mb-12 md:mb-16">
                            <h2 className="text-display-lg text-text-main-light dark:text-text-main-dark mb-3">
                                Loved by Students Across Africa
                            </h2>
                            <p className="text-text-faint-light dark:text-text-faint-dark max-w-lg mx-auto text-body-sm">
                                Thousands of students are studying smarter with ChewnPour. Here is what they have to say.
                            </p>
                        </div>
                        <div className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
                            {testimonials.map((t) => (
                                <div
                                    key={t.name}
                                    className="card-base flex flex-col p-6 md:p-7"
                                >
                                    <div className="flex items-center gap-1 mb-3">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <span
                                                key={i}
                                                className={`material-symbols-outlined filled text-[16px] ${i < t.stars
                                                        ? 'text-accent-amber'
                                                        : 'text-border-light dark:text-border-dark'
                                                    }`}
                                            >
                                                star
                                            </span>
                                        ))}
                                    </div>
                                    <p className="flex-1 text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed mb-5">
                                        &ldquo;{t.quote}&rdquo;
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-body-sm font-bold text-white flex-shrink-0 ${t.avatarColor}`}>
                                            {t.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-body-sm font-bold text-text-main-light dark:text-text-main-dark">{t.name}</p>
                                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                                {t.course} &middot; {t.university}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── Pricing ─── */}
                <section id="pricing" className="mx-auto max-w-6xl px-6 lg:px-8 py-20 md:py-28">
                    <div className="text-center mb-12 md:mb-16">
                        <h2 className="text-display-lg text-text-main-light dark:text-text-main-dark mb-3">
                            Simple pricing
                        </h2>
                        <p className="text-text-faint-light dark:text-text-faint-dark max-w-md mx-auto text-body-sm">
                            Start with 3 free uploads. Upgrade when you need more.
                        </p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto pt-5">
                        {/* Free Plan */}
                        <div className="card-base flex flex-col p-6 md:p-7">
                            <div className="mb-5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-overline bg-surface-hover-light dark:bg-surface-hover-dark text-text-faint-light dark:text-text-faint-dark mb-3">Free</span>
                                <div className="flex items-baseline gap-1 flex-wrap">
                                    <span className="text-display-sm text-text-main-light dark:text-text-main-dark">
                                        {formatPlanPrice(0, starterPlan.currency)}
                                    </span>
                                    <span className="text-text-faint-light dark:text-text-faint-dark text-body-sm font-medium">/forever</span>
                                </div>
                            </div>
                            <ul className="flex-1 space-y-3 mb-7">
                                {[
                                    '3 document uploads',
                                    'AI-powered lessons',
                                    'Interactive quizzes',
                                    'AI Tutor chat',
                                    'Progress tracking',
                                ].map((item) => (
                                    <li key={item} className="flex items-center gap-2.5 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                        <span className="material-symbols-outlined text-accent-emerald text-[16px] flex-shrink-0">check_circle</span>
                                        <span className="break-words">{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'pricing_free' })}
                                className="btn-secondary w-full h-11 text-body-sm"
                            >
                                Get Started Free
                            </Link>
                        </div>

                        {/* Starter Top-up */}
                        <div className="card-base relative flex flex-col p-6 md:p-7">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <span className="px-3 py-1 bg-accent-amber text-white text-[10px] font-bold uppercase tracking-widest rounded-full whitespace-nowrap">First purchase {formatPlanPrice(15, starterPlan.currency || 'GHS')}</span>
                            </div>
                            <div className="mb-5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-overline bg-primary/8 text-primary mb-3">Starter</span>
                                <div className="flex items-baseline gap-1 flex-wrap">
                                    <span className="text-display-sm text-text-main-light dark:text-text-main-dark">
                                        {formatPlanPrice(starterPlan.amountMajor, starterPlan.currency)}
                                    </span>
                                    <span className="text-text-faint-light dark:text-text-faint-dark text-body-sm font-medium">/top-up</span>
                                </div>
                                <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-1.5">
                                    {formatPlanPrice(starterPlan.amountMajor / starterPlan.credits, starterPlan.currency)} per upload
                                </p>
                            </div>
                            <ul className="flex-1 space-y-3 mb-7">
                                {[
                                    `+${starterPlan.credits} uploads`,
                                    'Everything in Free',
                                    'Priority AI processing',
                                    'Assignment Helper',
                                    'AI Humanizer tool',
                                    'Premium support',
                                ].map((item) => (
                                    <li key={item} className="flex items-center gap-2.5 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                        <span className="material-symbols-outlined text-primary text-[16px] flex-shrink-0">check_circle</span>
                                        <span className="break-words">{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'pricing_starter' })}
                                className="btn-secondary w-full h-11 text-body-sm"
                            >
                                Choose Starter
                            </Link>
                        </div>

                        {/* Max Top-up */}
                        <div className="relative flex flex-col p-6 md:p-7 rounded-2xl bg-surface-light dark:bg-surface-dark border-2 border-primary/30">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <span className="px-3 py-1 bg-primary text-white text-[10px] font-bold uppercase tracking-widest rounded-full whitespace-nowrap">Popular</span>
                            </div>
                            <div className="mb-5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-overline bg-primary/8 text-primary mb-3">Max</span>
                                <div className="flex items-baseline gap-1 flex-wrap">
                                    <span className="text-display-sm text-text-main-light dark:text-text-main-dark">
                                        {formatPlanPrice(maxPlan.amountMajor, maxPlan.currency)}
                                    </span>
                                    <span className="text-text-faint-light dark:text-text-faint-dark text-body-sm font-medium">/top-up</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                        {formatPlanPrice(maxPlan.amountMajor / maxPlan.credits, maxPlan.currency)} per upload
                                    </span>
                                    {starterPlan.credits > 0 && maxPlan.credits > 0 && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-emerald/10 text-accent-emerald whitespace-nowrap">
                                            Save {Math.round((1 - (maxPlan.amountMajor / maxPlan.credits) / (starterPlan.amountMajor / starterPlan.credits)) * 100)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <ul className="flex-1 space-y-3 mb-7">
                                {[
                                    `+${maxPlan.credits} uploads`,
                                    'Everything in Free',
                                    'Priority AI processing',
                                    'Assignment Helper',
                                    'AI Humanizer tool',
                                    'Premium support',
                                ].map((item) => (
                                    <li key={item} className="flex items-center gap-2.5 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                        <span className="material-symbols-outlined text-primary text-[16px] flex-shrink-0">check_circle</span>
                                        <span className="break-words">{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'pricing_max' })}
                                className="btn-primary w-full h-11 text-body-sm"
                            >
                                Choose Max
                            </Link>
                        </div>

                        {/* Semester Pass */}
                        <div className="relative flex flex-col p-6 md:p-7 rounded-2xl bg-accent-emerald/5 dark:bg-accent-emerald/5 border-2 border-accent-emerald/30">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <span className="px-3 py-1 bg-accent-emerald text-white text-[10px] font-bold uppercase tracking-widest rounded-full whitespace-nowrap">Best Value</span>
                            </div>
                            <div className="mb-5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-overline bg-accent-emerald/10 text-accent-emerald mb-3">Semester Pass</span>
                                <div className="flex items-baseline gap-1 flex-wrap">
                                    <span className="text-display-sm text-text-main-light dark:text-text-main-dark">
                                        {formatPlanPrice(semesterPlan.amountMajor, semesterPlan.currency)}
                                    </span>
                                    <span className="text-text-faint-light dark:text-text-faint-dark text-body-sm font-medium">/semester</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="text-caption text-accent-emerald font-semibold">
                                        {formatPlanPrice(semesterPlan.amountMajor / semesterPlan.credits, semesterPlan.currency)}/upload
                                    </span>
                                    {starterPlan.credits > 0 && semesterPlan.credits > 0 && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-emerald/10 text-accent-emerald whitespace-nowrap">
                                            Save {Math.round((1 - (semesterPlan.amountMajor / semesterPlan.credits) / (starterPlan.amountMajor / starterPlan.credits)) * 100)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <ul className="flex-1 space-y-3 mb-7">
                                {[
                                    `+${semesterPlan.credits} uploads`,
                                    'Unlimited AI chat messages',
                                    'Everything in Free',
                                    'Priority AI processing',
                                    'Assignment Helper',
                                    'AI Humanizer tool',
                                    'Valid for ~4 months',
                                ].map((item) => (
                                    <li key={item} className="flex items-center gap-2.5 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                        <span className="material-symbols-outlined text-accent-emerald text-[16px] flex-shrink-0">check_circle</span>
                                        <span className={`break-words ${item.includes('Unlimited') ? 'font-semibold text-accent-emerald' : ''}`}>
                                            {item}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'pricing_semester' })}
                                className="w-full inline-flex h-11 items-center justify-center rounded-xl bg-accent-emerald text-body-sm font-bold text-white hover:bg-emerald-600 active:scale-[0.98] transition-all duration-200"
                            >
                                Get Semester Pass
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* ─── Footer ─── */}
            <footer className="border-t border-border-light dark:border-border-dark bg-surface-light/50 dark:bg-surface-dark/50 py-10">
                <div className="mx-auto max-w-6xl px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-2.5">
                            <BrandLogo className="h-10 w-auto" />
                        </div>
                        <div className="flex items-center gap-5 text-body-sm">
                            <a
                                href="https://t.me/+jIHi6XFYdl9kNDA0"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-text-faint-light dark:text-text-faint-dark hover:text-primary transition-colors"
                            >
                                Telegram
                            </a>
                            <a
                                href="mailto:info@chewnpour.com"
                                className="font-semibold text-text-faint-light dark:text-text-faint-dark hover:text-primary transition-colors"
                            >
                                Email
                            </a>
                            <a href="#pricing" className="font-semibold text-text-faint-light dark:text-text-faint-dark hover:text-primary transition-colors">
                                Pricing
                            </a>
                        </div>
                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark">© 2026 ChewnPour</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
