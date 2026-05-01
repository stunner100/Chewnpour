import React from 'react';
import { Link } from 'react-router-dom';

const ACCENT = 'rgb(145, 75, 241)';
const PAGE_BG = 'rgb(16, 17, 18)';
const FOOTER_BG = 'rgb(20, 20, 19)';
const SUBTEXT = 'rgb(163, 163, 163)';

// Hex-framed logo lockup using the same outline-only mark as the landing-page nav.
export const HexLogo = ({ size = 32, withWordmark = false, className = '' }) => (
    <span className={`inline-flex items-center gap-2.5 text-white ${className}`} aria-label="ChewnPour">
        <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} aria-hidden="true">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-white" fill="none">
                <polygon
                    points="50,6 90,28 90,72 50,94 10,72 10,28"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinejoin="round"
                    fill="none"
                />
            </svg>
            <img
                src="/logonew.jpeg"
                alt=""
                className="relative block object-contain rounded-full"
                style={{ width: size * 0.55, height: size * 0.55 }}
            />
        </span>
        {withWordmark && (
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 20, letterSpacing: '-0.02em' }}>
                ChewnPour
            </span>
        )}
    </span>
);

// Purple "go" badge — kept for backwards compat with pages that still import it.
export const ArrowBadge = ({ size = 40, className = '' }) => (
    <span
        className={`inline-flex items-center justify-center rounded-full text-white shrink-0 ${className}`}
        style={{ width: size, height: size, background: ACCENT }}
        aria-hidden="true"
    >
        <span className="material-symbols-outlined" style={{ fontSize: Math.round(size * 0.55) }}>
            arrow_outward
        </span>
    </span>
);

// Shared shell for all unauthenticated / marketing surfaces. Matches the landing page:
// near-black bg rgb(16,17,18), Outfit type, floating pill nav, slim dark footer.
const PublicShell = ({ children, showAuthNav = true, className = '' }) => (
    <div
        className={`relative min-h-screen overflow-x-hidden ${className}`}
        style={{
            background: PAGE_BG,
            color: '#fff',
            fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
        }}
    >
        <header className="sticky top-0 z-50" style={{ background: PAGE_BG }}>
            <div className="mx-auto max-w-[1200px] px-6 lg:px-12 py-5 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2.5 text-white" aria-label="ChewnPour home">
                    <HexLogo size={28} withWordmark />
                </Link>
                {showAuthNav && (
                    <nav className="flex items-center gap-6 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                        <Link to="/" className="text-white/80 hover:text-white transition-colors">Home</Link>
                        <Link to="/login" className="text-white/80 hover:text-white transition-colors">Sign In</Link>
                        <Link
                            to="/signup"
                            className="inline-flex items-center justify-center h-9 px-4 rounded-full text-white font-semibold"
                            style={{ background: ACCENT }}
                        >
                            Get Started
                        </Link>
                    </nav>
                )}
            </div>
        </header>

        <main className="relative mx-auto w-full max-w-[1200px] px-6 lg:px-12 py-10 lg:py-16">
            {children}
        </main>

        <footer className="mt-16" style={{ background: FOOTER_BG, borderTop: '1px solid rgba(217,217,217,0.08)' }}>
            <div className="mx-auto max-w-[1200px] px-6 lg:px-12 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <Link to="/" className="flex items-center gap-2.5 text-white">
                    <HexLogo size={28} withWordmark />
                </Link>
                <nav
                    className="flex flex-wrap items-center gap-6 text-sm"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                >
                    <Link to="/" className="text-white/80 hover:text-white transition-colors">Home</Link>
                    <Link to="/login" className="text-white/80 hover:text-white transition-colors">Sign In</Link>
                    <Link to="/signup" className="text-white/80 hover:text-white transition-colors">Sign Up</Link>
                    <Link to="/privacy" className="text-white/80 hover:text-white transition-colors">Privacy</Link>
                    <Link to="/terms" className="text-white/80 hover:text-white transition-colors">Terms</Link>
                    <a href="mailto:info@chewnpour.com" className="text-white/80 hover:text-white transition-colors">Contact</a>
                </nav>
            </div>
            <div
                className="py-4 text-center text-xs"
                style={{
                    borderTop: '1px solid rgba(217,217,217,0.08)',
                    color: SUBTEXT,
                    fontFamily: 'Inter, sans-serif',
                }}
            >
                © {new Date().getFullYear()} ChewnPour, Inc. Built for students.
            </div>
        </footer>
    </div>
);

export default PublicShell;
