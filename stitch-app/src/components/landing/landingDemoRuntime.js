import { useEffect, useState, useSyncExternalStore } from 'react';

export const FINE_POINTER_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';
export const NARROW_VIEWPORT_QUERY = '(max-width: 1023px)';
export const PANE_EASE = [0.165, 0.84, 0.44, 1];
export const DEMO_STAGE_WIDTH = 1120;
export const DEMO_CURSOR_SPRING = { stiffness: 92, damping: 18, mass: 0.7 };

const subscribeMedia = (query) => (onStoreChange) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
};

export const useFinePointer = () =>
  useSyncExternalStore(
    subscribeMedia(FINE_POINTER_QUERY),
    () => window.matchMedia(FINE_POINTER_QUERY).matches,
    () => false,
  );

export const useNarrowViewport = () =>
  useSyncExternalStore(
    subscribeMedia(NARROW_VIEWPORT_QUERY),
    () => window.matchMedia(NARROW_VIEWPORT_QUERY).matches,
    () => false,
  );

export const useDemoInView = (threshold = 0.12, initial = true) => {
  const [node, setNode] = useState(null);
  const [inView, setInView] = useState(initial);

  useEffect(() => {
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, threshold]);

  return [setNode, inView];
};

export const measureTarget = (root, name, fallbacks, stageWidth = DEMO_STAGE_WIDTH) => {
  const fallback = fallbacks[name];
  if (!root) return fallback;
  const el = root.querySelector(`[data-demo-target="${name}"]`);
  if (!el) return fallback;
  const rootRect = root.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  if (rootRect.width < 8) return fallback;
  const scale = rootRect.width / stageWidth;
  return {
    x: (rect.left - rootRect.left + rect.width * 0.28) / scale,
    y: (rect.top - rootRect.top + rect.height * 0.42) / scale,
  };
};

export const typeDelayForIndex = (index, timing) => {
  const span = timing.typeCharMaxMs - timing.typeCharMinMs;
  return timing.typeCharMinMs + ((index * 17) % (span + 1));
};
