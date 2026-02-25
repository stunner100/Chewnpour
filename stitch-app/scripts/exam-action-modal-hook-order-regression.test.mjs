import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const targetPath = path.join(root, 'src', 'components', 'ExamActionModal.jsx');
const source = await fs.readFile(targetPath, 'utf8');

const earlyReturnIndex = source.indexOf('if (!isOpen || !attempt) return null;');
if (earlyReturnIndex === -1) {
  throw new Error('Expected ExamActionModal to guard closed state with an early return.');
}

const trailingSource = source.slice(earlyReturnIndex);
if (/use(?:State|Effect|Memo|Callback|Ref)\s*\(/.test(trailingSource)) {
  throw new Error(
    'Regression detected: a React hook is declared after the ExamActionModal early return.'
  );
}

console.log('exam-action-modal-hook-order-regression.test.mjs passed');
