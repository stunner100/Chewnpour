import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/components/topic/TopicLessonViews.jsx'), 'utf8');

const requireIncludes = (snippet, label) => {
    if (!source.includes(snippet)) {
        throw new Error(`Expected TopicLessonViews.jsx to include ${label}.`);
    }
};

const requireExcludes = (snippet, label) => {
    if (source.includes(snippet)) {
        throw new Error(`Regression detected: TopicLessonViews.jsx should not include ${label}.`);
    }
};

requireIncludes('const askTutor = useAction(api.ai.askTopicTutor);', 'inline assistant tutor action');
requireIncludes("const messages = useQuery(api.topicChat.getMessages, topicId ? { topicId } : 'skip');", 'inline assistant chat history query');
requireIncludes('await askTutor({ topicId, question });', 'inline assistant send call');
requireIncludes('Preparing an answer...', 'inline assistant pending response state');
requireIncludes('max-h-[calc(100vh-8rem)] min-h-0 flex-col', 'viewport-bounded inline assistant card');
requireIncludes('min-h-0 flex-1 space-y-space-3 overflow-y-auto', 'scrolling inline assistant transcript area');
requireIncludes('<TopicStudyAssistantCard\n                        topicId={topicId}', 'topic id passed into inline assistant');
requireExcludes('onAsk={handleAskTutor}\n                        onOpen={openChat}', 'desktop assistant opening side panel on submit');

console.log('topic-study-assistant-inline-regression.test.mjs passed');
