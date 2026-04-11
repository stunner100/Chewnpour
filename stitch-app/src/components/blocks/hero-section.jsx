import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { AnimatedGroup } from '../ui/animated-group';
import { cn } from '../../lib/utils';

const transitionVariants = {
    item: {
        hidden: {
            opacity: 0,
            filter: 'blur(12px)',
            y: 12,
        },
        visible: {
            opacity: 1,
            filter: 'blur(0px)',
            y: 0,
            transition: {
                type: 'spring',
                bounce: 0.3,
                duration: 1.5,
            },
        },
    },
};

export function HeroSection({ onCtaClick = () => {} }) {
    return (
        <>
            <HeroHeader onCtaClick={onCtaClick} />
            <main className="overflow-hidden">
                <section>
                    <div className="relative pt-20 lg:pt-28">
                        <div className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--background)_75%)]"></div>
                        <div className="mx-auto max-w-7xl px-6 lg:px-8">
                            <div className="mx-auto max-w-3xl text-center">
                                <AnimatedGroup
                                    variants={{
                                        container: {
                                            visible: {
                                                transition: {
                                                    staggerChildren: 0.05,
                                                    delayChildren: 0.75,
                                                }
                                            },
                                        },
                                        ...transitionVariants,
                                    }}
                                >
                                    <h1 className="mt-8 text-balance text-5xl font-semibold tracking-tight md:text-6xl lg:mt-16 lg:text-7xl">
                                        Turn any PDF into lessons, quizzes, and an AI tutor in 30 seconds.
                                    </h1>
                                    <p className="mx-auto mt-6 max-w-2xl text-pretty text-base md:text-lg text-muted-foreground">
                                        Built for university students. Loved by 10,000+ learners across Ghana.
                                    </p>
                                    <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                                        <Button
                                            asChild
                                            size="lg"
                                            className="group h-14 rounded-xl px-8 text-base font-semibold bg-primary hover:bg-primary/95 text-white shadow-[0_0_40px_-10px_rgba(26,115,232,0.4)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            <Link
                                                to="/signup"
                                                className="flex items-center gap-2.5"
                                                onClick={() => onCtaClick('hero_get_started')}
                                            >
                                                <span className="text-nowrap">Get started free</span>
                                                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
                                            </Link>
                                        </Button>
                                        <Button
                                            asChild
                                            size="lg"
                                            variant="ghost"
                                            className="h-14 rounded-xl px-8 text-base font-semibold text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors duration-200"
                                        >
                                            <a
                                                href="#how-it-works"
                                                onClick={() => onCtaClick('hero_see_how')}
                                            >
                                                <span className="text-nowrap">See how it works</span>
                                            </a>
                                        </Button>
                                    </div>
                                </AnimatedGroup>
                            </div>
                        </div>

                        <AnimatedGroup
                            variants={{
                                container: {
                                    visible: {
                                        transition: {
                                            staggerChildren: 0.05,
                                            delayChildren: 0.75,
                                        },
                                    },
                                },
                                ...transitionVariants,
                            }}
                        >
                            <div className="relative mx-auto mt-8 px-2 sm:mt-12 md:mt-20">
                                <div
                                    aria-hidden
                                    className="bg-gradient-to-b to-background absolute inset-0 z-10 from-transparent from-35%"
                                />
                                <div className="inset-shadow-2xs ring-background dark:inset-shadow-white/20 bg-background relative mx-auto max-w-6xl rounded-2xl border p-4 shadow-lg shadow-zinc-950/15 ring-1">
                                    <img
                                        className="z-2 bg-background border-border/25 aspect-15/8 relative rounded-2xl border"
                                        src="/screenshots/app-dashboard.png"
                                        alt="ChewnPour app — dashboard screen"
                                        width="2880"
                                        height="1800"
                                    />
                                </div>

                                <div id="how-it-works" className="relative z-20 mx-auto mt-10 flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
                                    {[
                                        { step: 1, label: 'Upload your PDF' },
                                        { step: 2, label: 'Get lessons & quizzes' },
                                        { step: 3, label: 'Ask the AI tutor' },
                                    ].map(({ step, label }) => (
                                        <div
                                            key={step}
                                            className="flex items-center gap-3 rounded-full border border-border/60 bg-background/80 px-4 py-2 backdrop-blur-sm"
                                        >
                                            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                                                {step}
                                            </span>
                                            <span className="text-sm font-medium text-foreground">
                                                {label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </AnimatedGroup>
                    </div>
                </section>
            </main>
        </>
    );
}

const menuItems = [
    { name: 'Home', href: '/' },
    { name: 'Features', href: '#features' },
    { name: 'Community', href: '#community' },
    { name: 'Testimonials', href: '#testimonials' },
    { name: 'Pricing', href: '#pricing' },
];

export function HeroHeader({ onCtaClick = () => {} }) {
    const [menuState, setMenuState] = React.useState(false);

    return (
        <header>
            <nav
                data-state={menuState && 'active'}
                className="group fixed z-20 w-full bg-[#0a0a0a] border-b border-white/8"
            >
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="flex items-center justify-between h-14">

                        {/* Logo — left */}
                        <Link to="/" aria-label="home" className="flex items-center gap-2.5 shrink-0">
                            <img
                                src="/chewnpourlogo.png"
                                alt="ChewnPour"
                                className="h-8 md:h-10 w-auto object-contain"
                            />
                        </Link>

                        {/* Nav links — center (desktop) */}
                        <ul className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
                            {menuItems.map((item, index) => (
                                <li key={index}>
                                    <a
                                        href={item.href}
                                        className={cn(
                                            'px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150',
                                            index === 0
                                                ? 'text-white bg-white/10'
                                                : 'text-white/50 hover:text-white/90'
                                        )}
                                    >
                                        {item.name}
                                    </a>
                                </li>
                            ))}
                        </ul>

                        {/* Actions — right (desktop) */}
                        <div className="hidden lg:flex items-center gap-4">
                            <Link
                                to="/login"
                                className="text-sm font-medium text-white/60 hover:text-white transition-colors duration-150"
                                onClick={() => onCtaClick('header_sign_in')}
                            >
                                Sign in
                            </Link>
                            <Link
                                to="/signup"
                                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors duration-150"
                                onClick={() => onCtaClick('header_get_started')}
                            >
                                Get started free
                            </Link>
                        </div>

                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setMenuState(!menuState)}
                            aria-label={menuState ? 'Close Menu' : 'Open Menu'}
                            aria-expanded={menuState}
                            className="lg:hidden p-2 text-white/70 hover:text-white transition-colors"
                        >
                            <Menu className="group-data-[state=active]:hidden size-5" />
                            <X className="hidden group-data-[state=active]:block size-5" />
                        </button>
                    </div>

                    {/* Mobile menu */}
                    <div className="group-data-[state=active]:block hidden lg:hidden pb-4 border-t border-white/8 mt-0 pt-4">
                        <ul className="flex flex-col gap-1 mb-4">
                            {menuItems.map((item, index) => (
                                <li key={index}>
                                    <a
                                        href={item.href}
                                        onClick={() => setMenuState(false)}
                                        className="block px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/8 transition-colors"
                                    >
                                        {item.name}
                                    </a>
                                </li>
                            ))}
                        </ul>
                        <div className="flex flex-col gap-2">
                            <Link
                                to="/login"
                                className="block px-3 py-2 text-sm font-medium text-white/60 hover:text-white"
                                onClick={() => {
                                    setMenuState(false);
                                    onCtaClick('mobile_sign_in');
                                }}
                            >
                                Sign in
                            </Link>
                            <Link
                                to="/signup"
                                className="block px-5 py-3 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold text-center"
                                onClick={() => {
                                    setMenuState(false);
                                    onCtaClick('mobile_get_started');
                                }}
                            >
                                Get started free
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    );
}
