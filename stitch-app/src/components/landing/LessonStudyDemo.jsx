import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m as Motion, useReducedMotion } from 'motion/react';
import AppIcon from '../AppIcon';
import { TutorAvatarMark } from '../tutor/TutorAvatar';
import { BrowserFrame, ProductShell, ScaledStage } from './landingProductChrome';
import { DemoCursor, DemoStreamingText, DemoTypingDots } from './landingDemoShared';
import {
  PANE_EASE,
  useDemoInView,
  useFinePointer,
  useNarrowViewport,
} from './landingDemoRuntime';
import {
  STUDY_ANSWER_WORDS,
  STUDY_EXAMPLE_WORDS,
  STUDY_HIGHLIGHT,
  STUDY_LESSON_BODY,
  STUDY_MINI_EXPLAIN,
  STUDY_MINI_OPTIONS,
  STUDY_MINI_QUESTION,
  STUDY_QUESTION,
  STUDY_QUIZ,
} from './lessonStudyDemoScript';
import { useLessonStudyDemo } from './useLessonStudyDemo';

const [LESSON_BEFORE, LESSON_AFTER] = STUDY_LESSON_BODY.split(STUDY_HIGHLIGHT);
const TUTOR_OPEN_PHASES = [
  'openingTutor',
  'askingTutor',
  'aiThinking',
  'aiResponding',
  'miniQuiz',
  'answerCorrect',
];

const UserBubble = () => (
  <div className="ml-auto max-w-[92%] rounded-[16px] bg-[#111111] px-3 py-2 text-[12px] leading-5 text-white">
    {STUDY_QUESTION}
  </div>
);

const LessonColumn = ({ selected, showAsk, askPressed, quizPressed, compact }) => (
  <div className={`flex h-full min-w-0 flex-1 flex-col bg-[#F9F9F9] ${compact ? 'px-5 py-5' : 'px-8 py-6'}`}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[13px] text-[#6B6B70]">Cognitive Psychology</p>
        <h2 className="mt-1 font-display text-[28px] font-bold tracking-[-0.02em] text-[#0A0A0A]">
          Working memory
        </h2>
      </div>
      <span
        data-demo-target="startQuiz"
        className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#111111] px-5 text-[13px] font-semibold text-white transition-transform duration-150 ${
          quizPressed ? 'scale-[0.97]' : 'scale-100'
        }`}
      >
        <AppIcon name="quiz" className="text-[16px]" />
        Start quiz
      </span>
    </div>

    <p className="mt-4 max-w-[65ch] text-[15px] leading-7 text-[#6B6B70]">
      {LESSON_BEFORE}
      <mark
        data-demo-target="phrase"
        className={`rounded-[4px] bg-transparent px-0.5 text-inherit transition-colors duration-200 ${
          selected ? 'hero-demo-mark' : ''
        }`}
      >
        {STUDY_HIGHLIGHT}
      </mark>
      {LESSON_AFTER}
    </p>
    {showAsk ? (
      <span
        data-demo-target="askTutor"
        className={`mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-[#111111] px-3 text-[12px] font-semibold text-white shadow-sm transition-transform duration-150 ${
          askPressed ? 'scale-[0.97]' : 'scale-100'
        }`}
      >
        <TutorAvatarMark className="size-4 rounded-full" />
        Ask AI Tutor
      </span>
    ) : null}

    <div className="mt-6 rounded-[20px] border border-[#E5E5EA] bg-white p-5 shadow-sm">
      <p className="font-display text-[16px] font-bold text-[#0A0A0A]">Test this lesson</p>
      <p className="mt-1 text-[13px] text-[#6B6B70]">A short quiz on what you just read.</p>
      <span className="mt-4 inline-flex h-10 items-center rounded-full border border-[#E5E5EA] px-4 text-[13px] font-semibold text-[#0A0A0A]">
        Start quiz
      </span>
    </div>
  </div>
);

const TutorPanel = ({ demo, sheet = false }) => {
  const scrollerRef = useRef(null);
  const showUser = ['aiThinking', 'aiResponding', 'miniQuiz', 'answerCorrect'].includes(demo.phase);
  const showThinking = demo.phase === 'aiThinking';
  const showAnswer = demo.streamedWords > 0;
  const showExample = demo.exampleWords > 0;
  const showMini = demo.phase === 'miniQuiz' || demo.phase === 'answerCorrect';

  useEffect(() => {
    const node = scrollerRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [demo.streamedWords, demo.exampleWords, demo.phase]);

  return (
    <aside
      className={`flex h-full flex-col bg-white ${
        sheet
          ? 'rounded-t-[24px] border border-[#E5E5EA] shadow-[0_-16px_40px_rgba(15,23,42,0.12)]'
          : 'w-[280px] shrink-0 border-l border-[#E5E5EA]'
      }`}
    >
      <div className="border-b border-[#E5E5EA] px-4 py-3">
        <div className="flex items-center gap-2">
          <TutorAvatarMark className="size-7 rounded-full" />
          <p className="text-[14px] font-semibold text-[#0A0A0A]">AI Tutor</p>
        </div>
        <p className="mt-2 text-[13px] leading-5 text-[#6B6B70]">Ask from this lesson, not the open web.</p>
      </div>

      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {!showUser && !showMini ? (
          <div className="rounded-2xl bg-[#F2F2F7] px-3 py-2 text-[12px] text-[#6B6B70]">
            Explain working memory simply
          </div>
        ) : null}
        {showUser ? <UserBubble /> : null}
        {showThinking ? (
          <div className="flex items-start gap-2">
            <TutorAvatarMark className="mt-0.5 size-6 rounded-full" />
            <div className="rounded-[16px] border border-[#E5E5EA] bg-[#F9F9F9] px-3 py-2">
              <p className="text-[12px] font-medium text-[#6B6B70]">Thinking...</p>
              <div className="mt-1.5">
                <DemoTypingDots />
              </div>
            </div>
          </div>
        ) : null}
        {showAnswer ? (
          <div className="flex items-start gap-2">
            <TutorAvatarMark className="mt-0.5 size-6 rounded-full" />
            <div className="max-w-[92%] space-y-2">
              <div className="rounded-[16px] border border-[#E5E5EA] bg-[#F9F9F9] px-3 py-2">
                <p className="text-[12px] leading-5 text-[#0A0A0A]">
                  <DemoStreamingText
                    words={STUDY_ANSWER_WORDS}
                    count={demo.streamedWords}
                    showCaret={demo.phase === 'aiResponding' && demo.exampleWords === 0}
                  />
                </p>
              </div>
              {showExample ? (
                <div className="rounded-[16px] border border-[#E5E5EA] bg-[#F9F9F9] px-3 py-2">
                  <p className="text-[12px] leading-5 text-[#0A0A0A]">
                    <DemoStreamingText
                      words={STUDY_EXAMPLE_WORDS}
                      count={demo.exampleWords}
                      showCaret={demo.phase === 'aiResponding'}
                    />
                  </p>
                </div>
              ) : null}
              {demo.showTestMe && demo.phase === 'aiResponding' ? (
                <span
                  data-demo-target="testMe"
                  className={`inline-flex h-8 items-center rounded-full bg-[#111111] px-3 text-[12px] font-semibold text-white transition-transform duration-150 ${
                    demo.testPressed ? 'scale-[0.97]' : 'scale-100'
                  }`}
                >
                  Test me
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {showMini ? (
          <div className="rounded-[16px] border border-[#E5E5EA] bg-[#F9F9F9] px-3 py-3">
            <p className="text-[12px] font-semibold text-[#0A0A0A]">{STUDY_MINI_QUESTION}</p>
            <div className="mt-2 space-y-1.5">
              {STUDY_MINI_OPTIONS.map((option, index) => {
                const letter = String.fromCharCode(65 + index);
                const isB = index === 1;
                const chosen = demo.selectedChoice === index;
                return (
                  <div
                    key={option}
                    data-demo-target={isB ? 'choiceB' : undefined}
                    className={`rounded-xl px-2.5 py-2 text-[12px] leading-4 ${
                      chosen
                        ? 'bg-[#111111] font-semibold text-white'
                        : 'border border-[#E5E5EA] bg-white text-[#0A0A0A]'
                    }`}
                  >
                    {letter}. {option}
                  </div>
                );
              })}
            </div>
            {demo.phase === 'answerCorrect' ? (
              <div className="hero-demo-rise mt-3">
                <p className="text-[12px] font-semibold text-[#0A0A0A]">Correct ✓</p>
                <p className="mt-1 text-[12px] leading-5 text-[#6B6B70]">{STUDY_MINI_EXPLAIN}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        data-demo-target="composer"
        className={`m-3 flex items-center gap-2 rounded-full border bg-[#F9F9F9] px-3 py-2 ${
          demo.inputFocused ? 'border-[#111111]' : 'border-[#E5E5EA]'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[12px] text-[#0A0A0A]">
          {demo.typedQuestion || <span className="text-[#8E8E93]">Ask from this lesson...</span>}
          {demo.inputFocused ? (
            <span className="hero-demo-caret ml-0.5 inline-block h-3 w-px align-[-2px] bg-[#111111]" />
          ) : null}
        </span>
        <span
          data-demo-target="send"
          className={`inline-flex size-7 items-center justify-center rounded-full bg-[#111111] text-white transition-transform duration-150 ${
            demo.sendPressed ? 'scale-[0.97]' : 'scale-100'
          }`}
        >
          <AppIcon name="arrow_upward" className="text-[14px]" />
        </span>
      </div>
    </aside>
  );
};

const QuizPane = () => (
  <div className="h-full bg-[#F9F9F9] px-8 py-6">
    <p className="text-[13px] text-[#6B6B70]">Cognitive Psychology</p>
    <div className="mt-1 flex items-end justify-between gap-4">
      <h2 className="font-display text-[28px] font-bold tracking-[-0.02em] text-[#0A0A0A]">
        {STUDY_QUIZ.title}
      </h2>
      <p className="text-[13px] font-semibold text-[#6B6B70]">{STUDY_QUIZ.progress}</p>
    </div>
    <div className="mt-6 rounded-[24px] border border-[#E5E5EA] bg-white p-6 shadow-sm">
      <p className="font-display text-[18px] font-bold text-[#0A0A0A]">{STUDY_QUIZ.prompt}</p>
      <div className="mt-4 space-y-2">
        {STUDY_QUIZ.options.map((option, index) => (
          <div
            key={option}
            className="hero-demo-rise rounded-[16px] border border-[#E5E5EA] px-4 py-3 text-[14px] text-[#0A0A0A]"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span className="font-semibold">{String.fromCharCode(65 + index)}.</span> {option}
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ReducedMotionPane = () => (
  <div className="flex h-full bg-[#F9F9F9]">
    <LessonColumn selected showAsk={false} askPressed={false} quizPressed={false} />
    <TutorPanel
      demo={{
        phase: 'aiResponding',
        typedQuestion: '',
        inputFocused: false,
        sendPressed: false,
        streamedWords: STUDY_ANSWER_WORDS.length,
        exampleWords: STUDY_EXAMPLE_WORDS.length,
        showTestMe: false,
        testPressed: false,
        selectedChoice: -1,
      }}
    />
  </div>
);

export default function LessonStudyDemo() {
  const [setStageNode, inView] = useDemoInView(0.45, false);
  const [shellNode, setShellNode] = useState(null);
  const reduceMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const compact = useNarrowViewport();
  const demo = useLessonStudyDemo({
    active: Boolean(inView && !reduceMotion),
    showCursor: Boolean(finePointer && !reduceMotion),
    stageNode: shellNode,
  });

  const phase = reduceMotion ? 'aiResponding' : demo.phase;
  const showQuiz = phase === 'quizReady' || phase === 'resetting';
  const showSheet = Boolean(compact && TUTOR_OPEN_PHASES.includes(phase));
  const frameUrl = showQuiz ? 'www.chewnpour.com/dashboard/quizzes' : 'www.chewnpour.com/dashboard/lessons';

  return (
    <div
      ref={setStageNode}
      className="landing-study-demo"
      data-study-demo-active={inView && !reduceMotion ? 'true' : 'false'}
    >
      <BrowserFrame
        label="ChewnPour lesson with Start quiz and AI Tutor"
        url={frameUrl}
      >
        <ScaledStage>
          <Motion.div
            className="relative h-full"
            animate={{ opacity: phase === 'resetting' ? 0 : 1 }}
            transition={{ duration: 0.4, ease: PANE_EASE }}
          >
            <ProductShell
              ref={setShellNode}
              data-demo-phase={phase}
              activeNav="Lessons"
            >
              {reduceMotion ? (
                <ReducedMotionPane />
              ) : (
                <AnimatePresence mode="wait">
                  <Motion.div
                    key={showQuiz ? 'quiz' : 'lesson'}
                    className="relative h-full"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.28, ease: PANE_EASE }}
                  >
                    {showQuiz ? (
                      <QuizPane />
                    ) : (
                      <div className="relative flex h-full">
                        <LessonColumn
                          selected={demo.selected}
                          showAsk={demo.showAsk}
                          askPressed={demo.askPressed}
                          quizPressed={demo.quizPressed}
                          compact={compact}
                        />
                        {!compact ? <TutorPanel demo={demo} /> : null}
                        <AnimatePresence>
                          {showSheet ? (
                            <Motion.div
                              key="tutor-sheet"
                              className="absolute inset-0 z-20"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.22, ease: PANE_EASE }}
                            >
                              <div className="absolute inset-0 bg-[#0A0A0A]/20" />
                              <Motion.div
                                className="absolute inset-x-0 bottom-0 h-[62%] px-3"
                                initial={{ y: '18%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '18%' }}
                                transition={{ duration: 0.28, ease: PANE_EASE }}
                              >
                                <TutorPanel demo={demo} sheet />
                              </Motion.div>
                            </Motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    )}
                  </Motion.div>
                </AnimatePresence>
              )}
            </ProductShell>
            <DemoCursor
              x={demo.cursorX}
              y={demo.cursorY}
              pressed={demo.cursorPressed}
              visible={demo.showCursor}
            />
          </Motion.div>
        </ScaledStage>
      </BrowserFrame>
    </div>
  );
}
