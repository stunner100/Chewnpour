import { useState, useEffect, useCallback, useRef } from 'react';

export function useTextSelection(containerRef) {
    const [selection, setSelection] = useState(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        const container = containerRef?.current;
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

        document.addEventListener('selectionchange', handleSelectionChange);
        container.addEventListener('touchend', handleTouchEnd);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            document.removeEventListener('selectionchange', handleSelectionChange);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [containerRef]);

    const clearSelection = useCallback(() => {
        window.getSelection()?.removeAllRanges();
        setSelection(null);
    }, []);

    return { selection, clearSelection };
}
