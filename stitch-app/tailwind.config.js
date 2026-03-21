import formsPlugin from '@tailwindcss/forms';
import containerQueriesPlugin from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: "#1a73e8",
                    hover: "#1557b0",
                    light: "#4d9ef6",
                    dark: "#0d47a1",
                    subtle: "#e8f0fe",
                    50: "#e8f0fe",
                    100: "#c6dafc",
                    200: "#8ab4f8",
                    300: "#669df6",
                    400: "#4d9ef6",
                    500: "#1a73e8",
                    600: "#1557b0",
                    700: "#0d47a1",
                    800: "#0a3d8f",
                    900: "#062e6f",
                },
                secondary: {
                    DEFAULT: "#e8710a",
                    light: "#f29900",
                    dark: "#c25e00",
                },
                accent: {
                    teal: "#1de9b6",
                    emerald: "#00c853",
                    amber: "#ffab00",
                    coral: "#ff6d00",
                    purple: "#7c4dff",
                    pink: "#f50057",
                },
                background: {
                    light: "#f8f9fa",
                    dark: "#0e1117",
                },
                surface: {
                    light: "#ffffff",
                    dark: "#161b22",
                    elevated: "#1c2128",
                    hover: "#f1f3f4",
                    "hover-dark": "#21262d",
                },
                border: {
                    light: "#dadce0",
                    dark: "#30363d",
                    subtle: "#e8eaed",
                    "subtle-dark": "#21262d",
                },
                text: {
                    main: {
                        light: "#202124",
                        dark: "#e6edf3",
                    },
                    sub: {
                        light: "#5f6368",
                        dark: "#8b949e",
                    },
                    faint: {
                        light: "#9aa0a6",
                        dark: "#484f58",
                    },
                },
            },
            fontFamily: {
                display: ['"DM Sans"', '"Google Sans"', "Inter", "system-ui", "sans-serif"],
                body: ["Inter", '"DM Sans"', "system-ui", "sans-serif"],
                mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
            },
            fontSize: {
                "display-xl": ["2.75rem", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "700" }],
                "display-lg": ["2rem", { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: "700" }],
                "display-md": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
                "display-sm": ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.015em", fontWeight: "600" }],
                "body-lg": ["1rem", { lineHeight: "1.6", fontWeight: "400" }],
                "body-md": ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
                "body-sm": ["0.8125rem", { lineHeight: "1.5", fontWeight: "400" }],
                "caption": ["0.75rem", { lineHeight: "1.4", fontWeight: "500" }],
                "overline": ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.06em", fontWeight: "600" }],
            },
            borderRadius: {
                "DEFAULT": "0.5rem",
                "lg": "0.75rem",
                "xl": "1rem",
                "2xl": "1.25rem",
                "3xl": "1.5rem",
                "4xl": "2rem",
                "full": "9999px",
            },
            boxShadow: {
                "xs": "0 1px 2px rgba(0,0,0,0.04)",
                "soft": "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                "card": "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
                "card-hover": "0 2px 8px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06)",
                "elevated": "0 4px 16px rgba(0,0,0,0.08), 0 12px 40px rgba(0,0,0,0.04)",
                "modal": "0 8px 32px rgba(0,0,0,0.12), 0 24px 64px rgba(0,0,0,0.08)",
                "glass": "0 0 0 1px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
                "button": "0 1px 3px rgba(26,115,232,0.3), 0 4px 12px rgba(26,115,232,0.15)",
                "button-hover": "0 2px 6px rgba(26,115,232,0.4), 0 8px 20px rgba(26,115,232,0.2)",
                "inner": "inset 0 1px 2px rgba(0,0,0,0.06)",
                "ring": "0 0 0 3px rgba(26,115,232,0.15)",
            },
            spacing: {
                "4.5": "1.125rem",
                "13": "3.25rem",
                "15": "3.75rem",
                "18": "4.5rem",
                "22": "5.5rem",
                "sidebar": "16.5rem",
                "sidebar-collapsed": "4.5rem",
            },
            animation: {
                "fade-in": "fadeIn 0.4s ease-out forwards",
                "fade-in-up": "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "slide-down": "slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "slide-in-right": "slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "slide-in-left": "slideInLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "scale-in": "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "shimmer": "shimmer 2s linear infinite",
                "pulse-gentle": "pulseGentle 2.5s ease-in-out infinite",
                "spin-slow": "spin 3s linear infinite",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                fadeInUp: {
                    "0%": { opacity: "0", transform: "translateY(12px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                slideUp: {
                    "0%": { opacity: "0", transform: "translateY(16px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                slideDown: {
                    "0%": { opacity: "0", transform: "translateY(-16px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                slideInRight: {
                    "0%": { opacity: "0", transform: "translateX(16px)" },
                    "100%": { opacity: "1", transform: "translateX(0)" },
                },
                slideInLeft: {
                    "0%": { opacity: "0", transform: "translateX(-16px)" },
                    "100%": { opacity: "1", transform: "translateX(0)" },
                },
                scaleIn: {
                    "0%": { opacity: "0", transform: "scale(0.96)" },
                    "100%": { opacity: "1", transform: "scale(1)" },
                },
                shimmer: {
                    "0%": { backgroundPosition: "-200% 0" },
                    "100%": { backgroundPosition: "200% 0" },
                },
                pulseGentle: {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.6" },
                },
            },
            transitionTimingFunction: {
                "spring": "cubic-bezier(0.16, 1, 0.3, 1)",
            },
        },
    },
    plugins: [
        formsPlugin,
        containerQueriesPlugin,
    ],
}
