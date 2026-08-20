import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/pages/AIStudyTutor.jsx'), 'utf8');
const surfaceSource = await fs.readFile(path.join(root, 'src/components/tutor/TutorChatSurface.jsx'), 'utf8');
const workerSource = await fs.readFile(path.join(root, 'src/components/tutor/StudyWorkerChat.jsx'), 'utf8');
const sessionSource = await fs.readFile(path.join(root, 'src/lib/studyWorkerSession.js'), 'utf8');
const topicPanelSource = await fs.readFile(path.join(root, 'src/components/TopicChatPanel.jsx'), 'utf8');
const messageRowSource = await fs.readFile(path.join(root, 'src/components/tutor/TutorMessageRow.jsx'), 'utf8');
const tutorAvatarSource = await fs.readFile(path.join(root, 'src/components/tutor/TutorAvatar.jsx'), 'utf8');
const peepsSpriteSource = await fs.readFile(path.join(root, 'src/lib/peepsSprite.js'), 'utf8');
const typingIndicatorSource = await fs.readFile(path.join(root, 'src/components/tutor/TutorTypingIndicator.jsx'), 'utf8');
const promptInputSource = await fs.readFile(path.join(root, 'src/components/ai-elements/prompt-input.jsx'), 'utf8');
const combinedSource = `${source}\n${surfaceSource}\n${workerSource}\n${sessionSource}\n${topicPanelSource}\n${messageRowSource}\n${tutorAvatarSource}\n${peepsSpriteSource}\n${typingIndicatorSource}`;

const requireIncludes = (snippet, label) => {
  if (!combinedSource.includes(snippet)) {
    throw new Error(`AI tutor chat UX should keep ${label}: ${snippet}`);
  }
};

const requireIncludesIn = (fileSource, snippet, label) => {
  if (!fileSource.includes(snippet)) {
    throw new Error(`AI tutor chat UX should keep ${label}: ${snippet}`);
  }
};

const requireExcludesIn = (fileSource, snippet, label) => {
  if (fileSource.includes(snippet)) {
    throw new Error(`AI tutor chat UX should avoid ${label}: ${snippet}`);
  }
};

const requireExcludes = (snippet, label) => {
  if (combinedSource.includes(snippet)) {
    throw new Error(`AI tutor chat UX should avoid ${label}: ${snippet}`);
  }
};

requireIncludes("from 'eve/react'", 'eve React study-worker hook');
requireIncludes('useEveAgent', 'durable study-worker session');
requireIncludes("role: message.role === 'user' ? 'user' : 'assistant'", 'user and assistant transcript roles');
requireIncludes("agent.status === 'submitted' || agent.status === 'streaming'", 'derived tutor busy state');
requireIncludes("'AI Tutor conversation'", 'conversation region label');
requireIncludesIn(surfaceSource, "messageId=\"course-badge\"", 'course badge stays available on desktop');
requireIncludesIn(surfaceSource, "'max-md:hidden'", 'course badge must not steal phone transcript height');

requireIncludes('MessageScrollerProvider', 'message scroller provider');
requireIncludes('autoScroll', 'live-edge follow output');
requireIncludes('defaultScrollPosition={defaultScrollPosition}', 'context-aware opening scroll position');
requireIncludes('const hasUserScrollAnchor = messages.some((message) => message.role === \'user\');', 'detect user turn anchors');
requireIncludes("const defaultScrollPosition = hasUserScrollAnchor ? 'last-anchor' : 'start';", 'start at top without user anchors');
requireIncludes('scrollPreviousItemPeek={64}', 'previous turn context peek');
requireIncludes('MessageScrollerItem', 'transcript row boundaries');
requireIncludes('scrollAnchor={message.role === \'user\'}', 'user-turn scroll anchors');
requireExcludes('MessageScrollerButton', 'clipped jump-to-latest control over the composer');
requireIncludes('scrollerKey={topicId}', 'topic-scoped scroller reset');
requireIncludes('aria-busy={isTyping || undefined}', 'streaming busy state on transcript');

requireExcludes('messagesContainerRef', 'manual message container ref');
requireExcludes('responseAnchorRef', 'manual response anchor ref');
requireExcludes('questionAnchorRef', 'manual question anchor ref');
requireExcludes('scrollIntoView({', 'manual scrollIntoView anchoring');
requireExcludes("block: 'start'", 'manual viewport-start scroll anchoring');
requireExcludes('top: messagesContainer.scrollHeight', 'bottom-anchored response scrolling');

requireIncludesIn(topicPanelSource, 'StudyWorkerChat', 'topic panel shared study worker');
requireIncludesIn(workerSource, 'scrollerKey={topicId}', 'topic panel scroller reset');

requireIncludes('const TutorContextLoading = ({ topicTitle }) => (', 'named context loading state');
requireIncludes('role="status" aria-live="polite"', 'polite loading status');
requireIncludes('Loading tutor context...', 'visible context loading copy');
requireIncludes("Getting the latest chat for {topicTitle || 'this lesson'}.", 'specific context loading copy');
requireExcludes('h-16 rounded-2xl bg-surface-soft ml-auto w-2/3', 'anonymous user-message skeleton');
requireExcludes('h-28 rounded-2xl bg-ai-subtle w-3/4', 'anonymous assistant-message skeleton');
requireExcludesIn(messageRowSource, 'rounded-tl-sm', 'asymmetric assistant bubble tail');
requireExcludesIn(messageRowSource, 'rounded-tr-sm', 'asymmetric user bubble tail');
requireExcludesIn(messageRowSource, 'variant="ghost"', 'ghost bubble override in tutor chat');
requireIncludes('variant="default"', 'primary bubble for user messages');
requireIncludes('variant="muted"', 'muted bubble for tutor messages');
requireIncludes('bg-surface-soft dark:bg-surface-hover-dark', 'visible tutor bubble surface on dark theme');
requireIncludes('rounded-2xl', 'chat-friendly bubble corners for multi-line replies');
requireExcludesIn(messageRowSource, 'rounded-full', 'pill bubbles that dome on long replies');
requireIncludes('StudentAvatar', 'student avatar on outgoing tutor messages');

requireIncludes('inputAriaLabel={`Ask AI Tutor a question about ${selectedTopicOption.title || \'this lesson\'}`}', 'textarea accessible label');
requireIncludes('TutorChatMessages', 'shadcn ai-elements tutor message surface');
requireIncludes('TutorChatComposer', 'shadcn ai-elements tutor composer');
requireIncludes('@/components/ui/message', 'shadcn radix message primitives');
requireIncludes('@/components/ui/bubble', 'shadcn radix bubble primitives');
requireIncludes('TutorMessageRow', 'shared tutor message row');
requireIncludes("TUTOR_AVATAR_IMAGE_SRC = '/images/peeps/tutor.png'", 'cropped peeps tutor avatar image');
requireIncludes('AvatarImage', 'radix avatar image for tutor peep');
requireExcludes('BotIcon', 'bot fallback avatar icon');
requireIncludes('TutorTypingIndicator', 'shadcn marker typing indicator');
requireIncludes('@/components/ui/marker', 'shadcn marker primitive for typing status');
requireIncludes('isTyping={isBusy}', 'sending-aware tutor typing state');
requireIncludes('className="shimmer', 'css shimmer typing animation');
requireIncludes('is typing...', 'tutor typing copy');
requireExcludes('@/components/ai-elements/shimmer', 'broken motion shimmer dependency for typing');
requireExcludes('Tutor is preparing an answer', 'legacy spinner typing copy');
requireExcludes('from \'@/components/ui/spinner\'', 'spinner-based tutor pending state');
requireIncludes('@/components/ai-elements/prompt-input', 'ai-elements prompt input');
requireIncludes('@/components/ui/message-scroller', 'shadcn message scroller primitives');
requireIncludesIn(messageRowSource, 'prompt.label || prompt.text || prompt.prompt', 'welcome chips must show label or text');
requireIncludesIn(messageRowSource, 'await onSuggestedPrompt?.(question)', 'welcome chips must send through the tutor submit path');
requireIncludesIn(surfaceSource, 'await (onSuggestedPrompt || onSubmit)(question)', 'composer chips must reuse the submit path');
requireIncludesIn(source, 'suggestedPrompts={suggestedPrompts}', 'dedicated tutor welcome must show prompt chips');
requireIncludesIn(workerSource, 'showComposerSuggestions && messageList.length > 0 ? suggestedPrompts : []', 'dedicated tutor composer chips only after the first turn');
requireIncludesIn(surfaceSource, 'void Promise.resolve(onSubmit(question))', 'composer must clear before the tutor stream finishes');
requireIncludesIn(surfaceSource, 'controller.textInput.clear()', 'explicit send path must clear the draft immediately');
requireExcludesIn(surfaceSource, 'await onSubmit(question)', 'composer must not hold the draft until the tutor turn completes');
requireIncludesIn(surfaceSource, 'align="inline-end"', 'send control must sit in the same row as the draft');
requireIncludesIn(surfaceSource, 'type="button"', 'tutor send must not rely on native form submit');
requireIncludesIn(surfaceSource, 'submitText(event.currentTarget.value)', 'Enter must send the textarea DOM value');
requireIncludesIn(surfaceSource, 'readComposerDraft(controller, event.currentTarget)', 'send button must read the visible draft');
requireIncludesIn(surfaceSource, '[content-visibility:visible]', 'tutor rows must paint even when the scroller uses content-visibility');
requireIncludesIn(workerSource, 'mergePendingTutorMessages', 'local pending user bubbles until eve echoes them');
requireIncludesIn(sessionSource, 'export const mergePendingTutorMessages', 'pending user messages merge helper');
requireIncludesIn(topicPanelSource, 'courseId={courseId}', 'lesson tutor must pass the course id to the study worker');
requireIncludesIn(topicPanelSource, 'setClearChat(() => nextClear || null)', 'clear-chat setter must store the handler as a value');
requireExcludesIn(topicPanelSource, 'onClearAvailable={setClearChat}', 'must not pass setState a function handler React would invoke as an updater');

{
  let stored;
  let cleared = false;
  const setClearChat = (next) => {
    stored = typeof next === 'function' ? next(stored) : next;
  };
  const handleClear = () => {
    cleared = true;
  };

  setClearChat(handleClear);
  if (!cleared) {
    throw new Error('React setState function-updater simulation should invoke a raw handler');
  }

  stored = undefined;
  cleared = false;
  const handleClearAvailable = (nextClear) => {
    setClearChat(() => nextClear || null);
  };
  handleClearAvailable(handleClear);
  if (stored !== handleClear) {
    throw new Error('clear-chat setter must store the handler instead of invoking it');
  }
  if (cleared) {
    throw new Error('storing the clear handler must not clear the chat');
  }
}
requireExcludesIn(surfaceSource, "paddingBottom: 'calc(1rem + var(--keyboard-inset, 0px))'", 'composer must not double-count the keyboard inset already applied by the panel');
requireIncludesIn(topicPanelSource, 'disclaimer="Enter to send · Shift+Enter for new line"', 'lesson tutor still documents Enter-to-send');
requireIncludesIn(promptInputSource, 'enterKeyHint = "send"', 'mobile keyboards must expose a Send action');
requireIncludesIn(promptInputSource, 'e.currentTarget.form || e.currentTarget.closest("form")', 'Enter must find the composer form even when textarea.form is missing');
requireIncludesIn(promptInputSource, 'controller.textInput.value || nativeText', 'submit must fall back to the textarea DOM value');
requireExcludesIn(promptInputSource, 'max-width: 768px', 'Enter must send on mobile viewports, not only the send button');
requireIncludesIn(promptInputSource, 'Chat composers send on Enter on every viewport', 'Enter-to-send must stay viewport-agnostic');

console.log('ai-tutor-chat-ux-regression.test.mjs passed');
