import { useEffect } from 'react';

const KEYBOARD_INSET_VAR = '--keyboard-inset';

export const useKeyboardInset = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const visualViewport = window.visualViewport;
        if (!visualViewport) return undefined;

        const sync = () => {
            const inset = Math.max(
                0,
                window.innerHeight - visualViewport.height - visualViewport.offsetTop,
            );
            document.documentElement.style.setProperty(
                KEYBOARD_INSET_VAR,
                `${Math.round(inset)}px`,
            );
        };

        sync();
        visualViewport.addEventListener('resize', sync);
        visualViewport.addEventListener('scroll', sync);
        window.addEventListener('resize', sync);
        return () => {
            visualViewport.removeEventListener('resize', sync);
            visualViewport.removeEventListener('scroll', sync);
            window.removeEventListener('resize', sync);
            document.documentElement.style.removeProperty(KEYBOARD_INSET_VAR);
        };
    }, []);
};
