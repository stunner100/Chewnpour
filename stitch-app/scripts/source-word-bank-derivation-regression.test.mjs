import assert from 'node:assert/strict';

const { deriveSourceGroundedWordBank } = await import('../convex/lib/sourceWordBank.js');

const contentGraph = {
  title: 'Understanding Akoma Payments',
  description: 'Akoma helps merchants digitize mobile money collections and withdrawals.',
  keyPoints: [
    'Akoma wallet stores merchant cash collections from mobile money orders.',
    'Instant withdrawal sends available merchant balances to bank accounts.',
    'Credit scoring uses transaction history before approving merchant advances.',
    'Settlement dashboard shows order totals, failed payments, refunds, and balances.',
    'Mandatory service fees reduce the amount deposited after each transaction.',
  ],
  subtopics: [
    'Akoma wallet',
    'Instant withdrawal',
    'Credit scoring',
    'Settlement dashboard',
    'Mandatory service fees',
    'Merchant float',
  ],
  definitions: [],
  examples: [],
  formulas: [],
  likelyConfusions: [],
  learningObjectives: [],
  sourcePages: [1],
  sourceBlockIds: ['p1'],
  sourcePassages: [
    {
      passageId: 'p1',
      page: 1,
      sectionHint: 'Operations overview',
      text: [
        'Akoma wallet stores merchant cash collections from mobile money orders before settlement.',
        'Instant withdrawal sends available merchant balances to bank accounts within minutes.',
        'Credit scoring uses transaction history before approving merchant advances.',
        'Settlement dashboard shows order totals, failed payments, refunds, and balances.',
        'Mandatory service fees reduce the amount deposited after each transaction.',
        'Merchant float is the available balance a seller can withdraw or use for refunds.',
      ].join(' '),
    },
  ],
};

const entries = deriveSourceGroundedWordBank({
  title: contentGraph.title,
  description: contentGraph.description,
  keyPoints: contentGraph.keyPoints,
  topicContext: contentGraph.sourcePassages[0].text,
  contentGraph,
  existingDefinitions: [],
  limit: 8,
});

assert.ok(entries.length >= 6, `Expected at least 6 source-grounded Word Bank entries, received ${entries.length}.`);

const terms = entries.map((entry) => entry.term.toLowerCase());
for (const expected of [
  'akoma wallet',
  'instant withdrawal',
  'credit scoring',
  'settlement dashboard',
  'mandatory service fees',
  'merchant float',
]) {
  assert.ok(terms.includes(expected), `Expected derived Word Bank to include "${expected}".`);
}

for (const entry of entries) {
  assert.ok(entry.meaning.split(/\s+/).length >= 4, `Definition for "${entry.term}" is too short.`);
  assert.ok(entry.meaning.split(/\s+/).length <= 28, `Definition for "${entry.term}" is too long.`);
  assert.doesNotMatch(entry.term, /^(?:analy[sz]e|address(?:ing)?|concerns?|explain|understand)\b/i);
  assert.doesNotMatch(entry.meaning, /important ideas? used in this topic|one of the important|used in this topic/i);
}

console.log('source-word-bank-derivation-regression.test.mjs passed');
