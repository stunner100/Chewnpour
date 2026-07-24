import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

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
    ],
  }
})
