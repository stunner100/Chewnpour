import assert from 'node:assert/strict';
import {
    isDoctraSupportedMimeType,
    isDoctraSupportedUploadFileType,
    parseDoctraExtractionPayload,
} from '../convex/lib/doctraExtraction.js';

assert.equal(isDoctraSupportedMimeType('application/pdf'), true);
assert.equal(
    isDoctraSupportedMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    true
);
assert.equal(isDoctraSupportedMimeType('image/png'), false);

assert.equal(isDoctraSupportedUploadFileType('pdf'), true);
assert.equal(isDoctraSupportedUploadFileType('docx'), true);
assert.equal(isDoctraSupportedUploadFileType('pptx'), false);

assert.equal(
    parseDoctraExtractionPayload({ text: 'Line 1\r\n\r\n\r\nLine 2' }),
    'Line 1\nLine 2'
);

assert.equal(
    parseDoctraExtractionPayload({ data: { extractedText: 'Nested text' } }),
    'Nested text'
);

assert.equal(
    parseDoctraExtractionPayload({ result: [{ output: { content: 'Array nested text' } }] }),
    'Array nested text'
);

assert.equal(
    parseDoctraExtractionPayload({ unrecognized: 42 }),
    ''
);

console.log('doctra-extraction-regression tests passed');
