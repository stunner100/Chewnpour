import { useState, useEffect, useCallback, useRef } from 'react';

export function useTextSelection(containerRef, ready = true) {
    const [selection, setSelection] = useState(null);
    const debounceRef = useRef(null);
    // Track when the container element is available (refs don't trigger re-renders)
    const [container, setContainer] = useState(null);

    // Lesson content mounts after progress loads, so keep trying until the
    // article exists instead of attaching once on the empty preparing state.
    useEffect(() => {
        if (!ready) {
            setContainer(null);
            return undefined;
        }
        if (containerRef?.current) {
            setContainer(containerRef.current);
            return undefined;
        }
        let cancelled = false;
        const attach = () => {
            if (!cancelled && containerRef?.current) {
                setContainer(containerRef.current);
                return true;
            }
            return false;
        };
        const raf = requestAnimationFrame(attach);
        const timer = window.setInterval(() => {
            if (attach()) window.clearInterval(timer);
        }, 200);
        return () => {
            cancelled = true;
            cancelAnimationFrame(raf);
            window.clearInterval(timer);
        };
    }, [containerRef, ready]);

    useEffect(() => {
        if (!container) return;

        const resolve = () => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.toString().trim()) {
                setSelection(null);
                return;
            }
            // Only respond to selections within the lesson content container
            if (!container.contains(sel.anchorNode)) {
                setSelection(null);
                return;
            }
            const text = sel.toString().trim();
            if (text.length < 3) {
                setSelection(null);
                return;
            }
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setSelection({
                text,
                rect: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    bottom: rect.bottom,
                },
            });
        };

        const handleSelectionChange = () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(resolve, 80);
        };

        // Mobile Safari: touchend fires before selectionchange settles
        const handleTouchEnd = () => {
            setTimeout(resolve, 150);
        };

        // Also handle mouseup directly as a fallback
        const handleMouseUp = () => {
            setTimeout(resolve, 10);
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        container.addEventListener('touchend', handleTouchEnd);
        container.addEventListener('mouseup', handleMouseUp);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            document.removeEventListener('selectionchange', handleSelectionChange);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('mouseup', handleMouseUp);
        };
    }, [container]);

    const clearSelection = useCallback(() => {
        window.getSelection()?.removeAllRanges();
        setSelection(null);
    }, []);

    return { selection, clearSelection };
}
