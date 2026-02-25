# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Sentry Configuration

Frontend error tracking is enabled when `VITE_SENTRY_DSN` is set.

Required environment variables:

- `VITE_SENTRY_DSN`
- `VITE_SENTRY_ENVIRONMENT` (for example `production`)
- `VITE_SENTRY_RELEASE` (optional release identifier)
- `VITE_SENTRY_TRACES_SAMPLE_RATE`
- `VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE`
- `VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE`

Backend question-bank telemetry is enabled when `SENTRY_DSN` is set for Convex runtime.

Optional backend variables:

- `SENTRY_DSN` (falls back to `VITE_SENTRY_DSN` if unset)
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`
- `SENTRY_CAPTURE_TIMEOUT_MS` (default `1500`)

## PostHog Configuration

Frontend product analytics and behavior tracking are enabled when `VITE_POSTHOG_KEY` is set.

Required environment variables:

- `VITE_POSTHOG_KEY`

Optional variables:

- `VITE_POSTHOG_HOST` (default `https://us.i.posthog.com`)
- `VITE_POSTHOG_UI_HOST` (default `https://us.posthog.com`)
- `VITE_POSTHOG_DEBUG` (`true` to enable client-side debug logs)
