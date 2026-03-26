import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const helperPath = path.join(root, 'src', 'lib', 'questionBankDisplay.js');
const topicDetailPath = path.join(root, 'src', 'pages', 'TopicDetail.jsx');

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

if (await fileExists(helperPath)) {
  throw new Error('Regression detected: question-bank display helper should be removed after the Start Exam cutover.');
}

const topicDetailSource = await fs.readFile(topicDetailPath, 'utf8');
if (/questionBankDisplay/.test(topicDetailSource) || /essay questions ready so far/i.test(topicDetailSource)) {
  throw new Error('Regression detected: TopicDetail should not show question-bank readiness copy in the click-to-generate flow.');
}

console.log('question-bank-display-regression: ok');
