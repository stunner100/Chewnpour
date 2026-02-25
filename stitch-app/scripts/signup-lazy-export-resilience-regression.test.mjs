import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const appPath = path.join(root, 'src', 'App.jsx');
const signupPath = path.join(root, 'src', 'pages', 'SignUp.jsx');

const [appSource, signUpSource] = await Promise.all([
  fs.readFile(appPath, 'utf8'),
  fs.readFile(signupPath, 'utf8'),
]);

if (!/import\s+SignUpPage\s+from\s+'\.\/pages\/SignUp';/.test(appSource)) {
  throw new Error('Expected src/App.jsx to statically import SignUpPage to avoid lazy export mismatch crashes.');
}

if (/const\s+SignUp\s*=\s*lazyRoute\(/.test(appSource)) {
  throw new Error('Expected SignUp route to avoid lazyRoute after static import hardening.');
}

if (!/path=\"\/signup\"\s+element=\{withSuspense\(<SignUpPage\s*\/>\)\}/.test(appSource)) {
  throw new Error('Expected /signup route to render statically imported SignUpPage.');
}

if (!/export\s*\{\s*SignUp\s*\};/.test(signUpSource)) {
  throw new Error('Expected src/pages/SignUp.jsx to export named SignUp for lazy fallback resilience.');
}

if (!/export\s+default\s+SignUp;/.test(signUpSource)) {
  throw new Error('Expected src/pages/SignUp.jsx to keep default export for normal lazy import behavior.');
}

console.log('signup-lazy-export-resilience-regression.test.mjs passed');
