import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const authClientPath = path.join(root, 'src', 'lib', 'auth-client.js');
const authClientSource = await fs.readFile(authClientPath, 'utf8');

if (!/convexClient,\s*crossDomainClient/.test(authClientSource) &&
  !/crossDomainClient,\s*convexClient/.test(authClientSource)) {
  throw new Error('Expected src/lib/auth-client.js to import convexClient and crossDomainClient.');
}

if (!/\[crossDomainClient\(\),\s*convexClient\(\)\]/.test(authClientSource)) {
  throw new Error('Expected src/lib/auth-client.js to configure plugins as [crossDomainClient(), convexClient()].');
}

const authConfigPath = path.join(root, 'convex', 'authConfig.ts');
const authConfigSource = await fs.readFile(authConfigPath, 'utf8');

if (!/import\s+\{\s*convex,\s*crossDomain\s*\}\s+from\s+["']@convex-dev\/better-auth\/plugins["']/.test(authConfigSource)) {
  throw new Error('Expected convex/authConfig.ts to import convex and crossDomain plugins.');
}

if (!/import\s+authConfig\s+from\s+["']\.\/auth\.config["']/.test(authConfigSource)) {
  throw new Error('Expected convex/authConfig.ts to import authConfig from ./auth.config.');
}

if (!/convex\(\{\s*authConfig[\s\S]*jwksRotateOnTokenGenerationError:\s*true[\s\S]*\}\)/.test(authConfigSource)) {
  throw new Error('Expected convex/authConfig.ts to register convex plugin with authConfig and jwksRotateOnTokenGenerationError: true.');
}

if (!/crossDomain\(\{\s*siteUrl:\s*frontendUrl\s*\}\)/.test(authConfigSource)) {
  throw new Error('Expected convex/authConfig.ts to keep crossDomain({ siteUrl: frontendUrl }) plugin.');
}

const convexAuthConfigPath = path.join(root, 'convex', 'auth.config.ts');
const convexAuthConfigSource = await fs.readFile(convexAuthConfigPath, 'utf8');

if (!/getAuthConfigProvider/.test(convexAuthConfigSource)) {
  throw new Error('Expected convex/auth.config.ts to use getAuthConfigProvider from @convex-dev/better-auth/auth-config.');
}

if (!/providers:\s*\[\s*getAuthConfigProvider\(\)\s*\]/.test(convexAuthConfigSource)) {
  throw new Error('Expected convex/auth.config.ts to configure providers with getAuthConfigProvider().');
}

console.log('better-auth-convex-token-regression.test.mjs passed');
