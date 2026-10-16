import assert from 'node:assert/strict';
import {
    cleanDisplayLine,
    normalizeLessonContent,
} from '../src/lib/topicContentFormatting.js';

// cleanDisplayLine: single-line display text (titles, passages).
assert.equal(cleanDisplayLine('**Key Term** : \\[retrieval\\] system'), 'Key Term : retrieval system');
assert.equal(cleanDisplayLine('*Simple* [example] _text_ with **markers**'), 'Simple example text with markers');
assert.equal(cleanDisplayLine('P E R F O R M A N C E R E P O R T'), 'Performance Report', 'spaced OCR headings are joined');
assert.equal(cleanDisplayLine('P E R F O R M A N C E R E P'), 'Performance Report', 'clipped spaced OCR headings are joined');

// normalizeLessonContent: escapes and whitespace only; markdown structure is untouched.
const lesson = [
    '## The Idea',
    '',
    'If x > y the function rises. Glucose -> pyruvate -> ATP.',
    'Use @Override and email admin@uni.edu. The idea is that cells divide.',
    '',
    '### Size comparison',
    '',
    '| Cell | Size |',
    '|---|---|',
    '| Prokaryote | 1-5 um |',
    '',
    '```python',
    'for n in range(3):',
    '    print(n)  # 20',
    '```',
].join('\n');
assert.equal(normalizeLessonContent(lesson), lesson, 'well-formed markdown passes through unchanged');

assert.equal(
    normalizeLessonContent('### Key Ideas\\n\\n- one\\n- two'),
    '### Key Ideas\n\n- one\n- two',
    'double-escaped newlines from JSON become real newlines',
);
assert.equal(
    normalizeLessonContent('The gradient \\nabla f and \\neq and \\theta stay.'),
    'The gradient \\nabla f and \\neq and \\theta stay.',
    'LaTeX commands are left alone',
);
assert.equal(normalizeLessonContent('a\r\nb c​\n\n\n\nd   '), 'a\nb c\n\nd', 'line endings, spaces and blank runs are tidied');
assert.equal(normalizeLessonContent(null), '');

console.log('topic-content-readability tests passed');
