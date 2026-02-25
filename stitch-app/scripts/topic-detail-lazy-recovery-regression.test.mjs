import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const appSource = fs.readFileSync(path.join(rootDir, 'src/App.jsx'), 'utf8');

assert.match(
    appSource,
    /const lazyRoute = \(importer, \{ componentName, namedExport \} = \{\}\) => lazy\(\(\)/,
    'App.jsx should define a shared lazyRoute helper.',
);

assert.match(
    appSource,
    /const TopicDetail = lazyRoute\(\(\) => import\('\.\/pages\/TopicDetail'\), \{/,
    'TopicDetail route should be lazy-loaded through lazyRoute.',
);

assert.match(
    appSource,
    /namedExport: 'TopicDetail'/,
    'TopicDetail lazy import should fall back to named TopicDetail export when needed.',
);

assert.match(
    appSource,
    /if \(mod\?\.default\) return mod;/,
    'lazyRoute should prefer default export when available.',
);

assert.match(
    appSource,
    /if \(namedExport && mod\?\.\[namedExport\]\) \{/,
    'lazyRoute should fall back to a provided named export when needed.',
);

assert.match(
    appSource,
    /attemptChunkRecoveryReload\(componentName \|\| namedExport \|\| 'route'\)/,
    'lazyRoute should trigger chunk recovery on dynamic import failures.',
);

console.log('topic-detail-lazy-recovery-regression.test.mjs passed');
