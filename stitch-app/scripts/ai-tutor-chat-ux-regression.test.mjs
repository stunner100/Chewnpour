import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/pages/AIStudyTutor.jsx'), 'utf8');
const surfaceSource = await fs.readFile(path.join(root, 'src/components/tutor/TutorChatSurface.jsx'), 'utf8');
const messageRowSource = await fs.readFile(path.join(root, 'src/components/tutor/TutorMessageRow.jsx'), 'utf8');
const tutorAvatarSource = await fs.readFile(path.join(root, 'src/components/tutor/TutorAvatar.jsx'), 'utf8');
const peepsSpriteSource = await fs.readFile(path.join(root, 'src/lib/peepsSprite.js'), 'utf8');
const typingIndicatorSource = await fs.readFile(path.join(root, 'src/components/tutor/TutorTypingIndicator.jsx'), 'utf8');
const combinedSource = `${source}\n${surfaceSource}\n${messageRowSource}\n${tutorAvatarSource}\n${peepsSpriteSource}\n${typingIndicatorSource}`;

const requireIncludes = (snippet, label) => {
  if (!combinedSource.includes(snippet)) {
    throw new Error(`AI tutor chat UX should keep ${label}: ${snippet}`);
  }
};

const requireExcludes = (snippet, label) => {
  if (combinedSource.includes(snippet)) {
    throw new Error(`AI tutor chat UX should avoid ${label}: ${snippet}`);
  }
};

requireIncludes('const messagesContainerRef = useRef(null);', 'message container ref');
requireIncludes('const responseAnchorRef = useRef(null);', 'response anchor ref');
requireIncludes('const [pendingExchange, setPendingExchange] = useState(null);', 'optimistic pending exchange state');
requireIncludes('const displayMessages = useMemo(() => {', 'derived display messages');
requireIncludes("role: 'user',", 'optimistic user message role');
requireIncludes('const isTyping = Boolean(pendingExchangeForTopic && !pendingServerState.hasAssistant);', 'derived tutor typing state');
requireExcludes('pending: true', 'pending assistant bubble row');
requireIncludes('scrollIntoView({', 'response-start scroll anchor');
requireIncludes("block: 'start'", 'response starts at top of viewport');
requireExcludes('top: messagesContainer.scrollHeight', 'bottom-anchored response scrolling');
requireExcludes('}, [effectiveSelectedTopicId, messages, sending]);', 'sending-driven bottom auto-scroll');
requireIncludes("'AI Tutor conversation'", 'conversation region label');

requireIncludes('const TutorContextLoading = ({ topicTitle }) => (', 'named context loading state');
requireIncludes('role="status" aria-live="polite"', 'polite loading status');
requireIncludes('Loading tutor context...', 'visible context loading copy');
requireIncludes("Getting the latest chat for {topicTitle || 'this lesson'}.", 'specific context loading copy');
requireExcludes('h-16 rounded-2xl bg-surface-soft ml-auto w-2/3', 'anonymous user-message skeleton');
requireExcludes('h-28 rounded-2xl bg-ai-subtle w-3/4', 'anonymous assistant-message skeleton');
requireIncludes('bg-ai-subtle dark:!bg-[#212226]', 'dark assistant bubble surface');
requireIncludes('bg-surface-muted', 'user bubble surface');
requireIncludes('dark:!bg-[#2a241c]', 'dark user bubble surface');

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

console.log('ai-tutor-chat-ux-regression.test.mjs passed');
