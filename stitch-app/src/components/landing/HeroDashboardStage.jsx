import { useRef, useState, useSyncExternalStore } from 'react';
import {
  m as Motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';

const ENTRANCE_EASE = [0.165, 0.84, 0.44, 1];
const FINE_POINTER_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';
const SPRING = { stiffness: 170, damping: 26, mass: 0.55 };
const HOVER_SPRING = { stiffness: 260, damping: 32, mass: 0.4 };

const subscribeFinePointer = (onStoreChange) => {
  const media = window.matchMedia(FINE_POINTER_QUERY);
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
};

const useFinePointer = () =>
  useSyncExternalStore(
    subscribeFinePointer,
    () => window.matchMedia(FINE_POINTER_QUERY).matches,
    () => false,
  );

export default function HeroDashboardStage({ children }) {
  const stageRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const inView = useInView(stageRef, { once: true, amount: 0.28 });
  const [hasEntered, setHasEntered] = useState(false);

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start 0.92', 'end start'],
  });
  const rawParallax = useTransform(scrollYProgress, [0, 1], [0, 14]);
  const parallaxY = useSpring(rawParallax, { stiffness: 90, damping: 28, mass: 0.8 });

  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);
  const hoverScale = useSpring(1, HOVER_SPRING);
  const hoverLift = useMotionValue(0);
  const hoverShadow = useSpring(hoverLift, HOVER_SPRING);
  const frameShadow = useTransform(
    hoverShadow,
    [0, 1],
    [
      '0 28px 70px rgba(15, 23, 42, 0.10), 0 8px 24px rgba(15, 23, 42, 0.05)',
      '0 36px 88px rgba(15, 23, 42, 0.16), 0 12px 28px rgba(15, 23, 42, 0.07)',
    ],
  );

  const canTilt = Boolean(finePointer && !reduceMotion);
  const canHover = Boolean(finePointer && !reduceMotion);
  const canFloat = Boolean(hasEntered && !reduceMotion);
  const canShimmer = Boolean(finePointer && hasEntered && !reduceMotion);

  const resetPointer = () => {
    rotateX.set(0);
    rotateY.set(0);
    hoverScale.set(1);
    hoverLift.set(0);
  };

  const handlePointerMove = (event) => {
    if (!canTilt || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 7);
    rotateX.set(py * -7);
  };

  return (
    <div ref={stageRef} className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[8%] -z-10 rounded-[36px] bg-[#93C5FD]/25 blur-3xl"
      />
      <Motion.div style={reduceMotion ? undefined : { y: parallaxY }}>
        <Motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.96 }}
          animate={
            inView
              ? { opacity: 1, y: 0, scale: 1 }
              : reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 36, scale: 0.96 }
          }
          transition={
            reduceMotion
              ? { duration: 0.18, ease: 'easeOut' }
              : { duration: 0.82, ease: ENTRANCE_EASE }
          }
          onAnimationComplete={() => {
            if (inView) setHasEntered(true);
          }}
        >
          <div className={canFloat ? 'hero-dashboard-float' : undefined}>
            <Motion.div
              className="relative"
              style={{
                rotateX: canTilt ? rotateX : 0,
                rotateY: canTilt ? rotateY : 0,
                scale: canHover ? hoverScale : 1,
                boxShadow: canHover ? frameShadow : undefined,
                transformPerspective: 1200,
                transformStyle: 'preserve-3d',
              }}
              onPointerMove={canTilt ? handlePointerMove : undefined}
              onPointerEnter={
                canHover
                  ? () => {
                      hoverScale.set(1.012);
                      hoverLift.set(1);
                    }
                  : undefined
              }
              onPointerLeave={canHover || canTilt ? resetPointer : undefined}
            >
              {children}
              {canShimmer ? (
                <span className="hero-dashboard-shimmer pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
                  <span className="hero-dashboard-shimmer__band" />
                </span>
              ) : null}
            </Motion.div>
          </div>
        </Motion.div>
      </Motion.div>
    </div>
  );
}
