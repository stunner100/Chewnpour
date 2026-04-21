import React from 'react';
import { Link } from 'react-router-dom';

const MailIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v16H4z" />
        <path d="m4 7 8 6 8-6" />
    </svg>
);

const TelegramIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="m22 2-11 11" />
    </svg>
);

const ShieldIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
);

const FileIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
    </svg>
);

export function Footer({ onCtaClick = () => {} }) {
    return (
        <footer className="bg-background py-16 sm:py-24 border-t border-border/40 relative overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="mb-16 sm:mb-24 flex flex-col items-start gap-4">
                    <Link to="/" className="shrink-0">
                        <img
                            src="/logonew.jpeg"
                            alt="ChewnPour Logo"
                            className="h-10 w-auto object-contain"
                        />
                    </Link>
                    <p className="text-sm font-medium text-muted-foreground tracking-wide">
                        &copy; {new Date().getFullYear()} ChewnPour. All rights reserved.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-8 gap-y-12 md:grid-cols-3 w-full">
                    <div className="flex flex-col gap-6">
                        <h3 className="text-sm font-semibold text-foreground tracking-wide">Product</h3>
                        <ul className="space-y-4">
                            <li><a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
                            <li><a href="#community" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Community</a></li>
                            <li><a href="#testimonials" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Testimonials</a></li>
                            <li><a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a></li>
                        </ul>
                    </div>

                    <div className="flex flex-col gap-6">
                        <h3 className="text-sm font-semibold text-foreground tracking-wide">Account</h3>
                        <ul className="space-y-4">
                            <li><Link to="/login" onClick={() => onCtaClick('footer_sign_in')} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Log In</Link></li>
                            <li><Link to="/signup" onClick={() => onCtaClick('footer_get_started')} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Get Started</Link></li>
                            <li><Link to="/privacy" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
                            <li><Link to="/terms" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
                        </ul>
                    </div>

                    <div className="flex flex-col gap-6">
                        <h3 className="text-sm font-semibold text-foreground tracking-wide">Contact</h3>
                        <ul className="space-y-4">
                            <li>
                                <a
                                    href="mailto:info@chewnpour.com"
                                    onClick={() => onCtaClick('footer_email')}
                                    className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <MailIcon className="h-4 w-4" /> info@chewnpour.com
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://t.me/+jIHi6XFYdl9kNDA0"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => onCtaClick('footer_telegram')}
                                    className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <TelegramIcon className="h-4 w-4" /> Telegram Community
                                </a>
                            </li>
                            <li>
                                <Link to="/privacy" className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                    <ShieldIcon className="h-4 w-4" /> Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link to="/terms" className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                    <FileIcon className="h-4 w-4" /> Terms of Service
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 blur-[120px] rounded-full pointer-events-none z-0" />
        </footer>
    );
}
