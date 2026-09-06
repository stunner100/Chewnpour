import { useEffect, useRef, useState } from 'react';
import { useSpring } from 'motion/react';
import {
  DEMO_ANSWER_WORDS,
  DEMO_GENERATE_STAGES,
  DEMO_QUESTION,
  DEMO_TARGETS,
  DEMO_TIMING,
  DEMO_STAGE_WIDTH,
  typeDelayForIndex,
} from './heroProductDemoScript';

const INITIAL = {
  phase: 'dashboard',
  activeNav: 'Dashboard',
  hoveredNav: '',
  pressedNav: '',
  typedQuestion: '',
  inputFocused: false,
  sendPressed: false,
  generatePressed: false,
  streamedWords: 0,
  generateStep: 0,
  cursorPressed: false,
};

const measureTarget = (root, name) => {
  const fallback = DEMO_TARGETS[name];
  if (!root) return fallback;
  const el = root.querySelector(`[data-demo-target="${name}"]`);
  if (!el) return fallback;
  const rootRect = root.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  if (rootRect.width < 8) return fallback;
  const scale = rootRect.width / DEMO_STAGE_WIDTH;
  return {
    x: (rect.left - rootRect.left + rect.width * 0.28) / scale,
    y: (rect.top - rootRect.top + rect.height * 0.42) / scale,
  };
};

export function useHeroProductDemo({
  active = false,
  showCursor = false,
  stageNode = null,
} = {}) {
  const [state, setState] = useState(INITIAL);
  const cursorX = useSpring(DEMO_TARGETS.idle.x, DEMO_TIMING.cursorSpring);
  const cursorY = useSpring(DEMO_TARGETS.idle.y, DEMO_TIMING.cursorSpring);
  const stageNodeRef = useRef(stageNode);

  useEffect(() => {
    stageNodeRef.current = stageNode;
  }, [stageNode]);

  useEffect(() => {
    if (!active) {
      cursorX.jump(DEMO_TARGETS.idle.x);
      cursorY.jump(DEMO_TARGETS.idle.y);
      return undefined;
    }

    let cancelled = false;
    const timers = [];

    const wait = (ms) =>
      new Promise((resolve) => {
        const id = window.setTimeout(resolve, ms);
        timers.push(id);
      });

    const patch = (partial) => {
      if (!cancelled) setState((current) => ({ ...current, ...partial }));
    };

    const target = (name) => measureTarget(stageNodeRef.current, name);

    const moveCursor = async (name, duration) => {
      const point = target(name);
      cursorX.set(point.x);
      cursorY.set(point.y);
      await wait(showCursor ? duration : Math.min(duration, 260));
    };

    const click = async () => {
      patch({ cursorPressed: true });
      await wait(DEMO_TIMING.clickMs);
      patch({ cursorPressed: false });
    };

    const runLoop = async () => {
      await wait(0);
      while (!cancelled) {
        cursorX.jump(DEMO_TARGETS.idle.x);
        cursorY.jump(DEMO_TARGETS.idle.y);
        patch(INITIAL);
        await wait(DEMO_TIMING.idleMs);
        if (cancelled) break;

        patch({ phase: 'openingTutor' });
        await moveCursor('tutorNav', DEMO_TIMING.moveToTutorMs);
        if (cancelled) break;
        patch({ hoveredNav: 'AI Tutor' });
        await wait(DEMO_TIMING.tutorHoverMs);
        patch({ pressedNav: 'AI Tutor' });
        await click();
        patch({
          phase: 'tutor',
          activeNav: 'AI Tutor',
          hoveredNav: '',
          pressedNav: '',
        });
        await wait(DEMO_TIMING.tutorOpenMs);
        if (cancelled) break;

        patch({ phase: 'focusComposer' });
        await moveCursor('composer', DEMO_TIMING.moveToComposerMs);
        if (cancelled) break;
        await click();
        patch({ phase: 'typingQuestion', inputFocused: true });

        for (let index = 1; index <= DEMO_QUESTION.length; index += 1) {
          if (cancelled) break;
          patch({ typedQuestion: DEMO_QUESTION.slice(0, index) });
          await wait(typeDelayForIndex(index));
        }
        if (cancelled) break;

        await wait(DEMO_TIMING.afterTypePauseMs);
        await moveCursor('send', 280);
        if (cancelled) break;
        patch({ sendPressed: true });
        await click();
        patch({
          phase: 'aiThinking',
          typedQuestion: '',
          inputFocused: false,
          sendPressed: false,
        });
        await wait(DEMO_TIMING.thinkingMs);
        if (cancelled) break;

        patch({ phase: 'aiResponding', streamedWords: 0 });
        for (let index = 1; index <= DEMO_ANSWER_WORDS.length; index += 1) {
          if (cancelled) break;
          patch({ streamedWords: index });
          await wait(DEMO_TIMING.streamWordMs);
        }
        if (cancelled) break;

        patch({ phase: 'readyToGenerate' });
        await wait(DEMO_TIMING.afterAnswerMs);
        await moveCursor('generate', DEMO_TIMING.moveToGenerateMs);
        if (cancelled) break;
        patch({ generatePressed: true });
        await click();
        patch({ phase: 'generatingLesson', generatePressed: false, generateStep: 0 });

        for (let index = 1; index <= DEMO_GENERATE_STAGES.length; index += 1) {
          if (cancelled) break;
          patch({ generateStep: index });
          await wait(DEMO_TIMING.stageMs);
        }
        if (cancelled) break;

        patch({ phase: 'lessonComplete', activeNav: 'Lessons' });
        await wait(DEMO_TIMING.lessonRevealMs + DEMO_TIMING.lessonHoldMs);
        if (cancelled) break;

        patch({ phase: 'resetting' });
        await wait(DEMO_TIMING.resetMs);
      }
    };

    runLoop();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [active, showCursor, cursorX, cursorY]);

  return {
    ...(active ? state : INITIAL),
    showCursor: Boolean(showCursor && active),
    cursorX,
    cursorY,
  };
}
