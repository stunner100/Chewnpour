import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSitemapXml, courseCodeSlug } from '../server/publicPastPapers.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFile(path.join(root, rel), 'utf8');

assert.equal(courseCodeSlug('BIOL 101'), 'biol101');
assert.equal(courseCodeSlug(' csc  201 '), 'csc201');

const xml = buildSitemapXml([{ slug: 'biol101' }, { slug: 'biol101' }, { slug: 'math151' }]);
assert.match(xml, /<loc>https:\/\/www\.chewnpour\.com<\/loc>/);
assert.match(xml, /<loc>https:\/\/www\.chewnpour\.com\/past-questions\/biol101<\/loc>/);
assert.equal((xml.match(/past-questions\/biol101/g) || []).length, 1, 'course pages are listed once');
assert.doesNotMatch(xml, /dashboard|admin/, 'private pages stay out of the sitemap');

const [publicApi, router, vercel, robots, app, page, upload, share, funnel] = await Promise.all([
    read('server/publicPastPapers.js'),
    read('api/router.js'),
    read('vercel.json'),
    read('public/robots.txt'),
    read('src/App.jsx'),
    read('src/pages/PublicPastQuestions.jsx'),
    read('src/pages/UploadMaterials.jsx'),
    read('src/components/ShareWithClassButton.jsx'),
    read('src/lib/funnelEvents.js'),
]);

// Public API: published papers only, and never file names, sizes or links.
assert.match(publicApi, /WHERE status = 'published'/);
const publicFields = publicApi.slice(publicApi.indexOf('papers: papers.map'), publicApi.indexOf('export const buildSitemapXml'));
assert.doesNotMatch(publicFields, /fileName|fileSize|fileType|storage|url/i, 'public paper rows carry no file details');
assert.match(router, /pathname === "\/api\/sitemap"[\s\S]*handlePublicPastPapersRequest/);
assert.ok(
    JSON.parse(vercel).rewrites.some((rule) => rule.source === '/sitemap.xml' && rule.destination === '/api/router?__path=sitemap'),
    '/sitemap.xml is served by the API',
);
assert.match(robots, /Disallow: \/dashboard/);
assert.match(robots, /Sitemap: https:\/\/www\.chewnpour\.com\/sitemap\.xml/);
assert.match(app, /path="\/past-questions" element=\{withSuspense\(<PublicPastQuestions \/>\)\}/);
assert.match(app, /path="\/past-questions\/:courseCode" element=\{withSuspense\(<PublicPastQuestions \/>\)\}/);
assert.ok(app.indexOf('path="/past-questions"') < app.indexOf('<ProtectedRoute'), 'public past questions sit outside the protected routes');
assert.match(page, /to=\{signedIn \? '\/dashboard\/past-questions' : '\/signup'\}/);

// Share with class on the course-ready card.
assert.match(upload, /<ShareWithClassButton courseId=\{readyCourse\.courseId\}/);
assert.match(share, /\/api\/courses\/\$\{encodeURIComponent\(courseId\)\}\/share/);
assert.match(share, /navigator\.share/);
assert.ok(funnel.includes("'course_shared'"));

console.log('share-and-public-past-papers regression passed');
