import React, { memo, useState, useEffect, useCallback } from 'react';

const TopicSidebar = memo(function TopicSidebar({
    normalizedContent,
    contentLines,
    toc,
    cleanLine,
    topic,
    mobileOnly,
}) {
    const [activeSection, setActiveSection] = useState('');
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        if (!toc || toc.length === 0) return;

        const ids = toc.map((item) => item.id);
        const elements = ids
            .map((id) => document.getElementById(id))
            .filter(Boolean);

        if (elements.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

                if (visible.length > 0) {
                    setActiveSection(visible[0].target.id);
                }
            },
            {
                rootMargin: '-120px 0px -60% 0px',
                threshold: 0,
            }
        );

        elements.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [toc]);

    const getIndent = useCallback((level) => {
        if (level <= 1) return '';
        if (level === 2) return 'pl-3';
        return 'pl-6';
    }, []);

    const readingMinutes = normalizedContent ? Math.ceil(normalizedContent.split(/\s+/).length / 200) : 1;
    const wordCount = normalizedContent ? normalizedContent.split(/\s+/).length : 0;

    // Mobile-only: render just the sticky dropdown
    const mobileToc = toc?.length > 0 && (
        <div className="lg:hidden sticky top-[100px] z-20 bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-sm border border-border-subtle dark:border-border-subtle-dark rounded-2xl px-3.5 py-2 shadow-soft mb-2">
            <button
                onClick={() => setMobileOpen(v => !v)}
                className="flex items-center gap-2 w-full text-body-sm text-text-sub-light dark:text-text-sub-dark"
            >
                <span className="material-symbols-outlined text-[16px]">menu_book</span>
                <span className="flex-1 text-left truncate font-medium text-text-main-light dark:text-text-main-dark">
                    {toc.find(i => i.id === activeSection)?.text ?? 'Contents'}
                </span>
                <span className="material-symbols-outlined text-[16px]">
                    {mobileOpen ? 'expand_less' : 'expand_more'}
                </span>
            </button>
            {mobileOpen && (
                <nav className="mt-2 space-y-0.5 pb-1 max-h-64 overflow-y-auto">
                    {toc.map((item) => {
                        const isActive = activeSection === item.id;
                        return (
                            <a
                                key={item.id}
                                href={`#${item.id}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    setMobileOpen(false);
                                    const el = document.getElementById(item.id);
                                    if (!el) return;
                                    const top = el.getBoundingClientRect().top + window.scrollY - 108;
                                    window.scrollTo({ top, behavior: 'smooth' });
                                }}
                                className={`block py-1.5 text-body-sm transition-colors ${getIndent(item.level)} ${
                                    isActive
                                        ? 'text-primary font-semibold'
                                        : 'text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark'
                                }`}
                            >
                                {item.text}
                            </a>
                        );
                    })}
                </nav>
            )}
        </div>
    );

    if (mobileOnly) return mobileToc;

    return (
        <div className="lg:col-span-3 space-y-4">
            <div className="sticky top-20 space-y-4">
                {/* Stats */}
                <div className="card-base p-4">
                    <h3 className="text-overline text-text-faint-light dark:text-text-faint-dark mb-3">Lesson Stats</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="text-display-sm text-text-main-light dark:text-text-main-dark">{readingMinutes}</div>
                            <div className="text-caption text-text-faint-light dark:text-text-faint-dark">min read</div>
                        </div>
                        <div>
                            <div className="text-display-sm text-text-main-light dark:text-text-main-dark">{wordCount.toLocaleString()}</div>
                            <div className="text-caption text-text-faint-light dark:text-text-faint-dark">words</div>
                        </div>
                    </div>
                </div>

                {/* Table of Contents */}
                {normalizedContent && toc.length > 0 && (
                    <div className="card-base p-4 hidden lg:block">
                        <h3 className="text-overline text-text-faint-light dark:text-text-faint-dark mb-3">Contents</h3>
                        <nav className="space-y-0.5">
                            {toc.map((item) => {
                                const isActive = activeSection === item.id;
                                return (
                                    <a
                                        key={item.id}
                                        href={`#${item.id}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const el = document.getElementById(item.id);
                                            if (!el) return;
                                            const offset = 80;
                                            const top = el.getBoundingClientRect().top + window.scrollY - offset;
                                            window.scrollTo({ top, behavior: 'smooth' });
                                        }}
                                        className={`block py-1.5 text-body-sm transition-colors ${getIndent(item.level)} ${
                                            isActive
                                                ? 'text-primary font-semibold'
                                                : 'text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark'
                                        }`}
                                    >
                                        {item.text}
                                    </a>
                                );
                            })}
                        </nav>
                    </div>
                )}

                {/* Key Points */}
                <div className="card-base p-4">
                    <h3 className="text-overline text-text-faint-light dark:text-text-faint-dark mb-3">Key Points</h3>
                    <ul className="space-y-2">
                        {(contentLines && contentLines.length > 0 ? contentLines : [
                            cleanLine(topic?.description || 'Lesson summary loading...')
                        ]).slice(0, 3).map((line, idx) => {
                            if (!line || typeof line !== 'string') return null;
                            const summaryLine = cleanLine(line);
                            if (!summaryLine) return null;
                            return (
                                <li key={idx} className="flex items-start gap-2">
                                    <span className="material-symbols-outlined text-primary text-[14px] mt-0.5 shrink-0">check</span>
                                    <span className="text-caption text-text-sub-light dark:text-text-sub-dark line-clamp-2">{summaryLine}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </div>
    );
});

export default TopicSidebar;
