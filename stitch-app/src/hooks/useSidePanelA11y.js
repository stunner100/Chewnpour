import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

const getFocusable = (container) => {
    if (!container) return [];
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter((node) => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true');
};

/**
 * Focus trap + restore for lesson side panels / dialogs.
 * Callers still own Escape → onClose and the open/close animation.
 */
export const useSidePanelA11y = ({ open, containerRef, initialFocusRef }) => {
    const previousFocusRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;

        previousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;

        const focusInitial = () => {
            const preferred = initialFocusRef?.current;
            if (preferred instanceof HTMLElement) {
                preferred.focus();
                return;
            }
            const [first] = getFocusable(containerRef.current);
            first?.focus?.();
        };

        const frame = window.requestAnimationFrame(focusInitial);

        const handleKeyDown = (event) => {
            if (event.key !== 'Tab') return;
            const focusable = getFocusable(containerRef.current);
            if (focusable.length === 0) {
                event.preventDefault();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener('keydown', handleKeyDown);
            const previous = previousFocusRef.current;
            if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
                previous.focus();
            }
        };
    }, [open, containerRef, initialFocusRef]);
};

export default useSidePanelA11y;
