import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import AppIcon from './AppIcon';

const PAGE_BG = '#F9F9F9';
const TEXT = '#0A0A0A';
const SUBTEXT = '#6B6B70';
const BLUE = '#007AFF';
const FOOTER_YEAR = new Date().getFullYear();

// Kept for backwards compat with pages that still import it.
export const ArrowBadge = ({ size = 40, className = '' }) => (
    <span
        className={`inline-flex items-center justify-center rounded-full text-white shrink-0 ${className}`}
        style={{ width: size, height: size, background: BLUE }}
        aria-hidden="true"
    >
        <AppIcon name="arrow_outward" style={{ fontSize: Math.round(size * 0.55) }} />
    </span>
);

// Shared shell for unauthenticated product surfaces (auth/legal).
const PublicShell = ({ children, showAuthNav = true, className = '' }) => (
    <div
        className={`relative min-h-screen overflow-x-hidden ${className}`}
        style={{
            background: PAGE_BG,
            color: TEXT,
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        }}
    >
        <header className="sticky top-0 z-50 border-b border-[#E5E5EA]/80 bg-white/90 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-5 sm:px-6">
                <Link to="/" className="inline-flex min-h-11 items-center gap-2" aria-label="ChewnPour home">
                    <BrandLogo size={28} decorative />
                </Link>
                {showAuthNav && (
                    <nav className="flex items-center gap-2 text-sm sm:gap-4">
                        <Link
                            to="/"
                            className="inline-flex min-h-11 items-center rounded-full px-2 font-medium text-[#6B6B70] transition-colors hover:text-[#0A0A0A]"
                        >
                            Home
                        </Link>
                        <Link
                            to="/login"
                            className="inline-flex min-h-11 items-center rounded-full px-2 font-medium text-[#6B6B70] transition-colors hover:text-[#0A0A0A]"
                        >
                            Sign In
                        </Link>
                        <Link
                            to="/signup"
                            className="inline-flex h-11 items-center justify-center rounded-full bg-[#111] px-4 text-[13px] font-semibold text-white transition hover:bg-black"
                        >
                            Get Started
                        </Link>
                    </nav>
                )}
            </div>
        </header>

        <main className="relative mx-auto w-full max-w-[1120px] px-5 py-10 sm:px-6 lg:py-16">
            {children}
        </main>

        <footer className="mt-16 border-t border-[#E5E5EA] bg-white">
            <div className="mx-auto flex max-w-[1120px] flex-col items-start justify-between gap-6 px-5 py-10 sm:px-6 md:flex-row md:items-center">
                <div>
                    <Link to="/" className="inline-flex items-center gap-2" aria-label="ChewnPour home">
                        <BrandLogo size={28} decorative />
                    </Link>
                    <p className="mt-2 text-sm text-[#6B6B70]">The smartest study workspace.</p>
                </div>
                <nav className="flex flex-wrap items-center gap-2 text-sm text-[#6B6B70] sm:gap-4">
                    <Link to="/" className="inline-flex min-h-11 items-center rounded-full px-2 hover:text-[#0A0A0A]">Home</Link>
                    <Link to="/login" className="inline-flex min-h-11 items-center rounded-full px-2 hover:text-[#0A0A0A]">Sign In</Link>
                    <Link to="/signup" className="inline-flex min-h-11 items-center rounded-full px-2 hover:text-[#0A0A0A]">Sign Up</Link>
                    <Link to="/privacy" className="inline-flex min-h-11 items-center rounded-full px-2 hover:text-[#0A0A0A]">Privacy</Link>
                    <Link to="/terms" className="inline-flex min-h-11 items-center rounded-full px-2 hover:text-[#0A0A0A]">Terms</Link>
                    <a href="mailto:info@chewnpour.com" className="inline-flex min-h-11 items-center rounded-full px-2 hover:text-[#0A0A0A]">Contact</a>
                </nav>
            </div>
            <div className="border-t border-[#E5E5EA] py-4 text-center text-xs" style={{ color: SUBTEXT }}>
                © {FOOTER_YEAR} ChewnPour, Inc. Built for students.
            </div>
        </footer>
    </div>
);

export default PublicShell;
