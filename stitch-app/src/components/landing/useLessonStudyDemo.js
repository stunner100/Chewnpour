import { useEffect, useRef, useState } from 'react';
import { useSpring } from 'motion/react';
import { measureTarget, typeDelayForIndex } from './landingDemoRuntime';
import {
  STUDY_ANSWER_WORDS,
  STUDY_EXAMPLE_WORDS,
  STUDY_MINI_CORRECT,
  STUDY_QUESTION,
  STUDY_TARGETS,
  STUDY_TIMING,
} from './lessonStudyDemoScript';

const INITIAL = {
  phase: 'lessonIdle',
  selected: false,
  showAsk: false,
  askPressed: false,
  typedQuestion: '',
  inputFocused: false,
  sendPressed: false,
  streamedWords: 0,
  exampleWords: 0,
  showTestMe: false,
  testPressed: false,
  selectedChoice: -1,
  quizPressed: false,
  cursorPressed: false,
};

export function useLessonStudyDemo({
  active = false,
  showCursor = false,
  stageNode = null,
} = {}) {
  const [state, setState] = useState(INITIAL);
  const cursorX = useSpring(STUDY_TARGETS.idle.x, STUDY_TIMING.cursorSpring);
  const cursorY = useSpring(STUDY_TARGETS.idle.y, STUDY_TIMING.cursorSpring);
  const stageNodeRef = useRef(stageNode);

  useEffect(() => {
    stageNodeRef.current = stageNode;
  }, [stageNode]);

  useEffect(() => {
    if (!active) {
      cursorX.jump(STUDY_TARGETS.idle.x);
      cursorY.jump(STUDY_TARGETS.idle.y);
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

    const target = (name) => measureTarget(stageNodeRef.current, name, STUDY_TARGETS);

    const moveCursor = async (name, duration) => {
      const point = target(name);
      cursorX.set(point.x);
      cursorY.set(point.y);
      await wait(showCursor ? duration : Math.min(duration, 240));
    };

    const click = async () => {
      patch({ cursorPressed: true });
      await wait(STUDY_TIMING.clickMs);
      patch({ cursorPressed: false });
    };

    const runLoop = async () => {
      await wait(0);
      while (!cancelled) {
        cursorX.jump(STUDY_TARGETS.idle.x);
        cursorY.jump(STUDY_TARGETS.idle.y);
        patch(INITIAL);
        await wait(STUDY_TIMING.idleMs);
        if (cancelled) break;

        patch({ phase: 'selectingText' });
        await moveCursor('phrase', STUDY_TIMING.moveToPhraseMs);
        if (cancelled) break;
        patch({ selected: true });
        await wait(STUDY_TIMING.selectMs);
        patch({ showAsk: true });
        await wait(STUDY_TIMING.askRevealMs);
        await moveCursor('askTutor', STUDY_TIMING.moveToAskMs);
        if (cancelled) break;
        patch({ askPressed: true });
        await click();

        patch({
          phase: 'openingTutor',
          askPressed: false,
        });
        await wait(STUDY_TIMING.tutorOpenMs);
        if (cancelled) break;

        patch({ phase: 'askingTutor', inputFocused: true });
        for (let index = 1; index <= STUDY_QUESTION.length; index += 1) {
          if (cancelled) break;
          patch({ typedQuestion: STUDY_QUESTION.slice(0, index) });
          await wait(typeDelayForIndex(index, STUDY_TIMING));
        }
        if (cancelled) break;

        await wait(STUDY_TIMING.afterTypePauseMs);
        await moveCursor('send', STUDY_TIMING.moveToSendMs);
        if (cancelled) break;
        patch({ sendPressed: true });
        await click();
        patch({
          phase: 'aiThinking',
          typedQuestion: '',
          inputFocused: false,
          sendPressed: false,
        });
        await wait(STUDY_TIMING.thinkingMs);
        if (cancelled) break;

        patch({ phase: 'aiResponding', streamedWords: 0, exampleWords: 0 });
        for (let index = 1; index <= STUDY_ANSWER_WORDS.length; index += 1) {
          if (cancelled) break;
          patch({ streamedWords: index });
          await wait(STUDY_TIMING.streamWordMs);
        }
        if (cancelled) break;
        await wait(STUDY_TIMING.examplePauseMs);
        for (let index = 1; index <= STUDY_EXAMPLE_WORDS.length; index += 1) {
          if (cancelled) break;
          patch({ exampleWords: index });
          await wait(STUDY_TIMING.streamWordMs);
        }
        if (cancelled) break;

        patch({ showTestMe: true });
        await wait(STUDY_TIMING.afterAnswerMs);
        await moveCursor('testMe', STUDY_TIMING.moveToTestMs);
        if (cancelled) break;
        patch({ testPressed: true });
        await click();
        patch({ phase: 'miniQuiz', testPressed: false });
        await wait(STUDY_TIMING.miniPauseMs);
        if (cancelled) break;

        await moveCursor('choiceB', STUDY_TIMING.moveToChoiceBMs);
        if (cancelled) break;
        await click();
        patch({ phase: 'answerCorrect', selectedChoice: STUDY_MINI_CORRECT });
        await wait(STUDY_TIMING.selectAnswerMs + STUDY_TIMING.correctHoldMs);
        if (cancelled) break;

        patch({ phase: 'openingQuiz' });
        await moveCursor('startQuiz', STUDY_TIMING.moveToQuizMs);
        if (cancelled) break;
        patch({ quizPressed: true });
        await click();
        patch({ phase: 'quizReady', quizPressed: false });
        await wait(STUDY_TIMING.quizHoldMs);
        if (cancelled) break;

        patch({ phase: 'resetting' });
        await wait(STUDY_TIMING.resetMs);
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
