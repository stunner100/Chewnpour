import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m as Motion, useReducedMotion } from 'motion/react';
import AppIcon from '../AppIcon';
import { TutorAvatarMark } from '../tutor/TutorAvatar';
import {
  BrowserFrame,
  DashboardHome,
  ProductShell,
  ScaledStage,
} from './landingProductChrome';
import { DemoCursor, DemoStreamingText, DemoTypingDots } from './landingDemoShared';
import { PANE_EASE, useDemoInView, useFinePointer } from './landingDemoRuntime';
import {
  DEMO_ANSWER_WORDS,
  DEMO_GENERATE_STAGES,
  DEMO_LESSON,
  DEMO_QUESTION,
} from './heroProductDemoScript';
import { useHeroProductDemo } from './useHeroProductDemo';

const SUGGESTED_PROMPTS = ['Explain in simple terms', 'Give me an example', 'Quiz me on this'];

const paneKey = (phase) => {
  if (phase === 'generatingLesson') return 'generating';
  if (phase === 'lessonComplete' || phase === 'resetting') return 'lesson';
  if (phase === 'dashboard' || phase === 'openingTutor') return 'home';
  return 'tutor';
};

const UserBubble = () => (
  <div className="ml-auto max-w-[78%] rounded-[20px] bg-[#111111] px-4 py-3 text-[14px] leading-6 text-white">
    {DEMO_QUESTION}
  </div>
);

const ThinkingDots = () => (
  <div className="flex items-start gap-2">
    <TutorAvatarMark className="mt-0.5 size-7 rounded-full" />
    <div className="rounded-[20px] border border-[#E5E5EA] bg-white px-4 py-3">
      <p className="text-[13px] font-medium text-[#6B6B70]">Tutor is typing...</p>
      <div className="mt-2">
        <DemoTypingDots />
      </div>
    </div>
  </div>
);

const TutorPane = ({
  phase,
  typedQuestion,
  inputFocused,
  sendPressed,
  generatePressed,
  streamedWords,
}) => {
  const scrollerRef = useRef(null);
  const showPrompts = phase === 'tutor' || phase === 'focusComposer';
  const showUser = ['aiThinking', 'aiResponding', 'readyToGenerate'].includes(phase);
  const showThinking = phase === 'aiThinking';
  const showAnswer = streamedWords > 0 && ['aiResponding', 'readyToGenerate'].includes(phase);
  const showActions = phase === 'readyToGenerate';

  useEffect(() => {
    const node = scrollerRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [streamedWords, phase]);

  return (
    <div className="flex h-full flex-col bg-[#F9F9F9] px-6 py-5">
      <div>
        <p className="text-[13px] font-medium text-[#6B6B70]">Cognitive Psychology · Working memory</p>
        <h2 className="mt-1 font-display text-[28px] font-bold tracking-[-0.02em] text-[#0A0A0A]">
          AI Tutor
        </h2>
        <p className="mt-1 text-[14px] text-[#6B6B70]">Ask questions about your study materials.</p>
      </div>

      <div ref={scrollerRef} className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {showPrompts ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <span
                key={prompt}
                className="inline-flex h-8 items-center rounded-full border border-[#E5E5EA] bg-white px-3 text-[12px] font-medium text-[#6B6B70]"
              >
                {prompt}
              </span>
            ))}
          </div>
        ) : null}
        {showUser ? <UserBubble /> : null}
        {showThinking ? <ThinkingDots /> : null}
        {showAnswer ? (
          <div className="flex items-start gap-2">
            <TutorAvatarMark className="mt-0.5 size-7 rounded-full" />
            <div className="max-w-[82%] rounded-[20px] border border-[#E5E5EA] bg-white px-4 py-3 shadow-sm">
              <p className="text-[14px] leading-6 text-[#0A0A0A]">
                <DemoStreamingText
                  words={DEMO_ANSWER_WORDS}
                  count={streamedWords}
                  showCaret={phase === 'aiResponding'}
                />
              </p>
              {showActions ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    data-demo-target="generate"
                    className={`inline-flex h-9 items-center rounded-full bg-[#111111] px-4 text-[13px] font-semibold text-white transition-transform duration-150 ${
                      generatePressed ? 'scale-[0.97]' : 'scale-100'
                    }`}
                  >
                    Generate lesson
                  </span>
                  <span className="inline-flex h-9 items-center rounded-full border border-[#E5E5EA] bg-white px-4 text-[13px] font-semibold text-[#0A0A0A]">
                    Practice this
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div
        data-demo-target="composer"
        className={`mt-3 flex items-center gap-2 rounded-full border bg-white px-4 py-2.5 ${
          inputFocused ? 'border-[#111111]' : 'border-[#E5E5EA]'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[13px] text-[#0A0A0A]">
          {typedQuestion || (
            <span className="text-[#8E8E93]">Ask anything about your materials...</span>
          )}
          {inputFocused ? (
            <span className="hero-demo-caret ml-0.5 inline-block h-3.5 w-px align-[-2px] bg-[#111111]" />
          ) : null}
        </span>
        <span
          data-demo-target="send"
          className={`inline-flex size-8 items-center justify-center rounded-full bg-[#111111] text-white transition-transform duration-150 ${
            sendPressed ? 'scale-[0.97]' : 'scale-100'
          }`}
        >
          <AppIcon name="arrow_upward" className="text-[16px]" />
        </span>
      </div>
    </div>
  );
};

const GeneratingPane = ({ generateStep }) => (
  <div className="flex h-full flex-col bg-[#F9F9F9] px-6 py-6">
    <p className="text-[13px] font-medium text-[#6B6B70]">AI Tutor</p>
    <h2 className="mt-1 font-display text-[28px] font-bold tracking-[-0.02em] text-[#0A0A0A]">
      Creating your lesson...
    </h2>
    <p className="mt-1 text-[14px] text-[#6B6B70]">Building a structured lesson from this answer.</p>
    <div className="mt-6 space-y-2.5">
      {DEMO_GENERATE_STAGES.map((label, index) => {
        const step = index + 1;
        const done = generateStep > step;
        const current = generateStep === step;
        return (
          <div
            key={label}
            className={`hero-demo-rise flex items-center gap-3 rounded-[18px] border border-[#E5E5EA] bg-white px-4 py-3 ${
              current ? 'translate-y-0' : ''
            }`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span
              className={`inline-flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${
                done
                  ? 'bg-[#111111] text-white'
                  : current
                    ? 'bg-[#F2F7FF] text-[#007AFF]'
                    : 'border border-[#E5E5EA] bg-white text-[#8E8E93]'
              }`}
            >
              {done ? <AppIcon name="check" className="hero-demo-check text-[14px]" /> : current ? '●' : '○'}
            </span>
            <span className={`text-[14px] font-medium ${current || done ? 'text-[#0A0A0A]' : 'text-[#8E8E93]'}`}>
              {label}
            </span>
            {current ? (
              <span className="ml-auto flex items-center gap-1">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="hero-demo-dot size-1.5 rounded-full bg-[#007AFF]"
                    style={{ animationDelay: `${dot * 140}ms` }}
                  />
                ))}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  </div>
);

const LessonPane = () => (
  <div className="h-full bg-[#F9F9F9] px-6 py-6">
    <p className="hero-demo-rise text-[13px] font-medium text-[#6B6B70]">Lesson</p>
    <div className="mt-1 flex items-end justify-between gap-4">
      <div>
        <h2 className="hero-demo-rise font-display text-[28px] font-bold tracking-[-0.02em] text-[#0A0A0A]" style={{ animationDelay: '60ms' }}>
          {DEMO_LESSON.title}
        </h2>
        <p className="hero-demo-rise mt-1 text-[13px] text-[#6B6B70]" style={{ animationDelay: '90ms' }}>
          {DEMO_LESSON.duration}
        </p>
      </div>
      <span className="hero-demo-rise inline-flex h-11 items-center rounded-full bg-[#111111] px-5 text-[13px] font-semibold text-white" style={{ animationDelay: '120ms' }}>
        {DEMO_LESSON.cta}
      </span>
    </div>
    <p className="hero-demo-rise mt-4 max-w-[58ch] text-[15px] leading-7 text-[#6B6B70]" style={{ animationDelay: '140ms' }}>
      {DEMO_LESSON.summary}
    </p>
    <p className="hero-demo-rise mt-2 text-[12px] font-medium text-[#007AFF]" style={{ animationDelay: '170ms' }}>
      {DEMO_LESSON.source}
    </p>
    <div className="mt-5 grid grid-cols-2 gap-3">
      {DEMO_LESSON.sections.map((title, index) => (
        <div
          key={title}
          className="hero-demo-rise rounded-[20px] border border-[#E5E5EA] bg-white px-4 py-4 shadow-sm"
          style={{ animationDelay: `${220 + index * 80}ms` }}
        >
          <p className="text-[11px] font-semibold tracking-[0.08em] text-[#8E8E93]">
            {String(index + 1).padStart(2, '0')}
          </p>
          <p className="mt-2 font-display text-[16px] font-bold text-[#0A0A0A]">{title}</p>
        </div>
      ))}
    </div>
  </div>
);

const MainPane = (demo) => {
  if (demo.phase === 'generatingLesson') {
    return <GeneratingPane generateStep={demo.generateStep} />;
  }
  if (demo.phase === 'lessonComplete' || demo.phase === 'resetting') {
    return <LessonPane />;
  }
  if (demo.phase === 'dashboard' || demo.phase === 'openingTutor') {
    return <DashboardHome />;
  }
  return (
    <TutorPane
      phase={demo.phase}
      typedQuestion={demo.typedQuestion}
      inputFocused={demo.inputFocused}
      sendPressed={demo.sendPressed}
      generatePressed={demo.generatePressed}
      streamedWords={demo.streamedWords}
    />
  );
};

const frameUrl = (phase) => {
  if (phase === 'lessonComplete' || phase === 'resetting' || phase === 'generatingLesson') {
    return 'www.chewnpour.com/dashboard/lessons';
  }
  if (phase === 'dashboard' || phase === 'openingTutor') {
    return 'www.chewnpour.com/dashboard';
  }
  return 'www.chewnpour.com/dashboard/ai-tutor';
};

export default function HeroProductDemo() {
  const [setStageNode, inView] = useDemoInView(0.12, true);
  const [shellNode, setShellNode] = useState(null);
  const reduceMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const demo = useHeroProductDemo({
    active: Boolean(inView && !reduceMotion),
    showCursor: Boolean(finePointer && !reduceMotion),
    stageNode: shellNode,
  });

  const phase = reduceMotion ? 'lessonComplete' : demo.phase;
  const view = reduceMotion ? { ...demo, phase: 'lessonComplete', activeNav: 'AI Tutor' } : demo;
  const currentPane = paneKey(phase);

  return (
    <div ref={setStageNode} data-demo-active={inView && !reduceMotion ? 'true' : 'false'}>
      <BrowserFrame
        label="ChewnPour product demo: ask the AI tutor and generate a lesson"
        url={frameUrl(phase)}
      >
        <ScaledStage>
          <Motion.div
            className="relative h-full"
            animate={{ opacity: phase === 'resetting' ? 0 : 1 }}
            transition={{ duration: 0.45, ease: PANE_EASE }}
          >
            <ProductShell
              ref={setShellNode}
              data-demo-phase={phase}
              activeNav={view.activeNav}
              hoveredNav={view.hoveredNav}
              pressedNav={view.pressedNav}
            >
              <AnimatePresence mode="wait">
                <Motion.div
                  key={currentPane}
                  className="h-full"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: PANE_EASE }}
                >
                  <MainPane {...view} />
                </Motion.div>
              </AnimatePresence>
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
