import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import AppIcon from './AppIcon';

// Installed PWAs (notoriously on iOS) do not always re-run the service worker
// on launch, so a new deploy can sit in `waiting` while the app keeps serving a
// stale precached shell. Poll for updates while the app is open and surface a
// dismissible prompt so the user reloads into the latest code instead of
// silently running the old bundle for days.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const DISMISS_KEY = 'cp-pwa-update-dismissed-at';
const DISMISS_TTL_MS = 6 * 60 * 60 * 1000;

const readDismissedAt = () => {
    if (typeof localStorage === 'undefined') return 0;
    const raw = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(raw) ? raw : 0;
};

export default function PwaUpdatePrompt() {
    const [dismissedAt, setDismissedAt] = useState(readDismissedAt);
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(_swUrl, registration) {
            if (!registration?.update) return undefined;
            const interval = setInterval(() => {
                registration.update().catch(() => {});
            }, UPDATE_CHECK_INTERVAL_MS);
            return () => clearInterval(interval);
        },
        onRegisterError(error) {
            if (import.meta.env.DEV) console.warn('[pwa] service worker register error', error);
        },
    });

    useEffect(() => {
        if (needRefresh && Date.now() - dismissedAt < DISMISS_TTL_MS) {
            setNeedRefresh(false);
        }
    }, [needRefresh, dismissedAt, setNeedRefresh]);

    if (!needRefresh) return null;

    const handleDismiss = () => {
        const now = Date.now();
        setDismissedAt(now);
        try {
            localStorage.setItem(DISMISS_KEY, String(now));
        } catch {
            // Ignore quota/private-mode errors.
        }
        setNeedRefresh(false);
    };

    const handleReload = async () => {
        try {
            localStorage.removeItem(DISMISS_KEY);
        } catch {
            // Ignore.
        }
        await updateServiceWorker(true);
    };

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 top-0 z-[80] flex justify-center px-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]"
        >
            <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-border-subtle bg-surface px-4 py-3 shadow-lg">
                <AppIcon name="refresh" className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-semibold text-text-primary">Update available</p>
                    <p className="text-caption text-text-muted">Reload to get the latest tutor fixes.</p>
                </div>
                <button
                    type="button"
                    onClick={handleReload}
                    className="btn-primary shrink-0 rounded-full px-4 py-2 text-caption font-semibold"
                >
                    Reload
                </button>
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="Dismiss update notice"
                    className="btn-icon shrink-0 size-8 text-text-muted"
                >
                    <AppIcon name="close" className="text-[18px]" />
                </button>
            </div>
        </div>
    );
}
