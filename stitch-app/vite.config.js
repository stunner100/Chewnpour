import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

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
  const resolvedConvexSiteUrl = String(env.VITE_CONVEX_SITE_URL || '').trim()
  if (command === 'build' && !resolvedConvexUrl) {
    throw new Error(
      'Missing Convex URL for build. Set VITE_CONVEX_URL/CONVEX_URL in the target environment. Preview and production builds must not fall back to config/convex.public.json.'
    )
  }

  return {
    define: {
      'import.meta.env.VITE_CONVEX_URL': JSON.stringify(resolvedConvexUrl),
      'import.meta.env.VITE_CONVEX_SITE_URL': JSON.stringify(resolvedConvexSiteUrl),
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
    ],
  }
})
