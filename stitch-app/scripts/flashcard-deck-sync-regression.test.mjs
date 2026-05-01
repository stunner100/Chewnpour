import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const flashcardSource = await fs.readFile(
  path.join(root, 'src/components/FlashcardDeck.jsx'),
  'utf8',
);
const wordBankSource = await fs.readFile(
  path.join(root, 'src/components/InteractiveWordBank.jsx'),
  'utf8',
);

if (!/const starred = useMemo\(\(\) => new Set\(starredTerms \|\| \[\]\), \[starredTerms\]\);/.test(flashcardSource)) {
  throw new Error('Expected FlashcardDeck to derive its starred set directly from starredTerms.');
}

if (!/const next = new Set\(starred\);[\s\S]*if \(onTermsStarred\) onTermsStarred\(\[\.\.\.next\]\);/s.test(flashcardSource)) {
  throw new Error('Expected FlashcardDeck star toggles to publish updates through onTermsStarred.');
}

if (/key={`deck-\$\{starredTerms \? starredTerms\.length : 0\}`}/.test(wordBankSource)) {
  throw new Error('Expected InteractiveWordBank to stop relying on length-based remounts for flashcard sync.');
}

if (!/starredTerms=\{\[\.\.\.starred\]\}/.test(wordBankSource)) {
  throw new Error('Expected InteractiveWordBank to pass the current local starred state into FlashcardDeck.');
}

console.log('flashcard-deck-sync-regression.test.mjs passed');
