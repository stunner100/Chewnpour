import React, { useEffect, useRef } from 'react';

// Default offset accounts for sticky header (~64px) + progress bar (~28px) + breath.
const SCROLL_OFFSET = 96;

const LessonTOC = ({ toc = [], activeId, headerOffset = SCROLL_OFFSET }) => {
    const listRef = useRef(null);

    // Auto-scroll the active TOC entry into view inside the rail when it changes.
    useEffect(() => {
        if (!activeId || !listRef.current) return;
        const node = listRef.current.querySelector(`[data-toc-id="${activeId}"]`);
        if (node) node.scrollIntoView({ block: 'nearest' });
    }, [activeId]);

    if (!Array.isArray(toc) || toc.length === 0) return null;

    const handleClick = (event, id) => {
        event.preventDefault();
        const node = document.getElementById(id);
        if (!node) return;
        const top = node.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState(null, '', `#${id}`);
        }
    };

    return (
        <nav aria-label="Lesson contents" className="sticky top-[110px] max-h-[calc(100vh-7.5rem)] overflow-y-auto pr-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-faint-light dark:text-text-faint-dark mb-3 px-2">In this lesson</p>
            <ul ref={listRef} className="space-y-0.5">
                {toc.map((entry) => {
                    const isActive = entry.id === activeId;
                    const indent = Math.max(0, (entry.level || 2) - 2);
                    return (
                        <li key={entry.id}>
                            <a
                                href={`#${entry.id}`}
                                data-toc-id={entry.id}
                                onClick={(e) => handleClick(e, entry.id)}
                                className={`group flex items-center gap-2 rounded-lg pl-2 pr-3 py-1.5 text-caption transition-colors ${
                                    isActive
                                        ? 'bg-primary-50 dark:bg-primary-900/25 text-primary font-semibold'
                                        : 'text-text-sub-light dark:text-text-sub-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark hover:text-text-main-light dark:hover:text-text-main-dark'
                                }`}
                                style={{ paddingLeft: `${0.5 + indent * 0.75}rem` }}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`block w-0.5 h-3.5 rounded-full shrink-0 ${
                                        isActive ? 'bg-primary' : 'bg-transparent group-hover:bg-border-light dark:group-hover:bg-border-dark'
                                    }`}
                                />
                                <span className="line-clamp-1">{entry.text}</span>
                            </a>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
};

export default LessonTOC;
