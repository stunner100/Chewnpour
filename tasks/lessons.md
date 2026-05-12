# Agent Lessons

## Convex Deployment Target

- ChewnPour's Convex backend is self-hosted on DigitalOcean. Do not deploy to
  Convex Cloud, configure `*.convex.cloud`, or rely on checked-in Convex Cloud
  fallbacks unless the user explicitly requests that for a specific task.
- Before any Convex or frontend deployment, verify `VITE_CONVEX_URL` and
  `CONVEX_URL` point at the DigitalOcean-hosted/self-hosted Convex runtime.

## Frontend Readiness Gates

- Do not treat newly-added backend summary fields as the only source of truth on
  staging or production. If readiness metadata is missing, treat it as unknown
  and fall back to fetching the underlying course/topics. Only hide cards when
  the backend explicitly reports a known-empty state.
