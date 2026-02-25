import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    authBaseUrl,
    authClient,
    useSession,
    signIn as betterSignIn,
    signUp as betterSignUp,
    signOut as betterSignOut,
} from '../lib/auth-client';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { hasConvexUrl as convexEnabled } from '../lib/convex-config';
import {
    clearPendingOttToken,
    consumeOttFromUrl,
    persistPendingOttToken,
    readPendingOttToken,
} from '../lib/ott';
import { captureSentryException, captureSentryMessage, setSentryUser } from '../lib/sentry';
import { resetPostHogUser, setPostHogUser } from '../lib/posthog';

const AuthContext = createContext({});
const absoluteUrl = (path = '/') => {
    if (typeof window === 'undefined') return path;
    return new URL(path, window.location.origin).toString();
};

const getErrorMessage = (error, fallback = 'Unknown error') => {
    if (!error) return fallback;
    if (typeof error === 'string') return error;

    const directMessage = typeof error.message === 'string' ? error.message.trim() : '';
    if (directMessage) return directMessage;

    const nestedMessage = typeof error.error?.message === 'string'
        ? error.error.message.trim()
        : '';
    if (nestedMessage) return nestedMessage;

    return fallback;
};

const isIgnorableOttError = (error) => {
    const message = getErrorMessage(error, '').toLowerCase();
    return (
        message.includes('invalid token') ||
        message.includes('token not found') ||
        message.includes('expired token') ||
        message.includes('token expired')
    );
};

const shouldRecoverFromOttError = (error) =>
    isIgnorableOttError(error) || isTransientSessionError(error);

const getErrorStatusCode = (error) => {
    if (!error || typeof error !== 'object') return null;
    const status = Number(error.status ?? error.error?.status);
    return Number.isFinite(status) ? status : null;
};

const isTransientSessionError = (error) => {
    if (!error) return false;

    const statusCode = getErrorStatusCode(error);
    if (statusCode === 0) return true;
    if (statusCode === 408 || statusCode === 429) return true;
    if (statusCode !== null && statusCode >= 500) return true;

    const message = getErrorMessage(error, '').toLowerCase();
    return (
        message.includes('network') ||
        message.includes('failed to fetch') ||
        message.includes('load failed') ||
        message.includes('connection lost') ||
        message.includes('timeout') ||
        message.includes('err_')
    );
};

const wait = (durationMs) =>
    new Promise((resolve) => {
        setTimeout(resolve, durationMs);
    });

const normalizeErrorForSentry = (error, fallbackMessage = 'Authentication request failed') => {
    if (error instanceof Error) return error;
    const message = getErrorMessage(error, fallbackMessage);
    const normalized = new Error(message);
    if (error && typeof error === 'object' && typeof error.name === 'string') {
        normalized.name = error.name;
    }
    return normalized;
};

const readNetworkSnapshot = () => {
    if (typeof navigator === 'undefined') {
        return {
            online: null,
            language: null,
            userAgent: null,
            connectionEffectiveType: null,
            connectionDownlink: null,
            connectionRtt: null,
            connectionSaveData: null,
        };
    }

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    return {
        online: typeof navigator.onLine === 'boolean' ? navigator.onLine : null,
        language: navigator.language || null,
        userAgent: navigator.userAgent || null,
        connectionEffectiveType: connection?.effectiveType || null,
        connectionDownlink: Number.isFinite(Number(connection?.downlink))
            ? Number(connection.downlink)
            : null,
        connectionRtt: Number.isFinite(Number(connection?.rtt))
            ? Number(connection.rtt)
            : null,
        connectionSaveData: typeof connection?.saveData === 'boolean'
            ? connection.saveData
            : null,
    };
};

const readPageSnapshot = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return {
            href: null,
            pathname: null,
            search: null,
            hash: null,
            referrer: null,
            visibilityState: null,
        };
    }

    return {
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        referrer: document.referrer || null,
        visibilityState: document.visibilityState || null,
    };
};

const captureAuthFailure = ({
    error,
    operation,
    callbackURL = null,
    provider = null,
    extras = {},
    level = 'error',
}) => {
    const statusCode = getErrorStatusCode(error);
    const message = getErrorMessage(error, 'Authentication request failed');
    const network = readNetworkSnapshot();
    const page = readPageSnapshot();
    const normalizedError = normalizeErrorForSentry(error, message);
    const errorName = typeof error?.name === 'string' ? error.name : normalizedError.name;

    captureSentryException(normalizedError, {
        level,
        tags: {
            area: 'auth',
            operation,
            authSource: 'better_auth_client',
            isTransient: isTransientSessionError(error) ? 'yes' : 'no',
            statusCode: statusCode !== null ? String(statusCode) : 'none',
            online: network.online === null ? 'unknown' : (network.online ? 'yes' : 'no'),
        },
        extras: {
            authBaseUrl,
            callbackURL,
            provider,
            statusCode,
            errorName,
            errorMessage: message,
            pageHref: page.href,
            pagePathname: page.pathname,
            pageSearch: page.search,
            pageHash: page.hash,
            pageReferrer: page.referrer,
            visibilityState: page.visibilityState,
            userAgent: network.userAgent,
            language: network.language,
            connectionEffectiveType: network.connectionEffectiveType,
            connectionDownlink: network.connectionDownlink,
            connectionRtt: network.connectionRtt,
            connectionSaveData: network.connectionSaveData,
            ...extras,
        },
    });
};

const verifyOttTokenWithRetry = async (token, maxRetries = 1) => {
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            const result = await authClient.crossDomain.oneTimeToken.verify({ token });

            if (result.error) {
                throw new Error(
                    getErrorMessage(result.error, 'Failed to verify one-time token')
                );
            }

            return;
        } catch (error) {
            const shouldRetry = isTransientSessionError(error) && attempt < maxRetries;
            if (!shouldRetry) {
                throw error;
            }

            attempt += 1;
            await wait(250 * attempt);
        }
    }
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

const AuthProviderFallback = ({ children }) => {
    const notConfigured = { message: 'Authentication is not configured for this preview deployment.' };

    const value = {
        user: null,
        profile: null,
        loading: false,
        signUp: async () => ({ data: null, error: notConfigured }),
        signIn: async () => ({ data: null, error: notConfigured }),
        signOut: async () => ({ error: null }),
        updateProfile: async () => ({ data: null, error: notConfigured }),
        refreshProfile: () => { },
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

const AuthProviderConvex = ({ children }) => {
    const { data: session, isPending, refetch, error: sessionError } = useSession();
    const [lastKnownUser, setLastKnownUser] = useState(null);

    // Handle OTT (One-Time Token) exchange for cross-domain auth
    const [ottPending, setOttPending] = useState(() => {
        if (typeof window === 'undefined') return false;
        const params = new URLSearchParams(window.location.search);
        if (params.has('ott')) return true;
        return Boolean(readPendingOttToken());
    });

    useEffect(() => {
        if (!ottPending) return;

        const tokenFromUrl = consumeOttFromUrl();
        if (tokenFromUrl) {
            persistPendingOttToken(tokenFromUrl);
        }

        const ott = readPendingOttToken();

        if (!ott) {
            setOttPending(false);
            return;
        }

        const verifyOtt = async () => {
            try {
                await verifyOttTokenWithRetry(ott);
                await refetch();
            } catch (error) {
                if (shouldRecoverFromOttError(error)) {
                    captureSentryMessage('Recoverable OTT verification failure', {
                        level: 'warning',
                        tags: {
                            area: 'auth',
                            operation: 'ott_verify',
                            recoverable: 'yes',
                        },
                        extras: {
                            errorMessage: getErrorMessage(error, 'Failed to verify one-time token'),
                            transient: isTransientSessionError(error),
                        },
                    });
                    // Stale/replayed OTT links or transient network failures can still
                    // produce a valid session; attempt to recover before surfacing errors.
                    await refetch().catch(() => undefined);
                } else {
                    console.error('[AuthContext] OTT verification error:', error);
                    captureAuthFailure({
                        error,
                        operation: 'ott_verify',
                        extras: {
                            recoverable: false,
                        },
                        level: 'error',
                    });
                }
            } finally {
                clearPendingOttToken();
                setOttPending(false);
            }
        };

        verifyOtt();
    }, [ottPending, refetch]);

    // Keep the last authenticated user during transient session fetch failures
    // to avoid redirecting to login during short-lived network disruptions.
    const sessionUser = session?.user ?? null;
    const sessionErrorIsTransient = isTransientSessionError(sessionError);
    const user = sessionUser ?? (sessionErrorIsTransient ? lastKnownUser : null);

    useEffect(() => {
        if (sessionUser) {
            setLastKnownUser(sessionUser);
            return;
        }
        if (!isPending && !sessionError) {
            setLastKnownUser(null);
        }
    }, [sessionUser, isPending, sessionError]);

    const profileData = useQuery(
        api.profiles.getProfile,
        user?.id ? { userId: user.id } : 'skip'
    );
    const profile = profileData ?? null;
    const profileLoading = user ? profileData === undefined : false;
    const loading = isPending || profileLoading || ottPending;

    const upsertProfile = useMutation(api.profiles.upsertProfile);

    useEffect(() => {
        if (!user) {
            setSentryUser(null);
            resetPostHogUser();
            return;
        }
        setSentryUser({
            id: user.id,
            email: user.email,
            username: user.name,
        });
        setPostHogUser({
            id: user.id,
            email: user.email,
            username: user.name,
        });
    }, [user?.id, user?.email, user?.name]);

    const signUp = async (email, password, fullName) => {
        const callbackURL = absoluteUrl('/onboarding/level');
        try {
            const result = await betterSignUp.email({
                email,
                password,
                name: fullName,
                callbackURL,
            });
            if (result.error) {
                if (isTransientSessionError(result.error)) {
                    captureAuthFailure({
                        error: result.error,
                        operation: 'sign_up',
                        callbackURL,
                        extras: {
                            phase: 'result_error',
                        },
                        level: 'warning',
                    });
                }
                return { data: null, error: result.error };
            }
            return { data: result.data, error: null };
        } catch (error) {
            const transient = isTransientSessionError(error);
            captureAuthFailure({
                error,
                operation: 'sign_up',
                callbackURL,
                extras: {
                    phase: 'exception',
                    transient,
                },
                level: transient ? 'warning' : 'error',
            });
            return { data: null, error };
        }
    };

    const signIn = async (email, password) => {
        const callbackURL = absoluteUrl('/dashboard');
        try {
            const result = await betterSignIn.email({
                email,
                password,
                callbackURL,
            });
            if (result.error) {
                if (isTransientSessionError(result.error)) {
                    captureAuthFailure({
                        error: result.error,
                        operation: 'sign_in',
                        callbackURL,
                        extras: {
                            phase: 'result_error',
                        },
                        level: 'warning',
                    });
                }
                return { data: null, error: result.error };
            }
            return { data: result.data, error: null };
        } catch (error) {
            const transient = isTransientSessionError(error);
            captureAuthFailure({
                error,
                operation: 'sign_in',
                callbackURL,
                extras: {
                    phase: 'exception',
                    transient,
                },
                level: transient ? 'warning' : 'error',
            });
            return { data: null, error };
        }
    };

    const signInWithGoogle = async () => {
        const callbackURL = absoluteUrl('/dashboard');
        const provider = 'google';
        try {
            const result = await betterSignIn.social({
                provider,
                callbackURL,
            });
            if (result.error) {
                if (isTransientSessionError(result.error)) {
                    captureAuthFailure({
                        error: result.error,
                        operation: 'sign_in_google',
                        callbackURL,
                        provider,
                        extras: {
                            phase: 'result_error',
                        },
                        level: 'warning',
                    });
                }
                return { data: null, error: result.error };
            }
            return { data: result.data, error: null };
        } catch (error) {
            const transient = isTransientSessionError(error);
            captureAuthFailure({
                error,
                operation: 'sign_in_google',
                callbackURL,
                provider,
                extras: {
                    phase: 'exception',
                    transient,
                },
                level: transient ? 'warning' : 'error',
            });
            return { data: null, error };
        }
    };

    const signOut = async () => {
        try {
            await betterSignOut();
            setLastKnownUser(null);
            return { error: null };
        } catch (error) {
            captureAuthFailure({
                error,
                operation: 'sign_out',
                extras: {
                    phase: 'exception',
                },
                level: 'error',
            });
            return { error };
        }
    };

    const updateProfile = async (updates) => {
        if (!user) return { error: { message: 'No user logged in' } };
        try {
            await upsertProfile({ userId: user.id, ...updates });
            return { data: { ...profile, ...updates }, error: null };
        } catch (error) {
            captureSentryException(error, {
                tags: {
                    area: 'profile',
                    operation: 'update_profile',
                },
            });
            return { data: null, error };
        }
    };

    const value = {
        user,
        profile,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        updateProfile,
        refreshProfile: () => { /* useQuery auto-refreshes */ },
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const AuthProvider = ({ children }) => {
    if (!convexEnabled) {
        return <AuthProviderFallback>{children}</AuthProviderFallback>;
    }

    return <AuthProviderConvex>{children}</AuthProviderConvex>;
};

export default AuthContext;
