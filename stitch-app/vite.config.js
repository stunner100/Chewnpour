import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const thisDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const resolvedMaintenanceMode = String(env.VITE_MAINTENANCE_MODE || '').trim()
  const authDevPort = String(env.AUTH_DEV_PORT || '8787').trim()

  return {
    resolve: {
      alias: {
        '@': path.resolve(thisDir, 'src'),
      },
    },
    define: {
      'import.meta.env.VITE_MAINTENANCE_MODE': JSON.stringify(resolvedMaintenanceMode),
    },
    worker: {
      format: 'es',
    },
    server: {
      proxy: {
        '/api/auth': {
          target: `http://127.0.0.1:${authDevPort}`,
          changeOrigin: true,
        },
        '/api/profile': {
          target: `http://127.0.0.1:${authDevPort}`,
          changeOrigin: true,
        },
        '/api/uploads': {
          target: `http://127.0.0.1:${authDevPort}`,
          changeOrigin: true,
        },
        '/api/courses': {
          target: `http://127.0.0.1:${authDevPort}`,
          changeOrigin: true,
        },
        '/api/share': {
          target: `http://127.0.0.1:${authDevPort}`,
          changeOrigin: true,
        },
        '/api/topics': {
          target: `http://127.0.0.1:${authDevPort}`,
          changeOrigin: true,
        },
        '/api/billing': {
          target: `http://127.0.0.1:${authDevPort}`,
          changeOrigin: true,
        },
        '/api/progress': {
          target: `http://127.0.0.1:${authDevPort}`,
          changeOrigin: true,
        },
        '/api/quiz-attempts': {
          target: `http://127.0.0.1:${authDevPort}`,
          changeOrigin: true,
        },
        '/eve': {
          target: String(env.VITE_EVE_DEV_ORIGIN || 'http://127.0.0.1:2000').trim(),
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router/')
            ) {
              return 'vendor-react';
            }

            if (id.includes('/better-auth/')) {
              return 'vendor-auth';
            }

            if (id.includes('/@sentry/')) {
              return 'vendor-sentry';
            }

            if (id.includes('/posthog-js/')) {
              return 'vendor-posthog';
            }

            if (id.includes('/pdfjs-dist/')) {
              return 'vendor-pdf';
            }
          },
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          name: 'ChewnPour',
          short_name: 'ChewnPour',
          description: 'Turn your slides into smart lessons and quizzes.',
          lang: 'en',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#F9F9F9',
          theme_color: '#F9F9F9',
          icons: [
            { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/pwa-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        includeAssets: [
          'favicon.svg',
          'icons/favicon-32x32.png',
          'icons/apple-touch-icon.png',
          'icons/pwa-192x192.png',
          'icons/pwa-512x512.png',
          'icons/pwa-512x512-maskable.png',
        ],
        workbox: {
          // Precache the app shell (hashed JS/CSS + html/svg/woff2/ico + small icons).
          // Large media (hero/screenshots/brand) is intentionally excluded so the
          // install stays small; it loads from the network when online.
          globPatterns: ['**/*.{js,css,html,svg,woff2,ico}'],
          navigateFallback: 'index.html',
          // Only the marketing home uses the cached app-shell. /dashboard and
          // other app routes must hit the network so deploys are not stuck
          // behind a precached index.html. /api/ is also denylisted so Google
          // OAuth callbacks are not served as the SPA 404.
          navigateFallbackAllowlist: [/^\/$/],
          navigateFallbackDenylist: [/^\/api\//, /^\/ingest\//, /^\/eve\//],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  }
})
