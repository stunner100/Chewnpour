import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/pages/AIStudyTutor.jsx'), 'utf8');
const surfaceSource = await fs.readFile(path.join(root, 'src/components/tutor/TutorChatSurface.jsx'), 'utf8');
const topicPanelSource = await fs.readFile(path.join(root, 'src/components/TopicChatPanel.jsx'), 'utf8');
const messageRowSource = await fs.readFile(path.join(root, 'src/components/tutor/TutorMessageRow.jsx'), 'utf8');
const tutorAvatarSource = await fs.readFile(path.join(root, 'src/components/tutor/TutorAvatar.jsx'), 'utf8');
const peepsSpriteSource = await fs.readFile(path.join(root, 'src/lib/peepsSprite.js'), 'utf8');
const typingIndicatorSource = await fs.readFile(path.join(root, 'src/components/tutor/TutorTypingIndicator.jsx'), 'utf8');
const combinedSource = `${source}\n${surfaceSource}\n${topicPanelSource}\n${messageRowSource}\n${tutorAvatarSource}\n${peepsSpriteSource}\n${typingIndicatorSource}`;

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

requireIncludes('const [pendingExchange, setPendingExchange] = useState(null);', 'optimistic pending exchange state');
requireIncludes('const displayMessages = useMemo(() => {', 'derived display messages');
requireIncludes("role: 'user',", 'optimistic user message role');
requireIncludes('const isTyping = Boolean(pendingExchangeForTopic && !pendingServerState.hasAssistant);', 'derived tutor typing state');
requireExcludes('pending: true', 'pending assistant bubble row');
requireIncludes("'AI Tutor conversation'", 'conversation region label');

requireIncludes('MessageScrollerProvider', 'message scroller provider');
requireIncludes('autoScroll', 'live-edge follow output');
requireIncludes('defaultScrollPosition={defaultScrollPosition}', 'context-aware opening scroll position');
requireIncludes('const hasUserScrollAnchor = messages.some((message) => message.role === \'user\');', 'detect user turn anchors');
requireIncludes("const defaultScrollPosition = hasUserScrollAnchor ? 'last-anchor' : 'start';", 'start at top without user anchors');
requireIncludes('scrollPreviousItemPeek={64}', 'previous turn context peek');
requireIncludes('MessageScrollerItem', 'transcript row boundaries');
requireIncludes('scrollAnchor={message.role === \'user\'}', 'user-turn scroll anchors');
requireExcludes('MessageScrollerButton', 'clipped jump-to-latest control over the composer');
requireIncludes('scrollerKey={effectiveSelectedTopicId}', 'topic-scoped scroller reset');
requireIncludes('aria-busy={isTyping || undefined}', 'streaming busy state on transcript');

requireExcludes('messagesContainerRef', 'manual message container ref');
requireExcludes('responseAnchorRef', 'manual response anchor ref');
requireExcludes('questionAnchorRef', 'manual question anchor ref');
requireExcludes('scrollIntoView({', 'manual scrollIntoView anchoring');
requireExcludes("block: 'start'", 'manual viewport-start scroll anchoring');
requireExcludes('top: messagesContainer.scrollHeight', 'bottom-anchored response scrolling');
requireExcludes('}, [effectiveSelectedTopicId, messages, sending]);', 'sending-driven bottom auto-scroll');

requireIncludesIn(topicPanelSource, 'TutorChatMessages', 'topic panel shared tutor messages');
requireIncludesIn(topicPanelSource, 'scrollerKey={topicId}', 'topic panel scroller reset');

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

requireIncludes('inputAriaLabel={`Ask AI Tutor a question about ${selectedTopicOption?.title || \'this lesson\'}`}', 'textarea accessible label');
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
requireIncludes('const showTypingIndicator = sending || isTyping;', 'sending-aware tutor typing state');
requireIncludes('className="shimmer', 'css shimmer typing animation');
requireIncludes('is typing...', 'tutor typing copy');
requireExcludes('@/components/ai-elements/shimmer', 'broken motion shimmer dependency for typing');
requireExcludes('Tutor is preparing an answer', 'legacy spinner typing copy');
requireExcludes('from \'@/components/ui/spinner\'', 'spinner-based tutor pending state');
requireIncludes('@/components/ai-elements/prompt-input', 'ai-elements prompt input');
requireIncludes('@/components/ui/message-scroller', 'shadcn message scroller primitives');

console.log('ai-tutor-chat-ux-regression.test.mjs passed');
