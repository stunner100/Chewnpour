import { useState, useEffect, useCallback, useRef } from 'react';

export function useTextSelection(containerRef) {
    const [selection, setSelection] = useState(null);
    const debounceRef = useRef(null);
    // Track when the container element is available (refs don't trigger re-renders)
    const [container, setContainer] = useState(null);

    // Poll for the container ref to become available after mount
    useEffect(() => {
        if (containerRef?.current) {
            setContainer(containerRef.current);
            return;
        }
        // Ref may not be set on first render — check after a tick
        const raf = requestAnimationFrame(() => {
            if (containerRef?.current) setContainer(containerRef.current);
        });
        return () => cancelAnimationFrame(raf);
    }, [containerRef]);

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
