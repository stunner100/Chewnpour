import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import MaintenanceScreen from './components/MaintenanceScreen.jsx';
import {
  attemptChunkRecoveryReload,
  isChunkLoadError,
  isStaleExamRouteReferenceError,
  isStaleTopicRouteLookupError,
  redirectForStaleTopicRoute,
} from './lib/chunkLoadRecovery.js';
import { convexSiteUrl } from './lib/convex-config.js';
import { maintenanceModeEnabled } from './lib/maintenance-mode.js';
import { ensurePromiseWithResolvers } from './lib/runtimePolyfills.js';
import { stashOttFromUrl } from './lib/ott.js';
import { initializeTheme } from './lib/theme.js';

initializeTheme();
ensurePromiseWithResolvers();
stashOttFromUrl();

const ensureMetaTag = ({ property, name, content }) => {
  if (!content || typeof document === 'undefined') return;

  const selector = property
    ? `meta[property="${property}"]`
    : `meta[name="${name}"]`;

  let meta = document.head?.querySelector(selector) || document.querySelector(selector);
  if (!meta) {
    meta = document.createElement('meta');
    if (property) {
      meta.setAttribute('property', property);
    }
    if (name) {
      meta.setAttribute('name', name);
    }
    document.head?.appendChild(meta);
  }

  if (!meta.getAttribute('content')) {
    meta.setAttribute('content', content);
  }
};

const ensureSocialMetaDefaults = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const canonicalUrl = window.location?.origin || 'https://www.chewnpour.com';

  ensureMetaTag({ property: 'og:type', content: 'website' });
  ensureMetaTag({ property: 'og:title', content: 'ChewnPour' });
  ensureMetaTag({ property: 'og:description', content: 'Turn your slides into smart lessons and quizzes.' });
  ensureMetaTag({ property: 'og:url', content: `${canonicalUrl}/` });
  ensureMetaTag({ property: 'og:image', content: `${canonicalUrl}/brand/og-logo.png` });
  ensureMetaTag({ name: 'twitter:card', content: 'summary_large_image' });
};

const applyBrowserHints = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const ua = window.navigator.userAgent;
  const isSafari =
    /Safari/i.test(ua) &&
    !/Chrome|CriOS|Chromium|Edg|OPR|SamsungBrowser/i.test(ua);
  if (isSafari) {
    document.documentElement.classList.add('is-safari');
  }
};

const appendResourceHint = (rel, href, crossOrigin = false) => {
  if (!href || typeof document === 'undefined') return;
  const selector = `link[rel="${rel}"][href="${href}"]`;
  if (document.head.querySelector(selector)) return;

  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (crossOrigin) {
    link.crossOrigin = 'anonymous';
  }
  document.head.appendChild(link);
};

const applyNetworkHints = () => {
  if (!convexSiteUrl) return;
  appendResourceHint('preconnect', convexSiteUrl, true);
  appendResourceHint('dns-prefetch', convexSiteUrl);
};

const LEGACY_PWA_CLEANUP_KEY = '__legacy_pwa_cleanup_ts';
const LEGACY_PWA_CLEANUP_WINDOW_MS = 30_000;

const canRunLegacyPwaCleanup = () => {
  if (typeof window === 'undefined') return false;
  const now = Date.now();
  try {
    const lastRaw = window.sessionStorage.getItem(LEGACY_PWA_CLEANUP_KEY);
    const last = Number(lastRaw);
    if (Number.isFinite(last) && now - last < LEGACY_PWA_CLEANUP_WINDOW_MS) {
      return false;
    }
    window.sessionStorage.setItem(LEGACY_PWA_CLEANUP_KEY, String(now));
    return true;
  } catch {
    return true;
  }
};

const clearLegacyPwaRuntime = () => {
  if (!import.meta.env.PROD || typeof window === 'undefined') return;
  if (!canRunLegacyPwaCleanup()) return;

  const unregisterServiceWorkers = async () => {
    if (!('serviceWorker' in navigator)) return false;
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const hadRegistrations = registrations.length > 0;
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
      return hadRegistrations;
    } catch {
      // Ignore cleanup failures so the app can continue booting.
      return false;
    }
  };

  const clearBrowserCaches = async () => {
    if (!('caches' in window)) return false;
    try {
      const cacheKeys = await window.caches.keys();
      const hadCaches = cacheKeys.length > 0;
      await Promise.allSettled(cacheKeys.map((key) => window.caches.delete(key)));
      return hadCaches;
    } catch {
      // Ignore cleanup failures so the app can continue booting.
      return false;
    }
  };

  void Promise.allSettled([unregisterServiceWorkers(), clearBrowserCaches()]).then((results) => {
    const clearedStaleRuntime = results.some((result) => result.status === 'fulfilled' && result.value === true);
    if (clearedStaleRuntime) {
      window.setTimeout(() => {
        window.location.replace(window.location.href);
      }, 120);
    }
  });
};

const removeManifestLink = () => {
  if (typeof document === 'undefined') return;
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) {
    manifestLink.remove();
  }
};

const applyPwaCutover = () => {
  if (!import.meta.env.PROD || typeof window === 'undefined') return;
  clearLegacyPwaRuntime();
  removeManifestLink();
};

const scheduleObservabilityInit = () => {
  const startObservability = () => {
    void Promise.all([
      import('./lib/sentry.js'),
      import('./lib/posthog.js'),
    ]).then(([{ initSentry }, { initPostHog }]) => {
      initSentry();
      initPostHog();
    });
  };

  if (typeof window === 'undefined') {
    startObservability();
    return;
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => {
      startObservability();
    }, { timeout: 3000 });
    return;
  }

  window.setTimeout(() => {
    startObservability();
  }, 1200);
};

const installChunkLoadRecovery = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('vite:preloadError', (event) => {
    event?.preventDefault?.();
    const payloadError = event?.payload;
    if (!payloadError || isChunkLoadError(payloadError)) {
      attemptChunkRecoveryReload();
    }
  });

  window.addEventListener('error', (event) => {
    if (isStaleExamRouteReferenceError(event?.error || event?.message)) {
      event?.preventDefault?.();
      if (attemptChunkRecoveryReload('stale-exam-route-reference')) {
        return;
      }
    }

    if (isStaleTopicRouteLookupError(event?.error || event?.message)) {
      event?.preventDefault?.();
      if (redirectForStaleTopicRoute()) {
        return;
      }
    }

    if (isChunkLoadError(event?.error || event?.message)) {
      attemptChunkRecoveryReload();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isStaleExamRouteReferenceError(event?.reason)) {
      event?.preventDefault?.();
      if (attemptChunkRecoveryReload('stale-exam-route-reference')) {
        return;
      }
    }

    if (isStaleTopicRouteLookupError(event?.reason)) {
      event?.preventDefault?.();
      if (redirectForStaleTopicRoute()) {
        return;
      }
    }

    if (isChunkLoadError(event?.reason)) {
      event?.preventDefault?.();
      attemptChunkRecoveryReload();
    }
  });
};

const root = createRoot(document.getElementById('root'));

const renderMaintenanceApp = () => {
  root.render(
    <StrictMode>
      <MaintenanceScreen />
    </StrictMode>,
  );
};

const renderNormalApp = () => {
  void Promise.all([
    import('./components/AppErrorBoundary.jsx'),
    import('./bootstrap/AppProviders.jsx'),
  ]).then(([{ default: AppErrorBoundary }, { default: AppProviders }]) => {
    const normalApp = createElement(
      AppErrorBoundary,
      null,
      createElement(AppProviders),
    );

    root.render(
      <StrictMode>
        {normalApp}
      </StrictMode>,
    );
  }).catch((error) => {
    if (isChunkLoadError(error) && attemptChunkRecoveryReload('app-bootstrap')) {
      return;
    }
    throw error;
  });
};

ensureSocialMetaDefaults();

applyBrowserHints();
installChunkLoadRecovery();
applyPwaCutover();

if (maintenanceModeEnabled) {
  renderMaintenanceApp();
} else {
  renderNormalApp();
  applyNetworkHints();
  scheduleObservabilityInit();
}
