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
        title: 'Notes',
        description:
            'Upload any PDF or lecture slide and ChewnPour turns it into structured, easy-to-read lessons in seconds.',
        icon: 'sticky_note_2',
        bg: 'bg-[#E8651B]',
        text: 'text-white',
        rotate: '-rotate-1',
    },
    {
        title: 'Quizzes',
        description:
            "Whether you're preparing for an exam or just testing your knowledge, our AI quizzes reinforce what you actually need to learn.",
        icon: 'fact_check',
        bg: 'bg-[#E5E5E5]',
        text: 'text-[#0A0A0A]',
        rotate: 'rotate-1',
    },
    {
        title: 'Tracker',
        description:
            'Track your progress across every topic with streaks, mastery scores, and weak spots — so you always know what to study next.',
        icon: 'history',
        bg: 'bg-[#F3C64A]',
        text: 'text-[#0A0A0A]',
        rotate: '-rotate-1',
    },
];

const testimonials = [
    {
        name: 'Akosua Mensah',
        university: 'University of Ghana',
        course: 'Biological Sciences',
        quote: 'I uploaded my Biochemistry slides the night before my exam and ChewnPour turned them into clear, structured lessons. I finally understood enzyme kinetics and scored an A. This app is a lifesaver.',
        stars: 5,
        accent: 'bg-[#E8651B]',
    },
    {
        name: 'Kwame Boateng',
        university: 'KNUST',
        course: 'Mechanical Engineering',
        quote: 'The AI Tutor explained thermodynamics concepts better than any textbook I have read. I use it every single week now and my grades have gone from Cs to Bs consistently.',
        stars: 5,
        accent: 'bg-[#B39DFF]',
    },
    {
        name: 'Efua Owusu',
        university: 'University of Cape Coast',
        course: 'Nursing',
        quote: 'The quizzes are so close to what actually comes in exams. I practised with ChewnPour for two weeks and my Anatomy score jumped from 52 to 78. Absolutely worth it.',
        stars: 5,
        accent: 'bg-[#F3C64A]',
    },
    {
        name: 'Yaw Asante',
        university: 'Ashesi University',
        course: 'Computer Science',
        quote: 'I was struggling with Data Structures until I started uploading my lecture notes here. The lessons break everything down step by step. It is like having a personal tutor available 24/7.',
        stars: 4,
        accent: 'bg-[#E5E5E5]',
    },
    {
        name: 'Abena Darko',
        university: 'University of Ghana',
        course: 'Political Science',
        quote: 'My friends thought I was joking when I said an app helped me study. Now the whole study group uses ChewnPour before every test. The AI-generated questions are spot on.',
        stars: 5,
        accent: 'bg-[#E8651B]',
    },
    {
        name: 'Kofi Agyeman',
        university: 'KNUST',
        course: 'Pharmacy',
        quote: 'Pharmacology has so much content to memorise. ChewnPour organises everything and the quizzes help me figure out what I actually know vs what I just think I know.',
        stars: 4,
        accent: 'bg-[#B39DFF]',
    },
];

const stats = [
    { value: '10,000+', label: 'Documents processed' },
    { value: '50,000+', label: 'Lessons generated' },
    { value: '200,000+', label: 'Quiz questions created' },
];

// ChewnPour logo — compact hex-framed "CP" monogram sized to fit the reference's logo slot.
const HexLogo = ({ size = 56, className = '' }) => (
    <span
        className={`inline-flex items-center justify-center relative ${className}`}
        style={{ width: size, height: size }}
        aria-label="ChewnPour"
    >
        <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full"
            fill="none"
            aria-hidden="true"
        >
            <polygon
                points="50,6 90,28 90,72 50,94 10,72 10,28"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinejoin="round"
                fill="none"
            />
            <circle cx="70" cy="34" r="4" fill="#E8651B" />
        </svg>
        <span
            className="relative font-mono font-bold tracking-tight leading-none select-none"
            style={{ fontSize: Math.round(size * 0.38) }}
        >
            CP
        </span>
    </span>
);

// Decorative arrow badge used across the page — mimics the orange circle w/ diagonal arrow in the reference
const ArrowBadge = ({ size = 44, className = '' }) => (
    <span
        className={`inline-flex items-center justify-center rounded-full bg-[#E8651B] text-white shrink-0 ${className}`}
        style={{ width: size, height: size }}
    >
        <span
            className="material-symbols-outlined"
            style={{ fontSize: Math.round(size * 0.55) }}
        >
            south_east
        </span>
    </span>
);

const LandingPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
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
        if (user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate]);

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-[#0A0A0A] text-white selection:bg-[#E8651B]/40 font-mono">

            {/* ─── Header ─── */}
            <header className="relative z-50 w-full border-b border-white/10">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 lg:px-8 py-5">
                    {/* Nav (left) */}
                    <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-white/80">
                        <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
                        <a href="#features" className="hover:text-white transition-colors">Solutions</a>
                        <a href="#pricing" className="hover:text-white transition-colors">Contact</a>
                    </nav>

                    {/* Mobile menu button */}
                    <button
                        onClick={() => setMobileMenuOpen((o) => !o)}
                        className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/20 text-white"
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                    >
                        <span className="material-symbols-outlined text-[22px]">
                            {mobileMenuOpen ? 'close' : 'menu'}
                        </span>
                    </button>

                    {/* Logo (right, in hex frame like the reference) */}
                    <Link to="/" className="flex items-center gap-2.5 text-white/90 hover:text-white transition-colors">
                        <HexLogo size={56} />
                    </Link>
                </div>

                {/* Mobile drawer */}
                <div
                    className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'max-h-[320px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                    <div className="border-t border-white/10 px-6 pt-4 pb-6 bg-[#0A0A0A]">
                        <nav className="flex flex-col gap-1 mb-5">
                            {[
                                { label: 'Sign In', to: '/login', type: 'link' },
                                { label: 'Solutions', href: '#features', type: 'anchor' },
                                { label: 'Contact', href: '#pricing', type: 'anchor' },
                            ].map((item) => item.type === 'link' ? (
                                <Link
                                    key={item.label}
                                    to={item.to}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="py-3 text-base font-semibold text-white hover:text-[#E8651B] transition-colors"
                                >
                                    {item.label}
                                </Link>
                            ) : (
                                <a
                                    key={item.label}
                                    href={item.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="py-3 text-base font-semibold text-white hover:text-[#E8651B] transition-colors"
                                >
                                    {item.label}
                                </a>
                            ))}
                        </nav>
                        <div className="flex flex-col gap-3">
                            <Link
                                to="/signup"
                                onClick={() => {
                                    setMobileMenuOpen(false);
                                    captureLandingEvent('landing_cta_clicked', { cta_name: 'mobile_menu_get_started' });
                                }}
                                className="inline-flex items-center justify-center w-full py-3 rounded-full bg-[#E8651B] text-white font-bold text-sm hover:bg-[#d4581a] transition-colors"
                            >
                                Get Started Free
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative z-10">
                {/* ─── Hero ─── */}
                <section className="mx-auto max-w-6xl px-6 lg:px-8 pt-16 md:pt-20 pb-20 md:pb-24">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                        {/* Left: Headline */}
                        <div className="relative">
                            <h1 className="font-mono text-[44px] sm:text-[56px] lg:text-[68px] leading-[1.02] tracking-tight text-white">
                                <span className="block">Unlock your</span>
                                <span className="block text-[#B39DFF]">Learning</span>
                                <span className="flex items-center gap-4 mt-2">
                                    <ArrowBadge size={56} />
                                    <span>Potential</span>
                                </span>
                            </h1>

                            <div className="mt-10 border-t border-white/15 pt-6 flex items-center justify-end">
                                <p className="text-right text-sm text-white/80 leading-relaxed">
                                    Maximize your<br />
                                    <span className="font-bold text-white">Study Efficiency</span>
                                </p>
                            </div>

                            <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                <Link
                                    to="/signup"
                                    onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'hero_get_started' })}
                                    className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-[#E8651B] text-white font-bold text-sm hover:bg-[#d4581a] transition-colors"
                                >
                                    Get Started Free
                                </Link>
                                <a
                                    href="#features"
                                    onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'hero_learn_more' })}
                                    className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full border border-white/25 text-white font-bold text-sm hover:bg-white/5 transition-colors"
                                >
                                    Learn More
                                    <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                                </a>
                            </div>
                        </div>

                        {/* Right: Photo card with purple backdrop */}
                        <div className="relative flex justify-center lg:justify-end">
                            {/* Pagination dots */}
                            <div className="absolute top-2 right-2 flex gap-1.5 z-20">
                                <span className="w-2 h-2 rounded-full bg-white" />
                                <span className="w-2 h-2 rounded-full bg-white/30" />
                            </div>

                            <div className="relative w-full max-w-md aspect-[4/5]">
                                {/* Purple back panel */}
                                <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[2rem] bg-[#B39DFF]/90" />
                                {/* Purple main panel */}
                                <div className="absolute inset-0 rounded-[2rem] bg-[#B39DFF]" />
                                {/* Photo */}
                                <div className="absolute inset-4 md:inset-6 overflow-hidden">
                                    <img
                                        src="/chewnpour/img2.jpg"
                                        alt="Student studying with laptop"
                                        className="w-full h-full object-cover object-center"
                                    />
                                </div>
                                {/* CTA pill overlay */}
                                <Link
                                    to="/signup"
                                    onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'hero_photo_cta' })}
                                    className="absolute bottom-6 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 pl-5 pr-1.5 py-1.5 rounded-full bg-white text-[#0A0A0A] text-sm font-bold shadow-lg whitespace-nowrap"
                                >
                                    Get to Know Us
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#0A0A0A] text-white">
                                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                    </span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ─── Schools Marquee ─── */}
                <section className="border-y border-white/10 bg-[#0A0A0A] py-12 md:py-16 overflow-hidden">
                    <div className="mx-auto max-w-6xl px-6 lg:px-8">
                        <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
                            Trusted by students at Ghana's top universities
                        </p>
                    </div>
                    <div className="relative mt-8 overflow-hidden">
                        <div className="pointer-events-none absolute left-0 top-0 h-full w-24 z-10 bg-gradient-to-r from-[#0A0A0A] to-transparent" />
                        <div className="pointer-events-none absolute right-0 top-0 h-full w-24 z-10 bg-gradient-to-l from-[#0A0A0A] to-transparent" />
                        <div className="flex animate-marquee gap-16 whitespace-nowrap w-max">
                            {[
                                'University of Ghana',
                                'KNUST',
                                'University of Cape Coast',
                                'Ashesi University',
                                'University of Professional Studies',
                                'Valley View University',
                                'Methodist University',
                                'Central University',
                                'University of Ghana',
                                'KNUST',
                                'University of Cape Coast',
                                'Ashesi University',
                                'University of Professional Studies',
                                'Valley View University',
                                'Methodist University',
                                'Central University',
                            ].map((school, i) => (
                                <span
                                    key={i}
                                    className="font-mono text-base font-semibold text-white/70 hover:text-white transition-colors cursor-default"
                                >
                                    {school}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── Stats Bar ─── */}
                <section className="border-b border-white/10 bg-white/[0.02]">
                    <div className="mx-auto max-w-6xl px-6 lg:px-8 py-10 md:py-12">
                        <div className="grid grid-cols-3 gap-6 md:gap-12 text-center">
                            {stats.map((stat) => (
                                <div key={stat.label}>
                                    <div className="font-mono text-2xl md:text-4xl text-white tracking-tight">{stat.value}</div>
                                    <div className="text-[11px] mt-2 uppercase tracking-widest text-white/50 font-semibold">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── All-in-One Platform (Folder cards) ─── */}
                <section id="features" className="mx-auto max-w-6xl px-6 lg:px-8 py-20 md:py-28">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                        {/* Left: intro copy */}
                        <div className="lg:col-span-5 lg:order-2 lg:text-right lg:pt-6">
                            <h2 className="font-mono text-4xl md:text-5xl lg:text-[56px] leading-[1.05] tracking-tight text-white">
                                <span className="block">All-in-One</span>
                                <span className="block text-[#B39DFF]">Platform</span>
                            </h2>
                            <p className="mt-6 text-sm text-white/70 leading-relaxed lg:ml-auto lg:max-w-sm">
                                Whether you're tackling <span className="font-bold text-white">complex subjects</span> or reviewing
                                <span className="font-bold text-white"> key concepts</span>, we're here to help you
                                study smarter, not harder.
                            </p>
                        </div>

                        {/* Right: overlapping folder cards */}
                        <div className="lg:col-span-7 lg:order-1 relative">
                            <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3">
                                {features.map((f, i) => (
                                    <div
                                        key={f.title}
                                        className={`relative ${f.bg} ${f.text} ${f.rotate} p-5 pt-6 rounded-xl rounded-tl-none shadow-xl transform transition-transform duration-300 hover:rotate-0 hover:scale-[1.02]`}
                                        style={{
                                            marginTop: i === 1 ? '2rem' : i === 2 ? '4rem' : '0',
                                            minHeight: '220px',
                                        }}
                                    >
                                        {/* Folder tab */}
                                        <div
                                            className={`absolute -top-4 left-0 h-5 w-16 ${f.bg} rounded-t-lg`}
                                            style={{ clipPath: 'polygon(0 0, 85% 0, 100% 100%, 0 100%)' }}
                                        />
                                        <p className={`text-[12px] leading-relaxed ${f.text === 'text-white' ? 'text-white/90' : 'text-[#0A0A0A]/80'} mb-8`}>
                                            {f.description}
                                        </p>
                                        <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
                                            <h3 className="font-mono text-2xl font-bold">{f.title}</h3>
                                            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white text-[#0A0A0A]">
                                                <span className="material-symbols-outlined text-[18px]">{f.icon}</span>
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ─── Testimonials ─── */}
                <section className="border-y border-white/10 bg-white/[0.02]">
                    <div className="mx-auto max-w-6xl px-6 lg:px-8 py-20 md:py-28">
                        <div className="mb-12 md:mb-16 max-w-2xl">
                            <h2 className="font-mono text-4xl md:text-5xl leading-tight tracking-tight text-white mb-3">
                                Loved by <span className="text-[#B39DFF]">Students</span><br />Across Africa
                            </h2>
                            <p className="text-white/70 max-w-lg text-sm leading-relaxed">
                                Thousands of students are studying smarter with ChewnPour. Here is what they have to say.
                            </p>
                        </div>
                        <div className="grid gap-5 md:grid-cols-2 max-w-4xl items-stretch">
                            {testimonials.map((t, i) => (
                                <div
                                    key={t.name}
                                    className={`flex flex-col p-6 md:p-7 rounded-2xl bg-[#141414] border border-white/10 ${i % 2 === 0 ? '-rotate-[0.5deg]' : 'rotate-[0.5deg]'} hover:rotate-0 transition-transform duration-300`}
                                >
                                    <div className="flex items-center gap-1 mb-3">
                                        {Array.from({ length: 5 }).map((_, idx) => (
                                            <span
                                                key={idx}
                                                className={`material-symbols-outlined filled text-[16px] ${idx < t.stars ? 'text-[#F3C64A]' : 'text-white/20'}`}
                                            >
                                                star
                                            </span>
                                        ))}
                                    </div>
                                    <p className="flex-1 text-sm text-white/80 leading-relaxed mb-5">
                                        &ldquo;{t.quote}&rdquo;
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-[#0A0A0A] flex-shrink-0 ${t.accent}`}>
                                            {t.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{t.name}</p>
                                            <p className="text-xs text-white/50">
                                                {t.course} &middot; {t.university}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── Community ─── */}
                <section id="community" className="mx-auto max-w-6xl px-6 lg:px-8 py-20 md:py-28">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                        {/* Left: copy */}
                        <div>
                            <h2 className="font-mono text-4xl md:text-5xl lg:text-[56px] leading-[1.05] tracking-tight text-white">
                                Join a community of <span className="text-[#B39DFF]">curious</span> students
                            </h2>
                            <p className="mt-6 text-sm text-white/70 leading-relaxed max-w-md">
                                Connect with peers across Ghana, share past questions, and work through
                                tough concepts together. The ChewnPour community is where learners help
                                each other cross the finish line.
                            </p>
                            <div className="mt-8 flex flex-col items-start gap-3">
                                <Link
                                    to="/signup"
                                    onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'community_join' })}
                                    className="group inline-flex items-center gap-2 h-12 px-8 rounded-full bg-[#E8651B] text-white font-bold text-sm hover:bg-[#d4581a] transition-colors"
                                >
                                    Join the Community
                                    <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5">
                                        north_east
                                    </span>
                                </Link>
                                <p className="text-xs text-white/60">
                                    2,000+ students in our Telegram already.
                                </p>
                            </div>
                        </div>

                        {/* Right: 2x2 photo grid with folder treatment */}
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { src: '/chewnpour/img1.jpg', alt: 'ChewnPour student studying with peers', tint: 'bg-[#E8651B]' },
                                { src: '/chewnpour/img2.jpg', alt: 'ChewnPour student sharing notes', tint: 'bg-[#B39DFF]' },
                                { src: '/chewnpour/img3.jpg', alt: 'ChewnPour student smiling at camera', tint: 'bg-[#F3C64A]' },
                                { src: '/chewnpour/img4.jpg', alt: 'ChewnPour student reviewing materials', tint: 'bg-[#E5E5E5]' },
                            ].map(({ src, alt, tint }, i) => (
                                <div
                                    key={src}
                                    className={`relative aspect-square ${i % 2 === 0 ? '-rotate-1' : 'rotate-1'} hover:rotate-0 transition-transform duration-300`}
                                >
                                    <div className={`absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-2xl ${tint}`} />
                                    <div className="relative w-full h-full overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                                        <img
                                            src={src}
                                            alt={alt}
                                            className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                                            loading="lazy"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── Pricing ─── */}
                <section id="pricing" className="mx-auto max-w-6xl px-6 lg:px-8 py-20 md:py-28">
                    <div className="mb-12 md:mb-16 max-w-2xl">
                        <h2 className="font-mono text-4xl md:text-5xl leading-tight tracking-tight text-white mb-3">
                            Simple <span className="text-[#B39DFF]">pricing</span>
                        </h2>
                        <p className="text-white/70 max-w-md text-sm leading-relaxed">
                            Start with 3 free uploads. Upgrade when you need more.
                        </p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 pt-5">
                        {/* Free Plan */}
                        <div className="relative flex flex-col p-6 rounded-2xl bg-[#E5E5E5] text-[#0A0A0A] -rotate-[0.5deg] hover:rotate-0 transition-transform duration-300">
                            <div className="absolute -top-4 left-0 h-5 w-16 bg-[#E5E5E5]" style={{ clipPath: 'polygon(0 0, 85% 0, 100% 100%, 0 100%)', borderTopLeftRadius: '0.5rem' }} />
                            <div className="mb-5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#0A0A0A] text-white mb-3">Free</span>
                                <div className="flex items-baseline gap-1 flex-wrap font-mono">
                                    <span className="text-4xl font-bold">
                                        {formatPlanPrice(0, starterPlan.currency)}
                                    </span>
                                    <span className="text-[#0A0A0A]/60 text-sm font-medium">/forever</span>
                                </div>
                            </div>
                            <ul className="flex-1 space-y-2.5 mb-7">
                                {[
                                    '3 document uploads',
                                    'AI-powered lessons',
                                    'Interactive quizzes',
                                    'AI Tutor chat',
                                    'Progress tracking',
                                ].map((item) => (
                                    <li key={item} className="flex items-center gap-2 text-xs text-[#0A0A0A]/80">
                                        <span className="material-symbols-outlined text-[#0A0A0A] text-[16px] flex-shrink-0">check_circle</span>
                                        <span className="break-words">{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'pricing_free' })}
                                className="inline-flex items-center justify-center w-full h-11 rounded-full bg-[#0A0A0A] text-white font-bold text-sm hover:bg-[#222] transition-colors"
                            >
                                Get Started Free
                            </Link>
                        </div>

                        {/* Starter */}
                        <div className="relative flex flex-col p-6 rounded-2xl bg-[#E8651B] text-white rotate-[0.5deg] hover:rotate-0 transition-transform duration-300">
                            <div className="absolute -top-4 left-0 h-5 w-16 bg-[#E8651B]" style={{ clipPath: 'polygon(0 0, 85% 0, 100% 100%, 0 100%)', borderTopLeftRadius: '0.5rem' }} />
                            <div className="absolute -top-3 right-4">
                                <span className="px-3 py-1 bg-[#0A0A0A] text-white text-[10px] font-bold uppercase tracking-widest rounded-full whitespace-nowrap">First {formatPlanPrice(15, starterPlan.currency || 'GHS')}</span>
                            </div>
                            <div className="mb-5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white text-[#E8651B] mb-3">Starter</span>
                                <div className="flex items-baseline gap-1 flex-wrap font-mono">
                                    <span className="text-4xl font-bold">
                                        {formatPlanPrice(starterPlan.amountMajor, starterPlan.currency)}
                                    </span>
                                    <span className="text-white/80 text-sm font-medium">/top-up</span>
                                </div>
                                <p className="text-xs text-white/80 mt-1.5">
                                    {formatPlanPrice(starterPlan.amountMajor / starterPlan.credits, starterPlan.currency)} per upload
                                </p>
                            </div>
                            <ul className="flex-1 space-y-2.5 mb-7">
                                {[
                                    `+${starterPlan.credits} uploads`,
                                    'Everything in Free',
                                    'Priority AI processing',
                                    'Assignment Helper',
                                    'AI Humanizer tool',
                                    'Premium support',
                                ].map((item) => (
                                    <li key={item} className="flex items-center gap-2 text-xs text-white/90">
                                        <span className="material-symbols-outlined text-white text-[16px] flex-shrink-0">check_circle</span>
                                        <span className="break-words">{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'pricing_starter' })}
                                className="inline-flex items-center justify-center w-full h-11 rounded-full bg-white text-[#E8651B] font-bold text-sm hover:bg-white/90 transition-colors"
                            >
                                Choose Starter
                            </Link>
                        </div>

                        {/* Max - Popular */}
                        <div className="relative flex flex-col p-6 rounded-2xl bg-[#B39DFF] text-[#0A0A0A] -rotate-[0.5deg] hover:rotate-0 transition-transform duration-300">
                            <div className="absolute -top-4 left-0 h-5 w-16 bg-[#B39DFF]" style={{ clipPath: 'polygon(0 0, 85% 0, 100% 100%, 0 100%)', borderTopLeftRadius: '0.5rem' }} />
                            <div className="absolute -top-3 right-4">
                                <span className="px-3 py-1 bg-[#0A0A0A] text-white text-[10px] font-bold uppercase tracking-widest rounded-full whitespace-nowrap">Popular</span>
                            </div>
                            <div className="mb-5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#0A0A0A] text-white mb-3">Max</span>
                                <div className="flex items-baseline gap-1 flex-wrap font-mono">
                                    <span className="text-4xl font-bold">
                                        {formatPlanPrice(maxPlan.amountMajor, maxPlan.currency)}
                                    </span>
                                    <span className="text-[#0A0A0A]/70 text-sm font-medium">/top-up</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="text-xs text-[#0A0A0A]/70">
                                        {formatPlanPrice(maxPlan.amountMajor / maxPlan.credits, maxPlan.currency)} per upload
                                    </span>
                                    {starterPlan.credits > 0 && maxPlan.credits > 0 && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0A0A0A] text-white whitespace-nowrap">
                                            Save {Math.round((1 - (maxPlan.amountMajor / maxPlan.credits) / (starterPlan.amountMajor / starterPlan.credits)) * 100)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <ul className="flex-1 space-y-2.5 mb-7">
                                {[
                                    `+${maxPlan.credits} uploads`,
                                    'Everything in Free',
                                    'Priority AI processing',
                                    'Assignment Helper',
                                    'AI Humanizer tool',
                                    'Premium support',
                                ].map((item) => (
                                    <li key={item} className="flex items-center gap-2 text-xs text-[#0A0A0A]/80">
                                        <span className="material-symbols-outlined text-[#0A0A0A] text-[16px] flex-shrink-0">check_circle</span>
                                        <span className="break-words">{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'pricing_max' })}
                                className="inline-flex items-center justify-center w-full h-11 rounded-full bg-[#0A0A0A] text-white font-bold text-sm hover:bg-[#222] transition-colors"
                            >
                                Choose Max
                            </Link>
                        </div>

                        {/* Semester Pass */}
                        <div className="relative flex flex-col p-6 rounded-2xl bg-[#F3C64A] text-[#0A0A0A] rotate-[0.5deg] hover:rotate-0 transition-transform duration-300">
                            <div className="absolute -top-4 left-0 h-5 w-16 bg-[#F3C64A]" style={{ clipPath: 'polygon(0 0, 85% 0, 100% 100%, 0 100%)', borderTopLeftRadius: '0.5rem' }} />
                            <div className="absolute -top-3 right-4">
                                <span className="px-3 py-1 bg-[#0A0A0A] text-white text-[10px] font-bold uppercase tracking-widest rounded-full whitespace-nowrap">Best Value</span>
                            </div>
                            <div className="mb-5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#0A0A0A] text-white mb-3">Semester</span>
                                <div className="flex items-baseline gap-1 flex-wrap font-mono">
                                    <span className="text-4xl font-bold">
                                        {formatPlanPrice(semesterPlan.amountMajor, semesterPlan.currency)}
                                    </span>
                                    <span className="text-[#0A0A0A]/70 text-sm font-medium">/semester</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="text-xs text-[#0A0A0A]/80 font-semibold">
                                        {formatPlanPrice(semesterPlan.amountMajor / semesterPlan.credits, semesterPlan.currency)}/upload
                                    </span>
                                    {starterPlan.credits > 0 && semesterPlan.credits > 0 && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0A0A0A] text-white whitespace-nowrap">
                                            Save {Math.round((1 - (semesterPlan.amountMajor / semesterPlan.credits) / (starterPlan.amountMajor / starterPlan.credits)) * 100)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <ul className="flex-1 space-y-2.5 mb-7">
                                {[
                                    `+${semesterPlan.credits} uploads`,
                                    'Unlimited AI chat messages',
                                    'Everything in Free',
                                    'Priority AI processing',
                                    'Assignment Helper',
                                    'AI Humanizer tool',
                                    'Valid for ~4 months',
                                ].map((item) => (
                                    <li key={item} className="flex items-center gap-2 text-xs text-[#0A0A0A]/80">
                                        <span className="material-symbols-outlined text-[#0A0A0A] text-[16px] flex-shrink-0">check_circle</span>
                                        <span className={`break-words ${item.includes('Unlimited') ? 'font-bold' : ''}`}>
                                            {item}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'pricing_semester' })}
                                className="inline-flex items-center justify-center w-full h-11 rounded-full bg-[#0A0A0A] text-white font-bold text-sm hover:bg-[#222] transition-colors"
                            >
                                Get Semester Pass
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ─── Ready to Start CTA ─── */}
                <section className="mx-auto max-w-6xl px-6 lg:px-8 py-20 md:py-28">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                        {/* Left: copy + CTA */}
                        <div>
                            <h2 className="font-mono text-4xl md:text-5xl lg:text-[56px] leading-[1.05] tracking-tight text-white">
                                Ready to <span className="text-[#B39DFF]">Start?</span>
                            </h2>
                            <p className="mt-6 text-sm text-white/80 leading-relaxed max-w-md">
                                ChewnPour is designed for students who want to take control of their
                                learning. With features that fit your schedule and learning style,
                                <span className="font-bold text-white"> you'll stay organized, engaged, and ahead of the curve.</span>
                            </p>
                            <Link
                                to="/signup"
                                onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'footer_cta_get_started' })}
                                className="inline-flex items-center justify-center mt-8 h-12 px-8 rounded-md bg-[#F3C64A] text-[#0A0A0A] font-bold text-sm hover:bg-[#e9ba36] transition-colors"
                            >
                                Get Started Now
                            </Link>
                        </div>

                        {/* Right: photo w/ purple backdrop */}
                        <div className="relative flex justify-center lg:justify-end">
                            <div className="relative w-full max-w-md aspect-[4/5]">
                                <div className="absolute inset-0 rounded-[2rem] bg-[#B39DFF]" />
                                <div className="absolute inset-4 md:inset-6 overflow-hidden">
                                    <img
                                        src="/chewnpour/img3.jpg"
                                        alt="Student ready to learn"
                                        className="w-full h-full object-cover object-center"
                                    />
                                </div>
                                <div className="absolute -top-4 left-6">
                                    <ArrowBadge size={48} />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* ─── Footer ─── */}
            <footer className="bg-[#E8651B] text-white">
                <div className="mx-auto max-w-6xl px-6 lg:px-8 py-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-5 text-xs font-semibold">
                            <a
                                href="https://t.me/+jIHi6XFYdl9kNDA0"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white/90 hover:text-white transition-colors"
                            >
                                Telegram
                            </a>
                            <a
                                href="mailto:info@chewnpour.com"
                                className="text-white/90 hover:text-white transition-colors"
                            >
                                Email
                            </a>
                            <a href="#pricing" className="text-white/90 hover:text-white transition-colors">
                                Pricing
                            </a>
                        </div>
                        <p className="text-xs font-semibold">Copyright 2026 © ChewnPour, Inc.</p>
                    </div>
                </div>
                <div className="flex items-center justify-center py-2 bg-[#E8651B]">
                    <button
                        type="button"
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                        aria-label="Back to top"
                    >
                        <span className="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
