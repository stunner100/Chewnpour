import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const srcRoot = resolve(projectRoot, 'src');

const allowedDirectBrandPathFile = 'components/BrandLogo.jsx';
const forbiddenSourceTokens = [
    'HexLogo',
    '/logonew.jpeg',
    '/chewnpourlogo.png',
    '/chewnpour.png',
];

const walkFiles = (directory) => {
    const files = [];

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = resolve(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...walkFiles(fullPath));
        } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
            files.push(fullPath);
        }
    }

    return files;
};

const failures = [];

for (const file of walkFiles(srcRoot)) {
    const relativeFile = relative(srcRoot, file);
    const source = readFileSync(file, 'utf8');

    for (const token of forbiddenSourceTokens) {
        if (source.includes(token)) {
            failures.push(`${relativeFile} contains forbidden logo token "${token}"`);
        }
    }

    if (
        relativeFile !== allowedDirectBrandPathFile &&
        (source.includes('/brand/logo') || source.includes('/brand/mark'))
    ) {
        failures.push(`${relativeFile} hard-codes brand asset paths instead of using BrandLogo`);
    }
}

for (const removedAsset of [
    'public/logonew.jpeg',
    'public/chewnpourlogo.png',
    'public/chewnpour.png',
]) {
    if (existsSync(resolve(projectRoot, removedAsset))) {
        failures.push(`${removedAsset} should not be shipped after the logo cutover`);
    }
}

if (failures.length > 0) {
    throw new Error(`Brand logo standard regression failed:\n${failures.join('\n')}`);
}

console.log('brand-logo-standard-regression.test.mjs passed');
