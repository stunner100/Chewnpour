// Checks that the SQL lesson converter in the topic-lesson migration produces
// exactly what lessonFromMarkdown (src/lib/lessonSchema.js) produces. Needs a
// local Postgres (see scripts/dev-local-db.mjs); the converter is loaded into
// pg_temp, so nothing is written to the database.
//
//   node scripts/topic-lesson-migration-parity.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { lessonFromMarkdown } from '../src/lib/lessonSchema.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_DB_URL = process.env.LOCAL_DATABASE_URL || 'postgres://postgres:localdev@127.0.0.1:54329/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(LOCAL_DB_URL).hostname)) {
    throw new Error('Refusing to use a non-local database.');
}

const migration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20261017120000_topic_lesson_column.sql'),
    'utf8',
);
const converter = migration
    .slice(migration.indexOf('-- BEGIN lesson converter'), migration.indexOf('-- END lesson converter'))
    .replace('public.chewnpour_markdown_to_lesson', 'pg_temp.chewnpour_markdown_to_lesson');

const fixtureDir = path.join(root, 'scripts', 'fixtures', 'lessons');
const fixtureIndex = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'index.json'), 'utf8'));
const krebs = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'fixtures', 'course-eval', 'krebs-cycle.payload.json'), 'utf8'));

const cases = [
    ...fixtureIndex.map((fixture) => ({
        name: fixture.file,
        title: fixture.title,
        markdown: fs.readFileSync(path.join(fixtureDir, fixture.file), 'utf8'),
    })),
    ...krebs.topics.filter((topic) => typeof topic.content === 'string').map((topic) => ({
        name: 'krebs', title: topic.title, markdown: topic.content,
    })),
    { name: 'empty', title: 'Empty', markdown: '' },
    { name: 'intro only', title: 'Cells', markdown: 'Cells are the unit of life and every organism has them.' },
    { name: 'title H1 merged into intro', title: 'Cells', markdown: 'Opening line before any heading here.\n\n# Cells\n\nCells are the unit of life.\n\n## The Idea\n\nCells have parts.' },
    { name: 'title H1 first', title: 'Cells', markdown: '# Cells\n\nCells are the unit of life.\n\n## The Idea\n\nCells have parts.' },
    { name: 'C# heading and closing hashes', title: 'Langs', markdown: '## C#\n\nC sharp is a language.\n\n## Title ##\n\nBody text.' },
    { name: 'code fence with # lines', title: 'Py', markdown: '## Worked Example\n\n```python\n# a comment\n## not a heading\nprint(1)\n```\n\n~~~\n# also code\n~~~\n\n## Use It\n\nTry it yourself.' },
    { name: 'escaped newlines and latex', title: 'Calc', markdown: '## The Idea\\n\\nThe gradient \\nabla f and \\neq stay.\\n- one\\n- two' },
    { name: 'skipped sections', title: 'S', markdown: '## Quick Check\n\n1. **Q:** What?\n   **A:** That.\n\n## Self-check\n\nThink about it.\n\n## Review Questions\n\n1. Why?\n\n## The Idea\n\nThe real content.' },
    {
        name: 'word bank formats',
        title: 'WB',
        markdown: '## The Idea\n\nBody.\n\n## Word Bank\n\n- **Osmosis**: water movement\n- **Diffusion:** spread of particles\n- **Nucleoid** — DNA region\n- **Ribosome** - makes protein\n- Mitosis: cell division\n- Meiosis — gamete formation\n- Cytokinesis - splitting\n* Vacuole: storage\n- no separator here\n- **Bold only**',
    },
    { name: 'glossary without terms stays a section', title: 'G', markdown: '## The Idea\n\nBody.\n\n## Glossary\n\nTerms are explained inline above.' },
    { name: 'no core role', title: 'P', markdown: '## Use It\n\nPractice this.\n\n## Worked Example\n\nAn example.' },
    { name: 'windows newlines and nbsp', title: 'W', markdown: '## The Idea  \r\n\r\n\r\n\r\nText with trailing spaces   \r\nand​ more.' },
];

const client = new pg.Client({ connectionString: LOCAL_DB_URL });
await client.connect();
try {
    await client.query(converter);
    for (const testCase of cases) {
        const { rows } = await client.query('SELECT pg_temp.chewnpour_markdown_to_lesson($1, $2) AS lesson', [testCase.markdown, testCase.title]);
        const expected = lessonFromMarkdown(testCase.markdown, { topicTitle: testCase.title });
        assert.deepEqual(rows[0].lesson, expected, `SQL and JS conversions differ for "${testCase.name}"`);
    }
} finally {
    await client.end();
}
console.log(`topic-lesson-migration-parity: ok (${cases.length} cases)`);
