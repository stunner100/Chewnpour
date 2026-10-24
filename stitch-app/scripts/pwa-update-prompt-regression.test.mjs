import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const viteConfig = await fs.readFile(path.join(root, 'vite.config.js'), 'utf8');
const appProviders = await fs.readFile(path.join(root, 'src/bootstrap/AppProviders.jsx'), 'utf8');
const promptSource = await fs.readFile(path.join(root, 'src/components/PwaUpdatePrompt.jsx'), 'utf8');

const requireIncludesIn = (fileSource, snippet, label) => {
    if (!fileSource.includes(snippet)) {
        throw new Error(`PWA update prompt should keep ${label}: ${snippet}`);
    }
};

const requireExcludesIn = (fileSource, snippet, label) => {
    if (fileSource.includes(snippet)) {
        throw new Error(`PWA update prompt should not ${label}: ${snippet}`);
    }
};

// Prompt mode + manual registration so the React hook owns the SW lifecycle and
// can surface a reload prompt instead of silently racing iOS autoUpdate.
requireIncludesIn(viteConfig, "registerType: 'prompt'", 'prompt mode so waiting SWs surface a reload');
requireIncludesIn(viteConfig, 'injectRegister: false', 'no auto-injected double registration');
requireExcludesIn(viteConfig, "registerType: 'autoUpdate'", 'autoUpdate silently drops updates on installed iOS PWAs');

// The prompt must live in the always-mounted app shell so it renders on every
// route, including the lesson tutor panel and the dedicated AI Tutor page.
requireIncludesIn(appProviders, 'PwaUpdatePrompt', 'update prompt is part of the app shell');
requireIncludesIn(appProviders, '<PwaUpdatePrompt />', 'update prompt is actually mounted');

// The prompt must use the official vite-plugin-pwa React hook so needRefresh
// fires when a waiting service worker exists.
requireIncludesIn(promptSource, "from 'virtual:pwa-register/react'", 'use the vite-plugin-pwa React hook');
requireIncludesIn(promptSource, 'useRegisterSW', 'subscribe to SW update lifecycle');
requireIncludesIn(promptSource, 'onRegisteredSW', 'hook the registration for periodic update checks');
requireIncludesIn(promptSource, 'registration.update()', 'poll for updates while the app is open');
requireIncludesIn(promptSource, 'updateServiceWorker(true)', 'activate the waiting SW and reload on accept');
requireIncludesIn(promptSource, 'safe-area-inset-top', 'clear the mobile notch on iOS');

console.log('pwa-update-prompt-regression.test.mjs passed');
