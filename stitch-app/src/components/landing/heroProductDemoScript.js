// Edit demo copy and timing here. The landing hero reads these values only.
// DEMO_QUESTION — student input. DEMO_ANSWER — streamed tutor reply.
// DEMO_TIMING — loop pacing. DEMO_TARGETS — cursor fallbacks if DOM measure fails.

export const DEMO_QUESTION = 'Can you explain working memory in simple terms?';

export const DEMO_ANSWER =
  "Working memory is your brain's temporary workspace. It holds information for a short time while you use it — like remembering a phone number long enough to type it or keeping part of a sentence in mind while reading.";

export const DEMO_LESSON = {
  title: 'Working Memory',
  duration: '5 min lesson',
  summary:
    'Working memory is the system your brain uses to temporarily hold and manipulate information.',
  source: 'Lesson generated from your materials',
  sections: [
    'What is working memory?',
    'How working memory works',
    'Real-world examples',
    'Quick knowledge check',
  ],
  cta: 'Start lesson',
};

export const DEMO_GENERATE_STAGES = [
  'Understanding material',
  'Structuring key concepts',
  'Generating examples',
  'Creating practice questions',
];

export const DEMO_STAGE_WIDTH = 1120;

export const DEMO_TARGETS = {
  idle: { x: 560, y: 292 },
  tutorNav: { x: 118, y: 408 },
  composer: { x: 690, y: 628 },
  send: { x: 1026, y: 628 },
  generate: { x: 412, y: 478 },
};

export const DEMO_TIMING = {
  idleMs: 1500,
  moveToTutorMs: 980,
  tutorHoverMs: 180,
  clickMs: 140,
  tutorOpenMs: 720,
  moveToComposerMs: 680,
  typeCharMinMs: 34,
  typeCharMaxMs: 52,
  afterTypePauseMs: 320,
  thinkingMs: 860,
  streamWordMs: 32,
  afterAnswerMs: 420,
  moveToGenerateMs: 760,
  stageMs: 620,
  lessonRevealMs: 520,
  lessonHoldMs: 2000,
  resetMs: 720,
  cursorSpring: { stiffness: 92, damping: 18, mass: 0.7 },
};

export const typeDelayForIndex = (index) => {
  const span = DEMO_TIMING.typeCharMaxMs - DEMO_TIMING.typeCharMinMs;
  return DEMO_TIMING.typeCharMinMs + ((index * 17) % (span + 1));
};

export const DEMO_ANSWER_WORDS = DEMO_ANSWER.split(' ');
