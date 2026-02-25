const THEME_STORAGE_KEY = 'stitch-theme';

export const LIGHT_THEME = 'light';
export const DARK_THEME = 'dark';

const isThemeValue = (value) => value === LIGHT_THEME || value === DARK_THEME;

export const isDarkModeEnabled = () =>
  typeof document !== 'undefined' && document.documentElement.classList.contains(DARK_THEME);

const getSystemTheme = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return LIGHT_THEME;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK_THEME : LIGHT_THEME;
};

export const getStoredTheme = () => {
  if (typeof window === 'undefined') return null;
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeValue(storedTheme) ? storedTheme : null;
};

export const resolveInitialTheme = () => getStoredTheme() || getSystemTheme();

export const applyTheme = (theme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle(DARK_THEME, theme === DARK_THEME);
};

export const setThemePreference = (theme) => {
  const nextTheme = isThemeValue(theme) ? theme : LIGHT_THEME;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }
  applyTheme(nextTheme);
  return nextTheme;
};

export const toggleThemePreference = () =>
  setThemePreference(isDarkModeEnabled() ? LIGHT_THEME : DARK_THEME);

export const initializeTheme = () => {
  const initialTheme = resolveInitialTheme();
  applyTheme(initialTheme);
  return initialTheme;
};
