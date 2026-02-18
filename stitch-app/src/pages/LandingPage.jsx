import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import { useAuth } from '../contexts/AuthContext';
import heroIllustration960 from '../assets/eduwebsite-960.jpg';
import heroIllustration1600 from '../assets/eduwebsite-1600.jpg';

const features = [
    {
        title: 'Instant Lecture Synthesis',
        description: 'Upload your lecture slides or recordings and get structured notes, summaries, and key takeaways in seconds.',
        icon: 'psychology',
        color: 'bg-indigo-500',
    },
    {
        title: '24/7 AI Tutor',
        description: 'Stuck on a concept? Our AI tutor is trained on your specific course material to provide clear, personalized explanations.',
        icon: 'chat_bubble',
        color: 'bg-cyan-500',
    },
    {
        title: 'Automated Quizzing',
        description: 'Transform your notes into interactive flashcards and practice quizzes that adapt to your knowledge gaps.',
        icon: 'quiz',
        color: 'bg-violet-500',
    },
    {
        title: 'Exam Readiness Tracking',
        description: 'Get deep insights into your learning progress and know exactly what topics to focus on before exam day.',
        icon: 'analytics',
        color: 'bg-emerald-500',
    },
];

const testimonials = [
    {
        name: 'Alex Rivera',
        role: 'Med Student',
        content: 'StudyMate transformed how I handle anatomy. The AI summaries save me hours of manual note-taking every week.',
        initials: 'AR',
        avatarClass: 'from-indigo-500 to-violet-500',
    },
    {
        name: 'Sarah Chen',
        role: 'Computer Science',
        content: "The AI tutor's ability to explain complex algorithms using analogies is a game-changer for my study sessions.",
        initials: 'SC',
        avatarClass: 'from-cyan-500 to-blue-500',
    },
    {
        name: 'Jordan Smith',
        role: 'Law Student',
        content: 'Managing massive reading lists is finally manageable. I can quickly find the core arguments in any case.',
        initials: 'JS',
        avatarClass: 'from-emerald-500 to-teal-500',
    },
];

const LandingPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const posthog = usePostHog();
    const [scrolled, setScrolled] = useState(false);

    const captureLandingEvent = (eventName, properties = {}) => {
        if (!posthog || typeof posthog.capture !== 'function') return;
        posthog.capture(eventName, {
            page: 'landing',
            pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
            ...properties,
        });
    };

    useEffect(() => {
        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    setScrolled(window.scrollY > 20);
                    ticking = false;
                });
                ticking = true;
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate]);

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-[#0a0a0b] text-white font-sans selection:bg-indigo-500/30">
            {/* Background Blobs */}
            <div className="pointer-events-none fixed inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] h-[300px] w-[300px] md:h-[500px] md:w-[500px] rounded-full bg-indigo-600/20 blur-[120px] safari-blur-heavy"></div>
                <div className="absolute bottom-[-10%] right-[-10%] h-[300px] w-[300px] md:h-[500px] md:w-[500px] rounded-full bg-cyan-600/20 blur-[120px] safari-blur-heavy"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] md:h-[600px] md:w-[600px] rounded-full bg-violet-600/10 blur-[150px] safari-blur-heavy"></div>
            </div>

            {/* Header */}
            <header
                className={`fixed top-0 z-50 w-full transition-all duration-300 safari-backdrop ${scrolled ? 'bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/10 py-3' : 'bg-transparent py-5'
                    }`}
            >
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-12">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
                            <span className="material-symbols-outlined text-[20px] filled text-white">auto_awesome</span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">
                            StudyMate
                        </h1>
                    </div>
                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#demo" className="hover:text-white transition-colors">How it works</a>
                        <a href="#testimonials" className="hover:text-white transition-colors">Students</a>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link
                            to="/login"
                            onClick={() => {
                                captureLandingEvent('landing_cta_clicked', { cta_name: 'header_login' });
                            }}
                            className="text-sm font-semibold hover:text-indigo-400 transition-colors"
                        >
                            Log in
                        </Link>
                        <Link
                            to="/signup"
                            onClick={() => {
                                captureLandingEvent('landing_cta_clicked', { cta_name: 'header_get_started' });
                            }}
                            className="inline-flex items-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all active:scale-95"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            <main className="relative z-10 pt-28">
                {/* Hero Section */}
                <section className="mx-auto max-w-7xl px-6 lg:px-12 py-20 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-indigo-400 mb-8 animate-fade-in">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        Next-Gen Learning Assistant
                    </div>
                    <h2 className="text-3xl sm:text-4xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6 md:mb-8 animate-fade-in-up">
                        Master any subject with <br className="hidden md:block" />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400">
                            Your Personal AI Tutor.
                        </span>
                    </h2>
                    <p className="mx-auto max-w-2xl text-lg text-neutral-400 leading-relaxed mb-10 animate-fade-in-up animate-delay-100">
                        StudyMate uses advanced AI to synthesize your course material into manageable study paths.
                        Stop feeling overwhelmed and start excelling with personalized learning.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animate-delay-200">
                        <Link
                            to="/signup"
                            onClick={() => {
                                captureLandingEvent('landing_cta_clicked', { cta_name: 'hero_try_for_free' });
                            }}
                            className="w-full sm:w-auto inline-flex h-14 items-center justify-center rounded-2xl bg-white px-8 text-base font-bold text-black shadow-xl hover:bg-neutral-200 transition-all active:scale-95"
                        >
                            Try StudyMate for Free
                        </Link>
                        <a
                            href="#demo"
                            onClick={() => {
                                captureLandingEvent('landing_cta_clicked', { cta_name: 'hero_watch_demo' });
                            }}
                            className="w-full sm:w-auto inline-flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-8 text-base font-bold transition-colors hover:bg-white/10"
                        >
                            Watch Demo
                        </a>
                    </div>

                    {/* Dashboard Preview */}
                    <div className="mt-20 relative animate-fade-in-up animate-delay-300">
                        <div className="absolute inset-0 bg-indigo-600/20 blur-[100px] safari-blur-heavy -z-10"></div>
                        <div className="rounded-3xl border border-white/10 bg-[#121214] p-2 shadow-2xl overflow-hidden">
                            <div className="rounded-[1.4rem] overflow-hidden border border-white/5">
                                <picture>
                                    <source
                                        srcSet={`${heroIllustration960} 960w, ${heroIllustration1600} 1600w`}
                                        sizes="(max-width: 768px) 92vw, (max-width: 1280px) 88vw, 1200px"
                                        type="image/jpeg"
                                    />
                                    <img
                                        src={heroIllustration1600}
                                        alt="Platform Dashboard Preview"
                                        className="w-full h-auto opacity-90"
                                        width="1600"
                                        height="893"
                                        loading="lazy"
                                        decoding="async"
                                        fetchPriority="low"
                                    />
                                </picture>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section id="features" className="mx-auto max-w-7xl px-6 lg:px-12 py-24">
                    <div className="text-center mb-16">
                        <h3 className="text-3xl md:text-5xl font-bold mb-4">Everything you need to succeed</h3>
                        <p className="text-neutral-400 max-w-xl mx-auto">Built by students, for students. Powerful tools to help you study smarter, not harder.</p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {features.map((feature, idx) => (
                            <div
                                key={idx}
                                className="group p-8 rounded-[2rem] border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300 relative overflow-hidden"
                            >
                                <div className={`h-12 w-12 rounded-xl ${feature.color} flex items-center justify-center mb-6 shadow-lg shadow-white/5 group-hover:scale-110 transition-transform`}>
                                    <span className="material-symbols-outlined text-white">{feature.icon}</span>
                                </div>
                                <h4 className="text-xl font-bold mb-3">{feature.title}</h4>
                                <p className="text-sm text-neutral-400 leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* AI Demo Section */}
                <section id="demo" className="mx-auto max-w-7xl px-6 lg:px-12 py-24">
                    <div className="rounded-[3rem] border border-white/10 bg-gradient-to-br from-indigo-900/20 to-neutral-900/40 p-10 lg:p-20 relative overflow-hidden">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div>
                                <h3 className="text-3xl md:text-5xl font-bold mb-6">Ask anything. <br /> Get instant clarity.</h3>
                                <p className="text-lg text-neutral-400 leading-relaxed mb-8">
                                    Our AI tutor understands the context of your specific course. Upload your PDF, and it becomes a living knowledge base you can interact with.
                                </p>
                                <ul className="space-y-4">
                                    {[
                                        'Summarize chapter 4 in three bullets',
                                        'Explain the Newton-Raphson method',
                                        'Create a 10-question practice quiz',
                                        'What are the key terms in this week\'s lecture?'
                                    ].map((text, i) => (
                                        <li key={i} className="flex items-center gap-3 text-sm font-medium text-indigo-400">
                                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                            {text}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-[#0a0a0b] border border-white/10 rounded-2xl p-6 shadow-2xl">
                                <div className="space-y-4">
                                    <div className="flex justify-end">
                                        <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl rounded-tr-none text-sm max-w-[80%]">
                                            Can you explain the main concept of Quantum Entanglement?
                                        </div>
                                    </div>
                                    <div className="flex justify-start">
                                        <div className="bg-white/5 border border-white/10 text-neutral-300 px-4 py-2 rounded-2xl rounded-tl-none text-sm max-w-[80%]">
                                            <div className="flex items-center gap-2 mb-2 font-bold text-indigo-400">
                                                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                                                StudyMate AI
                                            </div>
                                            Think of it like two magic coins: if you flip one and it shows heads, the other will always show heads, no matter how far away they are. It's what Einstein called "spooky action at a distance."
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <div className="w-full h-10 bg-white/5 border border-white/10 rounded-full px-4 flex items-center justify-between text-xs text-neutral-500">
                                            <span>Type a message...</span>
                                            <span className="material-symbols-outlined text-[16px]">send</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Testimonials */}
                <section id="testimonials" className="mx-auto max-w-7xl px-6 lg:px-12 py-24">
                    <div className="text-center mb-16">
                        <h3 className="text-3xl md:text-5xl font-bold mb-4">Loved by students worldwide</h3>
                        <p className="text-neutral-400">Join thousands of high-achievers using StudyMate to master their courses.</p>
                    </div>
                    <div className="grid gap-8 md:grid-cols-3">
                        {testimonials.map((t, idx) => (
                            <div key={idx} className="p-8 rounded-3xl border border-white/5 bg-white/[0.02] relative">
                                <div className="flex items-center gap-4 mb-6">
                                    <div
                                        aria-hidden="true"
                                        className={`h-12 w-12 rounded-full border border-white/10 bg-gradient-to-br ${t.avatarClass} flex items-center justify-center text-xs font-extrabold tracking-wide text-white`}
                                    >
                                        {t.initials}
                                    </div>
                                    <div>
                                        <h5 className="font-bold">{t.name}</h5>
                                        <p className="text-xs text-indigo-400 font-medium uppercase tracking-wider">{t.role}</p>
                                    </div>
                                </div>
                                <p className="text-neutral-400 leading-relaxed italic">"{t.content}"</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA Section */}
                <section className="mx-auto max-w-7xl px-6 lg:px-12 py-24">
                    <div className="relative rounded-[2rem] md:rounded-[3rem] bg-indigo-600 p-8 sm:p-12 lg:p-24 text-center overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500 to-violet-700 -z-10"></div>
                        <div className="absolute -top-10 -right-10 h-64 w-64 rounded-full bg-white/10 blur-[60px] safari-blur-heavy"></div>

                        <h3 className="text-4xl lg:text-6xl font-bold mb-8">Ready to ace your exams?</h3>
                        <p className="text-xl text-indigo-100 mb-12 max-w-2xl mx-auto">
                            Start using StudyMate today and experience the future of personalized education. No credit card required.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                to="/signup"
                                onClick={() => {
                                    captureLandingEvent('landing_cta_clicked', { cta_name: 'footer_get_started_now' });
                                }}
                                className="w-full sm:w-auto inline-flex h-16 items-center justify-center rounded-2xl bg-white px-10 text-lg font-bold text-indigo-600 shadow-2xl hover:bg-neutral-100 transition-all active:scale-95"
                            >
                                Get Started Now
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-white/5 bg-[#0a0a0b] py-20">
                <div className="mx-auto max-w-7xl px-6 lg:px-12">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-10">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg">
                                <span className="material-symbols-outlined text-[20px] filled">auto_awesome</span>
                            </div>
                            <h4 className="text-xl font-bold">StudyMate</h4>
                        </div>
                        <nav className="flex gap-8 text-sm font-semibold text-neutral-500">
                            <a href="#features" className="hover:text-white transition-colors">Features</a>
                            <a href="#testimonials" className="hover:text-white transition-colors">Testimonials</a>
                            <a href="#" className="hover:text-white transition-colors">Contact</a>
                        </nav>
                        <p className="text-sm text-neutral-500">© 2026 StudyMate AI. Empowering the next generation of learners.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
