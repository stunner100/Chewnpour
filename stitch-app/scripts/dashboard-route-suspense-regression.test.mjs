import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const appSource = await fs.readFile(path.join(root, 'src', 'App.jsx'), 'utf8');

for (const snippet of [
  'const RouteSuspense = ({ children }) => {',
  'const routerLocation = useLocation();',
  '<Suspense key={routerLocation.pathname} fallback={<RouteLoader />}>',
  '<RouteSuspense>',
  '</RouteSuspense>',
]) {
  if (!appSource.includes(snippet)) {
    throw new Error(`Expected route suspense to be keyed by pathname so stale dashboard content is not kept visible during lazy route transitions: ${snippet}`);
  }
}

if (appSource.includes('<Suspense fallback={<RouteLoader />}>\n    {element}\n  </Suspense>')) {
  throw new Error('Regression detected: unkeyed route Suspense can keep stale dashboard content visible while the URL changes.');
}

console.log('dashboard-route-suspense-regression.test.mjs passed');
