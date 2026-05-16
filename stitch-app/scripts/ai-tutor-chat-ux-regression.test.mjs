import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/pages/AIStudyTutor.jsx'), 'utf8');

const requireIncludes = (snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`AI tutor chat UX should keep ${label}: ${snippet}`);
  }
};

const requireExcludes = (snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`AI tutor chat UX should avoid ${label}: ${snippet}`);
  }
};

requireIncludes('const messagesContainerRef = useRef(null);', 'message container ref');
requireIncludes('messagesContainer.scrollTo({', 'auto-scroll call');
requireIncludes('top: messagesContainer.scrollHeight', 'auto-scroll target');
requireIncludes('}, [effectiveSelectedTopicId, messages, sending]);', 'auto-scroll dependencies');
requireIncludes('aria-label="AI Tutor conversation"', 'conversation region label');

requireIncludes('const TutorContextLoading = ({ topicTitle }) => (', 'named context loading state');
requireIncludes('role="status" aria-live="polite"', 'polite loading status');
requireIncludes('Loading tutor context...', 'visible context loading copy');
requireIncludes("Getting the latest chat for {topicTitle || 'this lesson'}.", 'specific context loading copy');
requireExcludes('h-16 rounded-2xl bg-surface-soft ml-auto w-2/3', 'anonymous user-message skeleton');
requireExcludes('h-28 rounded-2xl bg-ai-subtle w-3/4', 'anonymous assistant-message skeleton');

requireIncludes("aria-label={`Ask AI Tutor a question about ${selectedTopicOption?.title || 'this lesson'}`}", 'textarea accessible label');
requireIncludes('aria-label="Send message to AI Tutor"', 'send button accessible label');

console.log('ai-tutor-chat-ux-regression.test.mjs passed');
