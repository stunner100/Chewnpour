import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = async (relativePath) =>
  await fs.readFile(path.join(root, relativePath), 'utf8');

const loginSource = await read('src/pages/Login.jsx');
for (const pattern of [
  'navigate(redirectTarget, {',
  'state: {',
  'watermelonToast: {',
  "message: 'Welcome back!'",
]) {
  if (!loginSource.includes(pattern)) {
    throw new Error(`Expected Login.jsx to preserve login success toast through navigation with "${pattern}".`);
  }
}

const dashboardLayoutSource = await read('src/components/DashboardLayout.jsx');
for (const pattern of [
  'const incomingToast = routerLocation.state?.watermelonToast',
  'watermelonToast(String(incomingToast.message), options)',
  'navigate(`${routerLocation.pathname}${routerLocation.search}`, { replace: true, state: nextState })',
]) {
  if (!dashboardLayoutSource.includes(pattern)) {
    throw new Error(`Expected DashboardLayout.jsx to replay navigation toasts with "${pattern}".`);
  }
}

console.log('watermelon-login-skeleton-regression.test.mjs passed');
