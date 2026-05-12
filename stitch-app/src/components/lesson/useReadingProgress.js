import { useEffect, useState } from 'react';

// Window-based reading progress + scrollspy. The lesson page lets the
// document scroll naturally (no inner overflow:auto), so we always read
// window scroll regardless of any ref the caller passes in.
const useReadingProgress = ({ toc, headerOffset = 96 } = {}) => {
    const [progress, setProgress] = useState(0);
    const [activeId, setActiveId] = useState(null);

    useEffect(() => {
        let raf = 0;

        const compute = () => {
            raf = 0;
            const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
            const viewportHeight = window.innerHeight || 0;
            const fullHeight = Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight
            );
            const max = Math.max(1, fullHeight - viewportHeight);
            const pct = Math.min(100, Math.max(0, Math.round((scrollTop / max) * 100)));
            setProgress(pct);

            if (Array.isArray(toc) && toc.length > 0) {
                const probe = scrollTop + headerOffset + 24;
                let current = toc[0]?.id || null;
                for (const entry of toc) {
                    const el = document.getElementById(entry.id);
                    if (!el) continue;
                    const top = el.getBoundingClientRect().top + scrollTop;
                    if (top <= probe) current = entry.id;
                    else break;
                }
                setActiveId(current);
            }
        };

        const onScroll = () => {
            if (raf) return;
            raf = window.requestAnimationFrame(compute);
        };

        compute();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        return () => {
            if (raf) window.cancelAnimationFrame(raf);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, [toc, headerOffset]);

    return { progress, activeId };
};

export default useReadingProgress;
