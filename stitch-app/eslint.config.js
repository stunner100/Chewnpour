import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'convex/_generated/*.js']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
  {
    // Server handlers, serverless entrypoints and regression scripts run on Node.
    files: ['server/**/*.js', 'api/**/*.js', 'scripts/**/*.{js,mjs}', '*.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Vendored shadcn/ui and AI Elements components export variant helpers and
    // contexts next to components by design.
    files: ['src/components/ui/**/*.jsx', 'src/components/ai-elements/**/*.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
