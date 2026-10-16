// topics.lesson: validation of model output, conversion of markdown lessons
// (mirrored by the topic-lesson migration), and the markdown view used by
// prompts and the lesson page.
import assert from 'node:assert/strict';
import {
    LESSON_ROLES,
    lessonFromMarkdown,
    lessonToMarkdown,
    normalizeLesson,
    roleForSectionTitle,
} from '../src/lib/lessonSchema.js';

const body = (text) => `${text} This sentence pads the section past the minimum length.`;

assert.deepEqual(LESSON_ROLES, ['core', 'steps', 'example', 'misconception', 'practice']);

// normalizeLesson: roles, required core, dropped sections, recap and word bank.
{
    const lesson = normalizeLesson({
        hook: '  Antibiotics work because bacteria are built differently.  ',
        sections: [
            { title: 'Where a prokaryote keeps its DNA', role: 'core', body: body('DNA sits in the nucleoid.'), sourceQuote: 'their DNA sits in a region called the nucleoid' },
            { title: 'Bacteria vs. a yeast cell', role: 'example', body: body('E. coli is a prokaryote.') },
            { title: 'Too short', role: 'core', body: 'Nope.' },
            { title: 'where a prokaryote keeps its DNA', role: 'core', body: body('Duplicate title.') },
            { title: 'Word Bank', role: 'core', body: body('- **Term**: def') },
            { title: 'Quick Check', role: 'core', body: body('Q and A.') },
            { title: 'Odd role', role: 'summary', body: body('Unknown roles become core.') },
        ],
        recap: [
            { prompt: 'Where is DNA in a prokaryote?', answer: 'In the nucleoid.' },
            { prompt: 'Short?', answer: 'Dropped: prompt under 8 characters.' },
            { prompt: 'No answer given here', answer: '' },
        ],
        wordBank: [
            { term: '**Nucleoid**', definition: 'the region that holds prokaryotic DNA' },
            { term: 'nucleoid', definition: 'duplicate term' },
            { term: 'Cell', definition: 'x' },
        ],
    });
    assert.equal(lesson.hook, 'Antibiotics work because bacteria are built differently.');
    assert.deepEqual(lesson.sections.map((section) => [section.title, section.role]), [
        ['Where a prokaryote keeps its DNA', 'core'],
        ['Bacteria vs. a yeast cell', 'example'],
        ['Odd role', 'core'],
    ]);
    assert.equal(lesson.sections[0].sourceQuote, 'their DNA sits in a region called the nucleoid');
    assert.deepEqual(lesson.recap, [{ prompt: 'Where is DNA in a prokaryote?', answer: 'In the nucleoid.' }]);
    assert.deepEqual(lesson.wordBank, [{ term: 'Nucleoid', definition: 'the region that holds prokaryotic DNA' }]);
}

// A lesson with no core section gets its first section promoted to core.
{
    const lesson = normalizeLesson({
        sections: [
            { title: 'Try a loop', role: 'practice', body: body('Write a loop.') },
            { title: 'A worked loop', role: 'example', body: body('for n in range(3).') },
        ],
    });
    assert.deepEqual(lesson.sections.map((section) => section.role), ['core', 'example']);
}

// Unusable payloads.
assert.equal(normalizeLesson(null), null);
assert.equal(normalizeLesson({ sections: [{ title: 'x', role: 'core', body: 'short' }] }), null);
assert.equal(normalizeLesson({ sections: [{ title: 'One', role: 'core', body: body('Only one.') }] }, { minSections: 2 }), null);
assert.equal(
    normalizeLesson({ sections: Array.from({ length: 9 }, (_, i) => ({ title: `Part ${i}`, role: 'core', body: body(`Part ${i}.`) })) }).sections.length,
    6,
    'at most six sections',
);

// Old template titles map to roles.
assert.equal(roleForSectionTitle('The Steps'), 'steps');
assert.equal(roleForSectionTitle('Worked Example'), 'example');
assert.equal(roleForSectionTitle('Traps and Mistakes'), 'misconception');
assert.equal(roleForSectionTitle('Use It'), 'practice');
assert.equal(roleForSectionTitle('Causal Chain'), 'core');

// lessonFromMarkdown -> lessonToMarkdown keeps sections and the word bank.
{
    const markdown = [
        '## The Steps', '', '1. Assign oxidation numbers.', '2. Balance electrons.', '',
        '## Worked Example', '', '```python', '# not a heading', 'print(1)', '```', '',
        '## Word Bank', '', '- **Oxidation**: loss of electrons', '- Reduction — gain of electrons',
    ].join('\n');
    const lesson = lessonFromMarkdown(markdown);
    assert.deepEqual(lesson.sections.map((section) => [section.title, section.role]), [['The Steps', 'core'], ['Worked Example', 'example']],
        'with no core section, the first section is promoted');
    assert.deepEqual(lesson.wordBank, [
        { term: 'Oxidation', definition: 'loss of electrons' },
        { term: 'Reduction', definition: 'gain of electrons' },
    ]);
    const roundTrip = lessonFromMarkdown(lessonToMarkdown(lesson));
    assert.deepEqual(roundTrip.sections.map((section) => section.body), lesson.sections.map((section) => section.body));
    assert.deepEqual(roundTrip.wordBank, lesson.wordBank);
}

assert.equal(
    lessonToMarkdown({
        hook: 'Why it matters.',
        sections: [{ title: 'A', role: 'core', body: 'Body A.' }],
        recap: [{ prompt: 'What is A?', answer: 'A letter.' }],
        wordBank: [{ term: 'A', definition: 'first letter' }],
    }),
    'Why it matters.\n\n## A\n\nBody A.\n\n## Recap\n\n- What is A? A letter.\n\n## Word Bank\n\n- **A**: first letter',
);
assert.equal(lessonToMarkdown(null), '');

console.log('lesson-schema-regression.test.mjs passed');
