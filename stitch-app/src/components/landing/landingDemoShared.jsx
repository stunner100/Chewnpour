import { m as Motion } from 'motion/react';

export function DemoCursor({ x, y, pressed, visible }) {
  if (!visible) return null;
  return (
    <Motion.div
      className="hero-demo-cursor pointer-events-none absolute top-0 left-0 z-30 will-change-transform"
      style={{ x, y }}
      animate={{ scale: pressed ? 0.92 : 1 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
    >
      <svg width="22" height="24" viewBox="0 0 22 24" fill="none" aria-hidden="true">
        <path
          d="M3.2 2.4 19 11.1l-7.2 1.5 2.9 7.4-3.3 1.3-2.9-7.3-5.3 4.4z"
          fill="#111111"
          stroke="#ffffff"
          strokeLinejoin="round"
          strokeWidth="1.4"
        />
      </svg>
    </Motion.div>
  );
}

export function DemoTypingDots({ className = 'bg-[#8E8E93]' }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className={`hero-demo-dot size-1.5 rounded-full ${className}`}
          style={{ animationDelay: `${dot * 140}ms` }}
        />
      ))}
    </span>
  );
}

export function DemoStreamingText({ words, count, showCaret = false }) {
  return (
    <>
      {words.slice(0, count).join(' ')}
      {showCaret ? (
        <span className="hero-demo-caret ml-0.5 inline-block h-3.5 w-px align-[-2px] bg-[#111111]" />
      ) : null}
    </>
  );
}
