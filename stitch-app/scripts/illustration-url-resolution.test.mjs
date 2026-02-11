import assert from 'node:assert/strict';
import { resolveIllustrationUrl } from '../convex/lib/illustrationUrl.js';

const tests = [
    async () => {
        let called = false;
        const url = await resolveIllustrationUrl({
            getUrl: async () => {
                called = true;
                return 'https://example.com/should-not-be-called';
            },
        });
        assert.equal(url, undefined, 'Expected undefined when no storage id is provided');
        assert.equal(called, false, 'Expected getUrl not to run without storage id');
    },
    async () => {
        const url = await resolveIllustrationUrl({
            illustrationStorageId: 'storage_1',
            getUrl: async (storageId) => `https://cdn.example.com/${storageId}`,
        });
        assert.equal(url, 'https://cdn.example.com/storage_1', 'Expected fresh signed URL to be returned');
    },
    async () => {
        const url = await resolveIllustrationUrl({
            illustrationStorageId: 'storage_2',
            getUrl: async () => null,
        });
        assert.equal(url, undefined, 'Expected undefined when storage URL cannot be resolved');
    },
    async () => {
        const url = await resolveIllustrationUrl({
            illustrationStorageId: 'storage_3',
            getUrl: async () => {
                throw new Error('temporary storage failure');
            },
        });
        assert.equal(url, undefined, 'Expected undefined when storage URL resolution throws');
    },
];

for (const run of tests) {
    await run();
}

console.log('illustration-url-resolution tests passed');
