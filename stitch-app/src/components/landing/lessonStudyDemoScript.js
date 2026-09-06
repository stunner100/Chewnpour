// Edit lesson-study demo copy and timing here.
// The landing AI section reads these values only. No network calls.

export const STUDY_HIGHLIGHT = 'short-term store that holds information';

export const STUDY_LESSON_BODY =
  'Working memory is the short-term store that holds information while you process it during study. It is limited, so lessons chunk ideas and ask you to retrieve them before they fade.';

export const STUDY_QUESTION = 'Explain this in simpler terms';

export const STUDY_ANSWER =
  'Think of working memory like a small desk in your mind. You can keep a few things on the desk while you work with them, but if too much is added at once, some information gets pushed off.';

export const STUDY_EXAMPLE =
  'For example, when solving 27 + 18 in your head, working memory temporarily holds the numbers while you calculate.';

export const STUDY_MINI_QUESTION = 'Which example best describes working memory?';

export const STUDY_MINI_OPTIONS = [
  'Remembering your childhood home',
  'Holding a phone number in mind while typing it',
  "Recognising someone's face",
];

export const STUDY_MINI_CORRECT = 1;

export const STUDY_MINI_EXPLAIN =
  "Working memory temporarily holds information while you're actively using it.";

export const STUDY_QUIZ = {
  title: 'Working Memory',
  progress: 'Question 1 of 5',
  prompt: 'What is the main purpose of working memory?',
  options: [
    'Store memories permanently',
    'Temporarily hold and manipulate information',
    'Control long-term memories',
    'Record sensory information',
  ],
};

export const STUDY_TARGETS = {
  idle: { x: 520, y: 240 },
  phrase: { x: 508, y: 248 },
  askTutor: { x: 548, y: 292 },
  composer: { x: 980, y: 608 },
  send: { x: 1064, y: 608 },
  testMe: { x: 972, y: 470 },
  choiceB: { x: 980, y: 428 },
  startQuiz: { x: 820, y: 138 },
};

export const STUDY_TIMING = {
  idleMs: 1500,
  moveToPhraseMs: 720,
  selectMs: 280,
  askRevealMs: 260,
  moveToAskMs: 420,
  clickMs: 140,
  tutorOpenMs: 380,
  typeCharMinMs: 34,
  typeCharMaxMs: 50,
  afterTypePauseMs: 220,
  moveToSendMs: 280,
  thinkingMs: 780,
  streamWordMs: 30,
  examplePauseMs: 280,
  afterAnswerMs: 320,
  moveToTestMs: 520,
  miniPauseMs: 420,
  moveToChoiceBMs: 360,
  selectAnswerMs: 380,
  correctHoldMs: 720,
  moveToQuizMs: 680,
  quizHoldMs: 1500,
  resetMs: 640,
  cursorSpring: { stiffness: 92, damping: 18, mass: 0.7 },
};

export const STUDY_ANSWER_WORDS = STUDY_ANSWER.split(' ');
export const STUDY_EXAMPLE_WORDS = STUDY_EXAMPLE.split(' ');
