import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const convexProjectConfigPath = path.resolve(
  thisDir,
  'config',
  'convex.public.json'
)

const readConvexProjectConfigUrl = () => {
  try {
    const raw = fs.readFileSync(convexProjectConfigPath, 'utf8')
    const parsed = JSON.parse(raw)
    return String(parsed?.frontendConvexUrl || '').trim()
  } catch {
    return ''
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const projectConvexUrl = readConvexProjectConfigUrl()
  // Only the local dev server may fall back to the checked-in project config.
  // Preview and production builds must provide an explicit deployment URL so a
  // preview frontend can never silently point at production Convex.
  const resolvedConvexUrl = String(
    command === 'serve'
      ? env.VITE_CONVEX_URL || env.CONVEX_URL || projectConvexUrl || ''
      : env.VITE_CONVEX_URL || env.CONVEX_URL || ''
  ).trim()
  if (command === 'build' && !resolvedConvexUrl) {
    throw new Error(
      'Missing Convex URL for build. Set VITE_CONVEX_URL/CONVEX_URL in the target environment. Preview and production builds must not fall back to config/convex.public.json.'
    )
  }

  return {
    define: {
      'import.meta.env.VITE_CONVEX_URL': JSON.stringify(resolvedConvexUrl),
    },
    worker: {
      format: 'es',
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

            if (
              id.includes('/convex/') ||
              id.includes('/better-auth/') ||
              id.includes('/@convex-dev/')
            ) {
              return 'vendor-auth';
            }

            if (
              id.includes('/@sentry/') ||
              id.includes('/posthog-js/')
            ) {
              return 'vendor-observability';
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
        injectRegister: false,
        registerType: 'autoUpdate',
        includeAssets: [
          'vite.svg',
          'icons/apple-touch-icon.png',
          'icons/pwa-192x192.png',
          'icons/pwa-512x512.png',
        ],
        manifest: {
          name: 'StudyMate',
          short_name: 'StudyMate',
          description: 'Your AI-powered learning companion for study and exam prep.',
          theme_color: '#4F46E5',
          background_color: '#0a0a0b',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icons/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icons/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/icons/pwa-512x512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                cacheableResponse: {
                  statuses: [0, 200],
                },
                expiration: {
                  maxEntries: 8,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
  }
})
