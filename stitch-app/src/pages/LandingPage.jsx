import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
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
        <div className="relative min-h-screen overflow-x-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-display selection:bg-primary/20">
            {/* Subtle warm background mesh */}
            <div className="pointer-events-none fixed inset-0 z-0 bg-mesh-light dark:bg-mesh-dark opacity-60" />

            {/* Header */}
            <header
                className={`fixed top-0 z-50 w-full transition-all duration-300 ${scrolled
                    ? 'bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200/60 dark:border-neutral-800/60 py-3 shadow-soft'
                    : 'bg-transparent py-5'
                    }`}
            >
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 lg:px-8">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20">
                            <span className="material-symbols-outlined text-[18px] filled text-white">auto_awesome</span>
                        </div>
                        <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">ChewnPour</span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-8 text-[13px] font-semibold text-neutral-500 dark:text-neutral-400">
                        <a href="#features" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Features</a>
                        <a href="#pricing" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Pricing</a>
                    </nav>

                    {/* Desktop Actions */}
                    <div className="hidden md:flex items-center gap-3">
                        <Link
                            to="/login"
                            onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'header_login' })}
                            className="px-4 py-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors"
                        >
                            Log in
                        </Link>
                        <Link
                            to="/signup"
                            onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'header_get_started' })}
                            className="inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-button hover:bg-primary-hover hover:shadow-button-hover hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                        >
                            Get Started
                        </Link>
                    </div>

                    {/* Mobile Hamburger */}
                    <button
                        onClick={() => setMobileMenuOpen((o) => !o)}
                        className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
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
                    <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-t border-neutral-200/60 dark:border-neutral-800/60 px-6 pt-4 pb-6">
                        <nav className="flex flex-col gap-1 mb-5">
                            {[
                                { label: 'Features', href: '#features' },
                                { label: 'Pricing', href: '#pricing' },
                            ].map(({ label, href }) => (
                                <a
                                    key={href}
                                    href={href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="py-3 text-base font-semibold text-neutral-700 dark:text-neutral-200 hover:text-primary transition-colors"
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
                                className="flex items-center justify-center w-full py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm font-bold text-neutral-700 dark:text-neutral-200 hover:border-primary/30 transition-colors active:scale-[0.98]"
                            >
                                Log in
                            </Link>
                            <Link
                                to="/signup"
                                onClick={() => {
                                    setMobileMenuOpen(false);
                                    captureLandingEvent('landing_cta_clicked', { cta_name: 'mobile_menu_get_started' });
                                }}
                                className="flex items-center justify-center w-full py-3 rounded-xl bg-primary text-sm font-bold text-white shadow-button hover:bg-primary-hover transition-colors active:scale-[0.98]"
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
                        <h1 className="text-[2rem] sm:text-4xl md:text-[3.5rem] font-extrabold leading-[1.1] tracking-tight text-neutral-900 dark:text-white mb-5 md:mb-6 animate-fade-in-up">
                            Upload your PDF.{' '}
                            <br className="hidden sm:block" />
                            Get lessons, quizzes, and{' '}
                            <br className="hidden md:block" />
                            <span className="text-primary">an AI tutor</span> in 30 seconds.
                        </h1>
                        <p className="text-base md:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed mb-8 md:mb-10 max-w-xl mx-auto animate-fade-in-up animate-delay-100">
                            Built for university students who want to study smarter, not harder.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up animate-delay-200">
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'hero_get_started' })}
                                className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-8 text-base font-bold text-white shadow-button hover:bg-primary-hover hover:shadow-button-hover hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                            >
                                Get Started Free
                            </Link>
                            <a
                                href="#features"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'hero_see_features' })}
                                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-8 text-base font-bold text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200"
                            >
                                Learn More
                                <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
                            </a>
                        </div>
                    </div>

                    {/* Product Flow Mockup — 3 steps */}
                    <div className="animate-fade-in-up animate-delay-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 max-w-4xl mx-auto">
                            {/* Step 1: Upload */}
                            <div className="relative bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-card">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-extrabold">1</div>
                                    <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Upload</span>
                                </div>
                                <div className="rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4 flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-red-500 text-[24px]">picture_as_pdf</span>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 truncate">Organic_Chemistry_Ch4.pdf</p>
                                        <p className="text-[11px] text-neutral-400">2.4 MB</p>
                                    </div>
                                    <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                                        <div className="h-full w-full bg-primary rounded-full" />
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Lessons */}
                            <div className="relative bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-card">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold">2</div>
                                    <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Learn</span>
                                </div>
                                <div className="space-y-2.5">
                                    {[
                                        { title: 'Alkene Reactions', progress: 85, color: 'bg-primary' },
                                        { title: 'Stereochemistry', progress: 60, color: 'bg-cyan-500' },
                                        { title: 'Spectroscopy', progress: 30, color: 'bg-amber-500' },
                                    ].map((topic) => (
                                        <div key={topic.title} className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 truncate">{topic.title}</p>
                                                <div className="mt-1.5 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${topic.color}`} style={{ width: `${topic.progress}%` }} />
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-neutral-400 tabular-nums">{topic.progress}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Step 3: AI Tutor */}
                            <div className="relative bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-card">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-extrabold">3</div>
                                    <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Ask</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-end">
                                        <div className="bg-primary text-white px-3.5 py-2 rounded-2xl rounded-br-md text-xs leading-relaxed max-w-[85%]">
                                            Explain SN1 vs SN2 reactions simply?
                                        </div>
                                    </div>
                                    <div className="flex justify-start">
                                        <div className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 px-3.5 py-2 rounded-2xl rounded-bl-md text-xs leading-relaxed max-w-[85%]">
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
                            <span className="material-symbols-outlined text-neutral-300 dark:text-neutral-600 text-[20px]">arrow_forward</span>
                            <div className="w-1/3" />
                            <span className="material-symbols-outlined text-neutral-300 dark:text-neutral-600 text-[20px]">arrow_forward</span>
                            <div className="w-1/3" />
                        </div>
                    </div>
                </section>

                {/* ─── Stats Bar ─── */}
                <section className="border-y border-neutral-200/60 dark:border-neutral-800/60 bg-white/50 dark:bg-neutral-900/50">
                    <div className="mx-auto max-w-6xl px-6 lg:px-8 py-10 md:py-12">
                        <div className="grid grid-cols-3 gap-6 md:gap-12 text-center">
                            {stats.map((stat) => (
                                <div key={stat.label}>
                                    <div className="text-2xl md:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">{stat.value}</div>
                                    <div className="text-[11px] md:text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mt-1">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── Features ─── */}
                <section id="features" className="mx-auto max-w-6xl px-6 lg:px-8 py-20 md:py-28">
                    <div className="text-center mb-12 md:mb-16">
                        <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-3">
                            Everything you need to ace your courses
                        </h2>
                        <p className="text-neutral-500 dark:text-neutral-400 max-w-lg mx-auto text-sm md:text-base">
                            Powerful tools that turn your course material into an interactive study experience.
                        </p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-3">
                        {features.map((feature) => (
                            <div
                                key={feature.title}
                                className="group p-6 md:p-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300"
                            >
                                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                                    <span className="material-symbols-outlined text-primary text-[24px]">{feature.icon}</span>
                                </div>
                                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">{feature.title}</h3>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ─── Testimonials ─── */}
                <section className="border-y border-neutral-200/60 dark:border-neutral-800/60 bg-white/50 dark:bg-neutral-900/50">
                    <div className="mx-auto max-w-6xl px-6 lg:px-8 py-20 md:py-28">
                        <div className="text-center mb-12 md:mb-16">
                            <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-3">
                                Loved by Students Across Ghana
                            </h2>
                            <p className="text-neutral-500 dark:text-neutral-400 max-w-lg mx-auto text-sm md:text-base">
                                Thousands of students are studying smarter with ChewnPour. Here is what they have to say.
                            </p>
                        </div>
                        <div className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
                            {testimonials.map((t) => (
                                <div
                                    key={t.name}
                                    className="flex flex-col p-6 md:p-7 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-800 shadow-card"
                                >
                                    <div className="flex items-center gap-1 mb-3">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <span
                                                key={i}
                                                className={`material-symbols-outlined filled text-[16px] ${
                                                    i < t.stars
                                                        ? 'text-amber-400'
                                                        : 'text-neutral-200 dark:text-neutral-700'
                                                }`}
                                            >
                                                star
                                            </span>
                                        ))}
                                    </div>
                                    <p className="flex-1 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-5">
                                        &ldquo;{t.quote}&rdquo;
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${t.avatarColor}`}>
                                            {t.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-neutral-900 dark:text-white">{t.name}</p>
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
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
                        <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-3">
                            Simple pricing
                        </h2>
                        <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto text-sm md:text-base">
                            Start free. Upgrade when you need more uploads.
                        </p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto pt-5">
                        {/* Free Plan */}
                        <div className="flex flex-col p-7 md:p-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-card">
                            <div className="mb-5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 mb-3">Free</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-extrabold text-neutral-900 dark:text-white">
                                        {formatPlanPrice(0, starterPlan.currency)}
                                    </span>
                                    <span className="text-neutral-400 text-sm font-medium">/forever</span>
                                </div>
                            </div>
                            <ul className="flex-1 space-y-3 mb-7">
                                {[
                                    '1 document upload',
                                    'AI-powered lessons',
                                    'Interactive quizzes',
                                    'AI Tutor chat',
                                    'Progress tracking',
                                ].map((item) => (
                                    <li key={item} className="flex items-center gap-2.5 text-sm text-neutral-600 dark:text-neutral-300">
                                        <span className="material-symbols-outlined text-emerald-500 text-[16px]">check_circle</span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'pricing_free' })}
                                className="w-full inline-flex h-11 items-center justify-center rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm font-bold text-neutral-700 dark:text-neutral-200 hover:border-primary/30 hover:shadow-card-hover transition-all active:scale-[0.98]"
                            >
                                Get Started Free
                            </Link>
                        </div>

                        {/* Starter Top-up */}
                        <div className="flex flex-col p-7 md:p-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-card">
                            <div className="mb-5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-primary/10 text-primary mb-3">Starter</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-extrabold text-neutral-900 dark:text-white">
                                        {formatPlanPrice(starterPlan.amountMajor, starterPlan.currency)}
                                    </span>
                                    <span className="text-neutral-400 text-sm font-medium">/top-up</span>
                                </div>
                                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5">
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
                                    <li key={item} className="flex items-center gap-2.5 text-sm text-neutral-600 dark:text-neutral-300">
                                        <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'pricing_starter' })}
                                className="w-full inline-flex h-11 items-center justify-center rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm font-bold text-neutral-700 dark:text-neutral-200 hover:border-primary/30 hover:shadow-card-hover transition-all active:scale-[0.98]"
                            >
                                Choose Starter
                            </Link>
                        </div>

                        {/* Max Top-up */}
                        <div className="relative flex flex-col p-7 md:p-8 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-primary/30 shadow-card">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <span className="px-3 py-1 bg-primary text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-button">Popular</span>
                            </div>
                            <div className="mb-5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-primary/10 text-primary mb-3">Max</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-extrabold text-neutral-900 dark:text-white">
                                        {formatPlanPrice(maxPlan.amountMajor, maxPlan.currency)}
                                    </span>
                                    <span className="text-neutral-400 text-sm font-medium">/top-up</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                                        {formatPlanPrice(maxPlan.amountMajor / maxPlan.credits, maxPlan.currency)} per upload
                                    </span>
                                    {starterPlan.credits > 0 && maxPlan.credits > 0 && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
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
                                    <li key={item} className="flex items-center gap-2.5 text-sm text-neutral-600 dark:text-neutral-300">
                                        <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'pricing_max' })}
                                className="w-full inline-flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-button hover:bg-primary-hover hover:shadow-button-hover hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                            >
                                Choose Max
                            </Link>
                        </div>

                        {/* Semester Pass */}
                        <div className="relative flex flex-col p-7 md:p-8 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border-2 border-emerald-400/50 dark:border-emerald-500/30 shadow-card">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <span className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-sm">Best Value</span>
                            </div>
                            <div className="mb-5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3">Semester Pass</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-extrabold text-neutral-900 dark:text-white">
                                        {formatPlanPrice(semesterPlan.amountMajor, semesterPlan.currency)}
                                    </span>
                                    <span className="text-neutral-400 text-sm font-medium">/semester</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                                        {formatPlanPrice(semesterPlan.amountMajor / semesterPlan.credits, semesterPlan.currency)}/upload
                                    </span>
                                    {starterPlan.credits > 0 && semesterPlan.credits > 0 && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
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
                                    <li key={item} className="flex items-center gap-2.5 text-sm text-neutral-600 dark:text-neutral-300">
                                        <span className={`material-symbols-outlined text-[16px] ${item.includes('Unlimited') ? 'text-emerald-500' : 'text-emerald-500'}`}>check_circle</span>
                                        <span className={item.includes('Unlimited') ? 'font-semibold text-emerald-700 dark:text-emerald-300' : ''}>
                                            {item}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'pricing_semester' })}
                                className="w-full inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 hover:shadow-xl hover:shadow-emerald-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                            >
                                Get Semester Pass
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* ─── Footer ─── */}
            <footer className="border-t border-neutral-200/60 dark:border-neutral-800/60 bg-white/50 dark:bg-neutral-900/50 py-10">
                <div className="mx-auto max-w-6xl px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white shadow-sm">
                                <span className="material-symbols-outlined text-[16px] filled">auto_awesome</span>
                            </div>
                            <span className="text-sm font-bold text-neutral-900 dark:text-white">ChewnPour</span>
                        </div>
                        <div className="flex items-center gap-5 text-sm">
                            <a
                                href="https://t.me/+jIHi6XFYdl9kNDA0"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-neutral-500 dark:text-neutral-400 hover:text-primary transition-colors"
                            >
                                Telegram
                            </a>
                            <a
                                href="mailto:info@chewnpour.com"
                                className="font-semibold text-neutral-500 dark:text-neutral-400 hover:text-primary transition-colors"
                            >
                                Email
                            </a>
                            <a href="#pricing" className="font-semibold text-neutral-500 dark:text-neutral-400 hover:text-primary transition-colors">
                                Pricing
                            </a>
                        </div>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500">© 2026 ChewnPour</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
