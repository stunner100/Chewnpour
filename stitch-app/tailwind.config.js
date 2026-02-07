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
                    DEFAULT: "#7c3aed", // Violet 600 - more vibrant
                    hover: "#6d28d9", // Violet 700
                    light: "#a78bfa", // Violet 400
                    dark: "#5b21b6", // Violet 800
                    subtle: "#ede9fe", // Violet 100
                },
                secondary: {
                    DEFAULT: "#f43f5e", // Rose 500 - bolder accent
                    light: "#fb7185",
                    dark: "#e11d48",
                },
                accent: {
                    cyan: "#06b6d4",
                    emerald: "#10b981",
                    amber: "#f59e0b",
                    fuchsia: "#d946ef",
                },
                background: {
                    light: "#fafafa", // Neutral 50 - slightly warmer
                    dark: "#0a0a0a", // Neutral 950 - deeper dark
                },
                surface: {
                    light: "#ffffff",
                    dark: "#171717", // Neutral 900 - richer dark
                    elevated: "#262626", // For elevated dark cards
                },
                text: {
                    main: {
                        light: "#0a0a0a", // Neutral 950
                        dark: "#fafafa", // Neutral 50
                    },
                    sub: {
                        light: "#525252", // Neutral 600
                        dark: "#a3a3a3", // Neutral 400
                    }
                }
            },
            fontFamily: {
                display: ["Plus Jakarta Sans", "Inter", "sans-serif"],
                body: ["Inter", "system-ui", "sans-serif"],
                rounded: ["Nunito", "Fredoka", "sans-serif"],
            },
            borderRadius: {
                "DEFAULT": "0.875rem", // 14px
                "lg": "1rem", // 16px
                "xl": "1.25rem", // 20px
                "2xl": "1.5rem", // 24px
                "3xl": "2rem", // 32px
                "4xl": "2.5rem", // 40px
                "full": "9999px"
            },
            boxShadow: {
                "soft": "0 4px 20px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)",
                "card": "0 0 0 1px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)",
                "card-hover": "0 0 0 1px rgba(124, 58, 237, 0.15), 0 8px 32px rgba(124, 58, 237, 0.12)",
                "glow": "0 0 30px rgba(124, 58, 237, 0.4)",
                "glow-lg": "0 0 60px rgba(124, 58, 237, 0.3)",
                "glass": "0 8px 32px 0 rgba(31, 38, 135, 0.08)",
                "inner-glow": "inset 0 0 30px rgba(124, 58, 237, 0.1)",
                "button": "0 4px 14px 0 rgba(124, 58, 237, 0.35)",
                "button-hover": "0 6px 20px 0 rgba(124, 58, 237, 0.45)",
            },
            animation: {
                "fade-in": "fadeIn 0.6s ease-out forwards",
                "fade-in-up": "fadeInUp 0.6s ease-out forwards",
                "slide-up": "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "slide-down": "slideDown 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "slide-in-right": "slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                "float": "float 4s ease-in-out infinite",
                "float-slow": "float 6s ease-in-out infinite",
                "pulse-subtle": "pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "shimmer": "shimmer 2s linear infinite",
                "gradient": "gradientShift 8s ease infinite",
                "bounce-soft": "bounceSoft 2s ease-in-out infinite",
                "spin-slow": "spin 8s linear infinite",
                "glow-pulse": "glowPulse 2s ease-in-out infinite",
                "scale-in": "scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                fadeInUp: {
                    "0%": { opacity: "0", transform: "translateY(20px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                slideUp: {
                    "0%": { opacity: "0", transform: "translateY(30px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                slideDown: {
                    "0%": { opacity: "0", transform: "translateY(-30px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                slideInRight: {
                    "0%": { opacity: "0", transform: "translateX(30px)" },
                    "100%": { opacity: "1", transform: "translateX(0)" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-12px)" },
                },
                pulseSubtle: {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.7" },
                },
                shimmer: {
                    "0%": { backgroundPosition: "-200% 0" },
                    "100%": { backgroundPosition: "200% 0" },
                },
                gradientShift: {
                    "0%, 100%": { backgroundPosition: "0% 50%" },
                    "50%": { backgroundPosition: "100% 50%" },
                },
                bounceSoft: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-5px)" },
                },
                glowPulse: {
                    "0%, 100%": { boxShadow: "0 0 20px rgba(124, 58, 237, 0.3)" },
                    "50%": { boxShadow: "0 0 40px rgba(124, 58, 237, 0.5)" },
                },
                scaleIn: {
                    "0%": { opacity: "0", transform: "scale(0.95)" },
                    "100%": { opacity: "1", transform: "scale(1)" },
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
                'mesh-gradient': 'linear-gradient(135deg, #7c3aed 0%, #f43f5e 50%, #06b6d4 100%)',
                'hero-gradient': 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(244, 63, 94, 0.05) 50%, rgba(6, 182, 212, 0.1) 100%)',
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries'),
    ],
}
