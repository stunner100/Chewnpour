import React, { useEffect, useRef } from 'react';

const EMPTY_ARRAY = [];

const LessonTOC = ({ toc = EMPTY_ARRAY, activeId, onNavigate }) => {
    const navRef = useRef(null);
    const listRef = useRef(null);

    // Auto-scroll the active TOC entry into view inside the rail when it changes.
    useEffect(() => {
        if (!activeId || !listRef.current || !navRef.current) return;
        const node = listRef.current.querySelector(`[data-toc-id="${activeId}"]`);
        if (!node) return;

        const scrollContainer = navRef.current;
        const containerRect = scrollContainer.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const breathingRoom = 8;

        if (nodeRect.top < containerRect.top) {
            scrollContainer.scrollTo({
                top: scrollContainer.scrollTop + nodeRect.top - containerRect.top - breathingRoom,
                behavior: 'smooth',
            });
        } else if (nodeRect.bottom > containerRect.bottom) {
            scrollContainer.scrollTo({
                top: scrollContainer.scrollTop + nodeRect.bottom - containerRect.bottom + breathingRoom,
                behavior: 'smooth',
            });
        }
    }, [activeId]);

    if (!Array.isArray(toc) || toc.length === 0) return null;

    const handleClick = (event, id) => {
        event.preventDefault();
        const node = document.getElementById(id);
        if (!node) return;
        node.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
        if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState(null, '', `#${id}`);
        }
        onNavigate?.();
    };

    return (
        <nav ref={navRef} aria-label="Lesson contents" className="sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
            <p className="mb-3 px-2 text-caption font-semibold uppercase tracking-[0.12em] text-text-muted">In this lesson</p>
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
                                className={`group flex items-center gap-2 rounded-lg py-1.5 pr-3 text-caption transition-colors ${
                                    isActive
                                        ? 'bg-primary-subtle font-semibold text-primary'
                                        : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                                }`}
                                style={{ paddingLeft: `${0.5 + indent * 0.75}rem` }}
                                aria-current={isActive ? 'location' : undefined}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`block h-3.5 w-0.5 shrink-0 rounded-full ${
                                        isActive ? 'bg-primary' : 'bg-transparent group-hover:bg-border-subtle'
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
