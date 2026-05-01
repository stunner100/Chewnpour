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
                /* shadcn-style CSS variable colors for hero components */
                background: 'rgb(var(--background) / <alpha-value>)',
                foreground: 'rgb(var(--foreground) / <alpha-value>)',
                muted: {
                    DEFAULT: 'rgb(var(--border) / <alpha-value>)',
                    foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
                },
                accent: {
                    DEFAULT: 'rgb(var(--border) / <alpha-value>)',
                    foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
                    teal: '#1de9b6',
                    emerald: '#00c853',
                    amber: '#ffab00',
                    coral: '#ff6d00',
                    purple: '#7c4dff',
                    pink: '#f50057',
                },
                border: 'rgb(var(--border) / <alpha-value>)',
                input: 'rgb(var(--input) / <alpha-value>)',
                ring: 'rgb(var(--ring) / <alpha-value>)',
                primary: {
                    DEFAULT: "#914bf1",
                    hover: "#7c3aed",
                    light: "#a47bf5",
                    dark: "#5b21b6",
                    subtle: "#f3ecff",
                    50: "#f6effe",
                    100: "#ece0fd",
                    200: "#d4bdfb",
                    300: "#b894f7",
                    400: "#a47bf5",
                    500: "#914bf1",
                    600: "#7c3aed",
                    700: "#6d28d9",
                    800: "#5b21b6",
                    900: "#4c1d95",
                },
                secondary: {
                    DEFAULT: "#0ea5e9",
                    light: "#38bdf8",
                    dark: "#0369a1",
                },
                /* Legacy named variants — keep for existing pages */
                "background-light": "#fafafb",
                "background-dark": "#0c0d10",
                surface: {
                    light: "#ffffff",
                    dark: "#161719",
                    elevated: "#1c1d20",
                    hover: "#f4f4f6",
                    "hover-dark": "#212226",
                },
                /* Legacy named variants — keep for existing pages */
                "border-light": "#e4e4e7",
                "border-dark": "#2a2b30",
                "border-subtle": "#eeeef0",
                "border-subtle-dark": "#202124",
                text: {
                    main: {
                        light: "#0f0f12",
                        dark: "#e9e9ee",
                    },
                    sub: {
                        light: "#52525b",
                        dark: "#a1a1aa",
                    },
                    faint: {
                        light: "#8e8e95",
                        dark: "#6b6b73",
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
                "button": "0 1px 3px rgba(145,75,241,0.3), 0 4px 12px rgba(145,75,241,0.15)",
                "button-hover": "0 2px 6px rgba(145,75,241,0.4), 0 8px 20px rgba(145,75,241,0.2)",
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
                "marquee": "marquee 30s linear infinite",
            },
            keyframes: {
                marquee: {
                    "0%": { transform: "translateX(0)" },
                    "100%": { transform: "translateX(-50%)" },
                },
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
