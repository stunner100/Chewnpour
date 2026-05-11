import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';
import { WatermelonToaster } from './watermelon/WatermelonSonner';
import { watermelonToast } from './watermelon/watermelonToast';
import { useAuth } from '../contexts/AuthContext';
import { BlurFade } from './magicui/BlurFade';
import CommandPalette from './CommandPalette';

const navItems = [
    { label: 'Dashboard', icon: 'dashboard', path: '/dashboard', exact: true },
    { label: 'Upload', icon: 'cloud_upload', path: '/dashboard/upload' },
    { label: 'My Materials', icon: 'folder', path: '/dashboard/library' },
    { label: 'Lessons', icon: 'menu_book', path: '/dashboard/lessons' },
    { label: 'Quizzes', icon: 'quiz', path: '/dashboard/quiz' },
    { label: 'Flashcards', icon: 'style', path: '/dashboard/flashcards' },
    { label: 'AI Tutor', icon: 'smart_toy', path: '/dashboard/ai-tutor' },
    { label: 'Progress', icon: 'bar_chart', path: '/dashboard/progress' },
];

const bottomNavItems = [
    { label: 'Settings', icon: 'settings', path: '/dashboard/settings' },
];

const DashboardLayout = ({ children }) => {
    const routerLocation = useLocation();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const hideMobileBottomNav = routerLocation.pathname.startsWith('/dashboard/exam');

    useEffect(() => {
        const incomingToast = routerLocation.state?.watermelonToast;
        if (!incomingToast?.message) return undefined;

        const { watermelonToast: _watermelonToast, ...nextState } = routerLocation.state ?? {};
        const timeoutId = window.setTimeout(() => {
            const options = { type: incomingToast.type || 'info' };
            if (typeof incomingToast.duration === 'number') {
                options.duration = incomingToast.duration;
            }
            watermelonToast(String(incomingToast.message), options);
            navigate(`${routerLocation.pathname}${routerLocation.search}`, { replace: true, state: nextState });
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [routerLocation.pathname, routerLocation.search, routerLocation.state, navigate]);

    const isActive = (item) => {
        if (item.exact) return routerLocation.pathname === item.path;
        return routerLocation.pathname.startsWith(item.path);
    };

    const displayName = profile?.name || profile?.email?.split('@')[0] || 'Student';
    const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div className="dashboard-shell cp-theme flex h-screen overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex fixed left-0 top-0 h-screen w-sidebar-width flex-col border-r border-border-subtle bg-surface-soft p-space-4 gap-space-6 z-20">
                {/* Brand Header */}
                <div className="flex items-center gap-space-3 px-space-2 mt-space-2 mb-space-4">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>psychiatry</span>
                    </div>
                    <div>
                        <h1 className="font-headline-sm text-headline-sm tracking-tight text-primary font-bold">ChewnPour</h1>
                        <p className="font-label-xs text-label-xs text-text-muted mt-space-1">AI Study Workspace</p>
                    </div>
                </div>

                {/* Generate Material CTA */}
                <Link
                    to="/dashboard/upload"
                    className="w-full bg-primary text-on-primary font-label-md text-label-md py-space-3 rounded-xl flex items-center justify-center gap-space-2 hover:bg-primary-hover transition-colors shadow-sm"
                >
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                    Generate Material
                </Link>

                {/* Navigation */}
                <nav className="flex-1 flex flex-col gap-space-1 mt-space-4">
                    {navItems.map((item) => {
                        const active = isActive(item);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                                    active
                                        ? 'text-primary font-bold bg-primary-soft scale-[0.98]'
                                        : 'text-text-secondary hover:text-primary hover:bg-surface-variant'
                                }`}
                            >
                                <span
                                    className="material-symbols-outlined text-[20px]"
                                    style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                >
                                    {item.icon}
                                </span>
                                <span className="font-body-base text-body-base">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Section */}
                <div className="mt-auto flex flex-col gap-space-1">
                    {bottomNavItems.map((item) => {
                        const active = isActive(item);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                                    active
                                        ? 'text-primary font-bold bg-primary-soft scale-[0.98]'
                                        : 'text-text-secondary hover:text-primary hover:bg-surface-variant'
                                }`}
                            >
                                <span
                                    className="material-symbols-outlined text-[20px]"
                                    style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                >
                                    {item.icon}
                                </span>
                                <span className="font-body-base text-body-base">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col md:ml-[260px] min-h-screen">
                {/* Top Header */}
                <header className="fixed top-0 flex justify-between items-center h-16 px-space-8 w-full md:w-[calc(100%-260px)] bg-surface shadow-sm z-10 border-b border-border-subtle">
                    <div className="flex-1 max-w-md relative flex items-center focus-within:ring-2 focus-within:ring-primary-soft rounded-lg transition-all">
                        <span className="material-symbols-outlined absolute left-3 text-text-muted">search</span>
                        <input
                            className="w-full pl-10 pr-4 py-2 bg-background border-none rounded-lg text-body-sm font-body-sm focus:ring-0 placeholder:text-text-muted text-text-primary"
                            placeholder="Search materials, lessons, or topics..."
                            type="text"
                        />
                    </div>
                    <div className="flex items-center gap-space-4">
                        <button className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-soft rounded-full transition-all">
                            <span className="material-symbols-outlined">help_outline</span>
                        </button>
                        <button className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-soft rounded-full transition-all relative">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>
                        </button>
                        <div className="h-8 w-8 rounded-full overflow-hidden ml-space-2 border border-border-subtle cursor-pointer hover:shadow-sm transition-shadow bg-primary-soft flex items-center justify-center text-xs font-bold text-primary">
                            {profile?.avatar ? (
                                <img src={profile.avatar} alt="Student Profile" className="w-full h-full object-cover" />
                            ) : (
                                initials
                            )}
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main id="dashboard-main" className="flex-1 overflow-y-auto overflow-x-hidden pt-16">
                    <BlurFade key={routerLocation.pathname} duration={0.35} yOffset={8}>
                        {children}
                    </BlurFade>
                </main>
            </div>

            <WatermelonToaster position="bottom-center" />
            <CommandPalette />
            {/* Mobile Bottom Nav */}
            {!hideMobileBottomNav && <MobileBottomNav />}
        </div>
    );
};

export default DashboardLayout;
