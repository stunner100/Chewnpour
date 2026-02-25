const OTT_STORAGE_KEY = 'stitch:pending-ott';

const hasBrowserRuntime = () =>
  typeof window !== 'undefined' &&
  typeof window.location !== 'undefined' &&
  typeof window.history !== 'undefined';

export const readPendingOttToken = () => {
  if (!hasBrowserRuntime()) return '';

  try {
    return String(window.sessionStorage.getItem(OTT_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
};

export const clearPendingOttToken = () => {
  if (!hasBrowserRuntime()) return;
  try {
    window.sessionStorage.removeItem(OTT_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

export const persistPendingOttToken = (token) => {
  const normalized = String(token || '').trim();
  if (!normalized || !hasBrowserRuntime()) return;
  try {
    window.sessionStorage.setItem(OTT_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures.
  }
};

export const consumeOttFromUrl = () => {
  if (!hasBrowserRuntime()) return '';

  let url;
  try {
    url = new URL(window.location.href);
  } catch {
    return '';
  }

  const token = String(url.searchParams.get('ott') || '').trim();
  if (!token) return '';

  url.searchParams.delete('ott');
  window.history.replaceState({}, '', url.toString());
  return token;
};

export const stashOttFromUrl = () => {
  const token = consumeOttFromUrl();
  if (token) {
    persistPendingOttToken(token);
  }
  return token;
};
