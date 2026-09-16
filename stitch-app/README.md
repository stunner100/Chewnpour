# stitch-app

stitch-app is the main Chewnpour web application. It contains the React/Vite frontend, Vercel-compatible API entrypoints, Node.js server modules, PostgreSQL migrations, and browser/regression scripts.

For the project overview, architecture, setup, and contribution process, see the [root README](../README.md), [architecture guide](../docs/ARCHITECTURE.md), and [contribution guide](../CONTRIBUTING.md).

## Package commands

~~~bash
npm install
npm run dev:auth
npm run dev
npm run lint
npm run build
node scripts/run-all-tests.mjs
~~~

The local API/auth process runs on port 8787 by default and Vite runs on port 5173. Configure the database, Better Auth, storage, and provider variables in .env.local using [.env.example](.env.example) as the sanitized reference.

There is no npm test script in this package. The regression runner discovers the checked-in scripts/*.test.mjs files and skips live or provider-dependent tests by default.
