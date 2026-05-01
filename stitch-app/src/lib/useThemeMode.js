import { useCallback, useEffect, useState } from 'react';
import {
    DARK_THEME,
    LIGHT_THEME,
    isDarkModeEnabled,
    setThemePreference,
} from './theme';

// Single React-friendly wrapper over the global theme module so the dashboard
// toggle, /profile toggle, and the boot-time `initializeTheme()` in main.jsx
// all read/write the same `stitch-theme` storage key. Without this the
// dashboard had its own `chewnpour:theme-mode` key which never propagated to
// other routes — so reload anywhere outside the dashboard fell back to the
// global default and looked like an unwanted theme flip.
export const useThemeMode = () => {
    const [mode, setMode] = useState(() => (isDarkModeEnabled() ? DARK_THEME : LIGHT_THEME));

    // Keep React state in sync if the document class changes from elsewhere
    // (e.g. the /profile toggle).
    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const observer = new MutationObserver(() => {
            const next = document.documentElement.classList.contains(DARK_THEME) ? DARK_THEME : LIGHT_THEME;
            setMode((current) => (current === next ? current : next));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const toggle = useCallback(() => {
        setMode((current) => {
            const next = current === DARK_THEME ? LIGHT_THEME : DARK_THEME;
            setThemePreference(next);
            return next;
        });
    }, []);

    const setExplicit = useCallback((next) => {
        const safe = next === DARK_THEME ? DARK_THEME : LIGHT_THEME;
        setThemePreference(safe);
        setMode(safe);
    }, []);

    return { mode, toggle, setMode: setExplicit };
};

export default useThemeMode;
