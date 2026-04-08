import React from 'react';
import { Link } from 'react-router-dom';

const FacebookIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.04c-5.5 0-10 4.48-10 10.02 0 5 3.65 9.12 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.77-3.89 1.1 0 2.23.2 2.23.2v2.47h-1.25c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.9h-2.34v7a10 10 0 0 0 8.44-9.9c0-5.54-4.5-10.02-10-10.02z" /></svg>
);
const InstagramIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
);
const YoutubeIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
);
const LinkedinIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
);

export function Footer() {
    return (
        <footer className="bg-background py-16 sm:py-24 border-t border-border/40 relative overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                
                {/* Top section: Logo and Copyright */}
                <div className="mb-16 sm:mb-24 flex flex-col items-start gap-4">
                    <Link to="/" className="shrink-0">
                        <img
                            src="/brand/logo-dark.png"
                            alt="ChewnPour Logo"
                            className="h-10 w-auto object-contain"
                        />
                    </Link>
                    <p className="text-sm font-medium text-muted-foreground tracking-wide">
                        &copy; {new Date().getFullYear()} ChewnPour. All rights reserved.
                    </p>
                </div>

                {/* Bottom section: Links grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 gap-y-12 w-full">
                    
                    {/* Product */}
                    <div className="flex flex-col gap-6">
                        <h3 className="text-sm font-semibold text-foreground tracking-wide">Product</h3>
                        <ul className="space-y-4">
                            <li><Link to="/#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</Link></li>
                            <li><Link to="/#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
                            <li><Link to="/#testimonials" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Testimonials</Link></li>
                            <li><Link to="/#integration" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Integration</Link></li>
                        </ul>
                    </div>

                    {/* Company */}
                    <div className="flex flex-col gap-6">
                        <h3 className="text-sm font-semibold text-foreground tracking-wide">Company</h3>
                        <ul className="space-y-4">
                            <li><Link to="/#faqs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">FAQs</Link></li>
                            <li><Link to="/#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About Us</Link></li>
                            <li><Link to="/privacy" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
                            <li><Link to="/terms" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Terms of Services</Link></li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div className="flex flex-col gap-6">
                        <h3 className="text-sm font-semibold text-foreground tracking-wide">Resources</h3>
                        <ul className="space-y-4">
                            <li><Link to="/#blog" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Blog</Link></li>
                            <li><Link to="/#changelog" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Changelog</Link></li>
                            <li><Link to="/#brand" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Brand</Link></li>
                            <li><Link to="/#help" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Help</Link></li>
                        </ul>
                    </div>

                    {/* Social Links */}
                    <div className="flex flex-col gap-6">
                        <h3 className="text-sm font-semibold text-foreground tracking-wide">Social Links</h3>
                        <ul className="space-y-4">
                            <li>
                                <a href="#" className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                    <FacebookIcon className="h-4 w-4" /> Facebook
                                </a>
                            </li>
                            <li>
                                <a href="#" className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                    <InstagramIcon className="h-4 w-4" /> Instagram
                                </a>
                            </li>
                            <li>
                                <a href="#" className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                    <YoutubeIcon className="h-4 w-4" /> Youtube
                                </a>
                            </li>
                            <li>
                                <a href="#" className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                    <LinkedinIcon className="h-4 w-4" /> LinkedIn
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

            </div>
            {/* Very faint background glow to match the seamless premium feel of the landing page */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 blur-[120px] rounded-full pointer-events-none z-0" />
        </footer>
    );
}
