import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const profilePath = path.join(root, 'src', 'pages', 'Profile.jsx');
const source = await fs.readFile(profilePath, 'utf8');

const loadingGuardIndex = source.indexOf('if (loading) {');
if (loadingGuardIndex === -1) {
  throw new Error('Regression detected: Profile loading guard is missing.');
}

const hookPatterns = [
  'const handleCopyReferralLink = useCallback(',
  'const handleShareWhatsApp = useCallback(',
  'const handleShareTelegram = useCallback(',
];

for (const pattern of hookPatterns) {
  const hookIndex = source.indexOf(pattern);
  if (hookIndex === -1) {
    throw new Error(`Regression detected: expected profile hook is missing: ${pattern}`);
  }
  if (hookIndex > loadingGuardIndex) {
    throw new Error(`Regression detected: profile loading guard runs before hook declaration: ${pattern}`);
  }
}

console.log('profile-hook-order-regression.test.mjs passed');
