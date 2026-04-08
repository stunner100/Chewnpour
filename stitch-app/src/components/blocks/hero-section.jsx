import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Menu, X, FileText, UploadCloud } from 'lucide-react';
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

export function HeroSection() {
    return (
        <>
            <HeroHeader />
            <main className="overflow-hidden">
                <section>
                    <div className="relative pt-20 lg:pt-28">
                        <div className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--background)_75%)]"></div>
                        <div className="mx-auto max-w-7xl px-6 lg:px-8">
                            <div className="sm:mx-auto lg:mr-auto">
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
                                    <h1 className="mt-8 max-w-4xl text-balance text-5xl font-medium md:text-7xl lg:mt-16">
                                        Study smarter with AI that knows your course
                                    </h1>
                                    <p className="mt-8 max-w-3xl text-pretty text-lg md:text-xl text-muted-foreground/90">
                                        Upload your PDF. Get lessons, quizzes, and an AI tutor in 30 seconds.
                                    </p>
                                    <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
                                        <div className="bg-foreground/5 dark:bg-foreground/10 rounded-[18px] border border-border/50 p-1 shadow-sm">
                                            <Button
                                                asChild
                                                size="lg"
                                                className="group relative h-14 rounded-xl px-8 text-base font-semibold bg-primary hover:bg-primary/95 text-white shadow-[0_0_40px_-10px_rgba(26,115,232,0.4)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                <Link to="/signup" className="flex items-center gap-2.5">
                                                    <FileText className="size-5 transition-transform group-hover:-translate-y-0.5" />
                                                    <span className="text-nowrap">Upload PDF</span>
                                                </Link>
                                            </Button>
                                        </div>
                                        <Button
                                            asChild
                                            size="lg"
                                            variant="outline"
                                            className="group h-14 rounded-xl px-8 text-base font-semibold border-2 bg-background/50 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:border-primary/40 hover:bg-muted/50"
                                        >
                                            <Link to="/login" className="flex items-center gap-2.5">
                                                <UploadCloud className="size-5 text-primary transition-transform group-hover:-translate-y-0.5" />
                                                <span className="text-nowrap">Upload Assignment</span>
                                            </Link>
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
                            <div className="relative -mr-56 mt-8 px-2 sm:mr-0 sm:mt-12 md:mt-20">
                                <div
                                    aria-hidden
                                    className="bg-gradient-to-b to-background absolute inset-0 z-10 from-transparent from-35%"
                                />
                                <div className="inset-shadow-2xs ring-background dark:inset-shadow-white/20 bg-background relative mx-auto max-w-6xl rounded-2xl border p-4 shadow-lg shadow-zinc-950/15 ring-1">

                                    {/* Arrow 1: Pointing at Upload Materials center from inside top-right */}
                                    <div className="absolute top-[8%] left-[45%] sm:left-[50%] z-30 hidden md:flex flex-col items-start rotate-[2deg] text-primary drop-shadow-md">
                                        <span className="font-['Caveat','Comic_Sans_MS',cursive] font-bold text-2xl md:text-3xl whitespace-nowrap ml-4">1. Drop your PDF here</span>
                                        <svg className="w-20 h-16 ml-2 mt-1 opacity-80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M 80,10 Q 50,40 10,80" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
                                            <path d="M 25,60 L 10,80 L 35,85" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                        </svg>
                                    </div>

                                    {/* Arrow 2: Pointing at Cards/Assignments from the right edge */}
                                    <div className="absolute top-[45%] sm:top-[50%] -right-12 sm:-right-24 z-30 hidden md:flex flex-row items-center rotate-[6deg] text-primary drop-shadow-md">
                                        <svg className="w-20 h-16 mr-2 opacity-80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M 90,30 Q 50,60 10,50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
                                            <path d="M 25,35 L 10,50 L 30,62" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                        </svg>
                                        <span className="font-['Caveat','Comic_Sans_MS',cursive] font-bold text-2xl md:text-3xl whitespace-nowrap -mt-4">2. AI generates quizzes</span>
                                    </div>


                                    <img
                                        className="z-2 bg-background border-border/25 aspect-15/8 relative rounded-2xl border"
                                        src="/screenshots/app-dashboard.png"
                                        alt="ChewnPour app — dashboard screen"
                                        width="2880"
                                        height="1800"
                                    />
                                </div>
                            </div>
                        </AnimatedGroup>
                    </div>
                </section>

                <section className="bg-background pb-16 pt-16 md:pb-32">
                    <div className="group relative m-auto max-w-7xl px-6 lg:px-8">
                        <div className="absolute inset-0 z-10 flex scale-95 items-center justify-center opacity-0 duration-500 group-hover:scale-100 group-hover:opacity-100">
                            <Link
                                to="/signup"
                                className="block text-sm duration-150 hover:opacity-75"
                            >
                                <span>Join thousands of students</span>
                                <ChevronRight className="ml-1 inline-block size-3" />
                            </Link>
                        </div>
                        <div className="group-hover:blur-xs mx-auto mt-12 grid max-w-2xl grid-cols-4 gap-x-12 gap-y-8 transition-all duration-500 group-hover:opacity-50 sm:gap-x-16 sm:gap-y-14">
                            <div className="flex col-span-2 sm:col-span-1 items-center justify-center">
                                <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground dark:invert-0 opacity-60">University of Ghana</span>
                            </div>
                            <div className="flex col-span-2 sm:col-span-1 items-center justify-center">
                                <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground opacity-60">KNUST</span>
                            </div>
                            <div className="flex col-span-2 sm:col-span-1 items-center justify-center">
                                <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground opacity-60">University of Cape Coast</span>
                            </div>
                            <div className="flex col-span-2 sm:col-span-1 items-center justify-center">
                                <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground opacity-60">Ashesi University</span>
                            </div>
                        </div>
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

export function HeroHeader() {
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
                                src="/brand/logo-dark.png"
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
                            >
                                Sign in
                            </Link>
                            <Link
                                to="/signup"
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors duration-150"
                            >
                                Get started free
                            </Link>
                        </div>

                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setMenuState(!menuState)}
                            aria-label={menuState ? 'Close Menu' : 'Open Menu'}
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
                            <Link to="/login" className="block px-3 py-2 text-sm font-medium text-white/60 hover:text-white">Sign in</Link>
                            <Link to="/signup" className="block px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold text-center">Get started free</Link>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    );
}

