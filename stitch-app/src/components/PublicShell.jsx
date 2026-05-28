import React from 'react';
import { Link } from 'react-router-dom';
import CanvasCrowd from './blocks/CanvasCrowd';
import BrandLogo from './BrandLogo';

const ACCENT = 'rgb(145, 75, 241)';
const PAGE_BG = '#FAFAFB';
const FOOTER_BG = '#FAF8F3';
const TEXT = '#1F2933';
const SUBTEXT = '#687384';
const FOOTER_YEAR = new Date().getFullYear();

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

// Shared shell for unauthenticated product surfaces. The landing page owns its
// immersive dark treatment separately; auth/legal routes stay light.
const PublicShell = ({ children, showAuthNav = true, className = '' }) => (
    <div
        className={`relative min-h-screen overflow-x-hidden ${className}`}
        style={{
            background: PAGE_BG,
            color: TEXT,
            fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
        }}
    >
        <header className="sticky top-0 z-50" style={{ background: PAGE_BG }}>
            <div className="mx-auto max-w-[1200px] px-6 lg:px-12 py-5 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2.5 text-[#6D28D9]" aria-label="ChewnPour home">
                    <BrandLogo size={28} decorative />
                </Link>
                {showAuthNav && (
                    <nav className="flex items-center gap-6 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                        <Link to="/" className="text-[#687384] hover:text-[#1F2933] transition-colors">Home</Link>
                        <Link to="/login" className="text-[#687384] hover:text-[#1F2933] transition-colors">Sign In</Link>
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

        <footer className="mt-16 overflow-hidden" style={{ background: FOOTER_BG, borderTop: '1px solid rgba(217,217,217,0.08)' }}>
            <div className="mx-auto max-w-[1200px] px-6 lg:px-12 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <Link to="/" className="flex items-center gap-2.5 text-[#6D28D9]">
                    <BrandLogo size={28} />
                </Link>
                <nav
                    className="flex flex-wrap items-center gap-6 text-sm"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                >
                    <Link to="/" className="text-[#687384] hover:text-[#1F2933] transition-colors">Home</Link>
                    <Link to="/login" className="text-[#687384] hover:text-[#1F2933] transition-colors">Sign In</Link>
                    <Link to="/signup" className="text-[#687384] hover:text-[#1F2933] transition-colors">Sign Up</Link>
                    <Link to="/privacy" className="text-[#687384] hover:text-[#1F2933] transition-colors">Privacy</Link>
                    <Link to="/terms" className="text-[#687384] hover:text-[#1F2933] transition-colors">Terms</Link>
                    <a href="mailto:info@chewnpour.com" className="text-[#687384] hover:text-[#1F2933] transition-colors">Contact</a>
                </nav>
            </div>
            <div
                className="relative h-[180px] sm:h-[240px] overflow-hidden"
                style={{ borderTop: '1px solid rgba(217,217,217,0.08)' }}
                aria-hidden="true"
            >
                <CanvasCrowd height={240} />
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `linear-gradient(to top, ${FOOTER_BG} 0%, rgba(250,248,243,0) 52%, ${FOOTER_BG} 100%)`,
                    }}
                />
            </div>
            <div
                className="py-4 text-center text-xs"
                style={{
                    borderTop: '1px solid rgba(217,217,217,0.08)',
                    color: SUBTEXT,
                    fontFamily: 'Inter, sans-serif',
                }}
            >
                © {FOOTER_YEAR} ChewnPour, Inc. Built for students.
            </div>
        </footer>
    </div>
);

export default PublicShell;
