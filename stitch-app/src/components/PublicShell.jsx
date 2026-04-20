import React from 'react';
import { Link } from 'react-router-dom';

// Hex-framed logo lockup — matches the landing-page HexLogo so every
// public surface uses the same brand mark.
export const HexLogo = ({ size = 48, withWordmark = true, className = '' }) => (
    <span className={`inline-flex flex-col items-center gap-1.5 ${className}`} aria-label="ChewnPour">
        <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
            <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 w-full h-full text-white/85"
                fill="none"
                aria-hidden="true"
            >
                <polygon
                    points="50,6 90,28 90,72 50,94 10,72 10,28"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    fill="none"
                />
            </svg>
            <img
                src="/logonew.jpeg"
                alt=""
                aria-hidden="true"
                className="relative block object-contain rounded-full"
                style={{ width: size * 0.72, height: size * 0.72 }}
                decoding="async"
            />
        </span>
        {withWordmark && (
            <span className="font-mono font-bold tracking-tight text-white text-xs leading-none select-none">
                ChewnPour
            </span>
        )}
    </span>
);

// Orange circular arrow badge, lifted from the landing page — used anywhere
// we want the "click / go" accent on a public page.
export const ArrowBadge = ({ size = 40, className = '' }) => (
    <span
        className={`inline-flex items-center justify-center rounded-full bg-[#E8651B] text-white shrink-0 ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
    >
        <span className="material-symbols-outlined" style={{ fontSize: Math.round(size * 0.55) }}>
            south_east
        </span>
    </span>
);

// Shared shell for all unauthenticated / marketing surfaces. Gives every
// public page the landing-page vibe: black bg, mono type, hex-framed logo
// header, orange footer.
const PublicShell = ({ children, showAuthNav = true, className = '' }) => (
    <div className={`relative min-h-screen overflow-x-hidden bg-[#0A0A0A] text-white selection:bg-[#E8651B]/40 font-mono ${className}`}>
        <header className="relative z-50 w-full border-b border-white/10">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 lg:px-8 py-5">
                <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-white/80">
                    <Link to="/" className="hover:text-white transition-colors">Home</Link>
                    <Link to="/#pricing" className="hover:text-white transition-colors">Pricing</Link>
                    {showAuthNav && (
                        <>
                            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
                            <Link to="/signup" className="hover:text-white transition-colors">Sign Up</Link>
                        </>
                    )}
                </nav>
                <Link to="/" className="flex items-center gap-2.5 text-white/90 hover:text-white transition-colors" aria-label="ChewnPour home">
                    <HexLogo size={52} />
                </Link>
            </div>
        </header>

        <main className="relative mx-auto w-full max-w-6xl px-6 lg:px-8 py-12 lg:py-20">
            {children}
        </main>

        <footer className="mt-16 bg-[#E8651B] text-white">
            <div className="mx-auto max-w-6xl px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <HexLogo size={44} withWordmark={false} />
                    <div className="font-mono text-sm leading-tight">
                        <div className="font-bold">ChewnPour</div>
                        <div className="text-white/80">Your AI study companion.</div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold">
                    <Link to="/" className="hover:underline">Home</Link>
                    <Link to="/#pricing" className="hover:underline">Pricing</Link>
                    <Link to="/login" className="hover:underline">Sign In</Link>
                    <Link to="/signup" className="hover:underline">Sign Up</Link>
                    <Link to="/privacy" className="hover:underline">Privacy</Link>
                    <Link to="/terms" className="hover:underline">Terms</Link>
                    <a href="mailto:info@chewnpour.com" className="hover:underline">info@chewnpour.com</a>
                </div>
            </div>
            <div className="border-t border-black/10 py-4 text-center text-xs font-mono text-white/90">
                © {new Date().getFullYear()} ChewnPour. Built for students.
            </div>
        </footer>
    </div>
);

export default PublicShell;
