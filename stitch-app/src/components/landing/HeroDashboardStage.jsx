import { useRef, useState } from 'react';
import { m as Motion, useInView, useReducedMotion } from 'motion/react';

const ENTRANCE_EASE = [0.165, 0.84, 0.44, 1];

export default function HeroDashboardStage({ children }) {
  const stageRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(stageRef, { once: true, amount: 0.28 });
  const [hasEntered, setHasEntered] = useState(false);
  const canFloat = Boolean(hasEntered && !reduceMotion);

  return (
    <div ref={stageRef} className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[8%] -z-10 rounded-[36px] bg-[#93C5FD]/25 blur-3xl"
      />
      <Motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
        animate={
          inView
            ? { opacity: 1, y: 0, scale: 1 }
            : reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 20, scale: 0.98 }
        }
        transition={
          reduceMotion
            ? { duration: 0.18, ease: 'easeOut' }
            : { duration: 0.72, ease: ENTRANCE_EASE }
        }
        onAnimationComplete={() => {
          if (inView) setHasEntered(true);
        }}
      >
        <div className={canFloat ? 'hero-dashboard-float' : undefined}>{children}</div>
      </Motion.div>
    </div>
  );
}
