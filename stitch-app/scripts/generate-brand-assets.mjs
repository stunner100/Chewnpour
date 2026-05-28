import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const repoRoot = resolve(projectRoot, '..');
const sourceRoot = resolve(repoRoot, 'Chewnpour-logo');
const brandRoot = resolve(projectRoot, 'public/brand');
const iconRoot = resolve(projectRoot, 'public/icons');
const tempRoot = await fsTempDir();

const magick = process.env.MAGICK_BIN || 'magick';
const deterministicPng = ['-strip', '-define', 'png:exclude-chunk=all'];

const source = {
    cover: resolve(sourceRoot, 'cover.png'),
    squareLogo: resolve(sourceRoot, 'default.png'),
    squareWordmark: resolve(sourceRoot, 'profile.png'),
    logo: resolve(sourceRoot, 'vector/default-monochrome.svg'),
    logoWhite: resolve(sourceRoot, 'vector/default-monochrome-white.svg'),
    logoBlack: resolve(sourceRoot, 'vector/default-monochrome-black.svg'),
};

const output = {
    cover: resolve(brandRoot, 'cover.png'),
    logoSquare: resolve(brandRoot, 'logo-square.png'),
    wordmarkSquare: resolve(brandRoot, 'wordmark-square.png'),
    logo: resolve(brandRoot, 'logo.svg'),
    logoWhite: resolve(brandRoot, 'logo-white.svg'),
    logoBlack: resolve(brandRoot, 'logo-black.svg'),
    markSvg: resolve(brandRoot, 'mark.svg'),
    logoDark: resolve(brandRoot, 'logo-dark.png'),
    logoLight: resolve(brandRoot, 'logo-light.png'),
    mark: resolve(brandRoot, 'mark.png'),
    ogLogo: resolve(brandRoot, 'og-logo.png'),
    pwa512: resolve(iconRoot, 'pwa-512x512.png'),
    pwa512Maskable: resolve(iconRoot, 'pwa-512x512-maskable.png'),
    pwa192: resolve(iconRoot, 'pwa-192x192.png'),
    appleTouch: resolve(iconRoot, 'apple-touch-icon.png'),
    favicon: resolve(iconRoot, 'favicon-32x32.png'),
};

async function fsTempDir() {
    const { mkdtemp } = await import('node:fs/promises');
    return mkdtemp(resolve(os.tmpdir(), 'chewnpour-brand-'));
}

const runMagick = (args) =>
    new Promise((resolveProcess, reject) => {
        const child = spawn(magick, args, { stdio: 'inherit' });

        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolveProcess();
            } else {
                reject(new Error(`${magick} ${args.join(' ')} exited with code ${code}`));
            }
        });
    });

await mkdir(brandRoot, { recursive: true });
await mkdir(iconRoot, { recursive: true });

try {
    await copyFile(source.cover, output.cover);
    await copyFile(source.squareLogo, output.logoSquare);
    await copyFile(source.squareWordmark, output.wordmarkSquare);
    await copyFile(source.logo, output.logo);
    await copyFile(source.logoWhite, output.logoWhite);
    await copyFile(source.logoBlack, output.logoBlack);

    const logoSvg = await readFile(source.logo, 'utf8');
    await writeFile(
        output.markSvg,
        logoSvg.replace('viewBox="0 0 406 97"', 'viewBox="0 0 100 97"')
    );

    const trimmedLogo = resolve(tempRoot, 'logo-trim.png');
    const trimmedMark = resolve(tempRoot, 'mark-trim.png');

    await runMagick([
        source.cover,
        '-fuzz',
        '3%',
        '-trim',
        '+repage',
        trimmedLogo,
    ]);

    await runMagick([
        source.squareLogo,
        '-crop',
        '220x220+110+395',
        '+repage',
        '-fuzz',
        '3%',
        '-trim',
        '+repage',
        trimmedMark,
    ]);

    await runMagick([
        trimmedLogo,
        '-fuzz',
        '2%',
        '-transparent',
        '#FBF3EF',
        '-resize',
        '3037x476',
        '-gravity',
        'center',
        '-background',
        'none',
        '-extent',
        '3037x476',
        ...deterministicPng,
        output.logoDark,
    ]);

    await runMagick([
        '-background',
        'none',
        '-density',
        '384',
        output.logoWhite,
        '-resize',
        '3037x476',
        '-gravity',
        'center',
        '-background',
        'none',
        '-extent',
        '3037x476',
        ...deterministicPng,
        output.logoLight,
    ]);

    await runMagick([
        trimmedMark,
        '-resize',
        '580x580',
        '-gravity',
        'center',
        '-background',
        '#FBF3EF',
        '-extent',
        '694x694',
        ...deterministicPng,
        output.mark,
    ]);

    await runMagick([
        trimmedMark,
        '-resize',
        '440x440',
        '-gravity',
        'center',
        '-background',
        '#FBF3EF',
        '-extent',
        '512x512',
        ...deterministicPng,
        output.pwa512,
    ]);

    await runMagick([
        trimmedMark,
        '-resize',
        '384x384',
        '-gravity',
        'center',
        '-background',
        '#FBF3EF',
        '-extent',
        '512x512',
        ...deterministicPng,
        output.pwa512Maskable,
    ]);

    await runMagick([
        trimmedMark,
        '-resize',
        '160x160',
        '-gravity',
        'center',
        '-background',
        '#FBF3EF',
        '-extent',
        '192x192',
        ...deterministicPng,
        output.pwa192,
    ]);

    await runMagick([
        trimmedMark,
        '-resize',
        '150x150',
        '-gravity',
        'center',
        '-background',
        '#FBF3EF',
        '-extent',
        '180x180',
        ...deterministicPng,
        output.appleTouch,
    ]);

    await runMagick([
        trimmedMark,
        '-resize',
        '28x28',
        '-gravity',
        'center',
        '-background',
        '#FBF3EF',
        '-extent',
        '32x32',
        ...deterministicPng,
        output.favicon,
    ]);

    await runMagick([
        source.cover,
        '-resize',
        '1200x630',
        '-gravity',
        'center',
        '-background',
        '#FBF3EF',
        '-extent',
        '1200x630',
        ...deterministicPng,
        output.ogLogo,
    ]);

    console.log('Generated ChewnPour brand assets from Chewnpour-logo/.');
} finally {
    await rm(tempRoot, { recursive: true, force: true });
}
