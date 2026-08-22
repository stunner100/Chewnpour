import React, { createContext, use, useEffect, useState } from 'react';
import {
    authBaseUrl,
    useSession,
    signIn as betterSignIn,
    signUp as betterSignUp,
    signOut as betterSignOut,
} from '../lib/auth-client';
import { captureSentryException, setSentryUser } from '../lib/sentry';
import { resetPostHogUser, setPostHogUser } from '../lib/posthog';

const AuthContext = createContext({});

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

const getErrorStatusCode = (error) => {
    if (!error || typeof error !== 'object') return null;
    const status = Number(error.status ?? error.error?.status);
    return Number.isFinite(status) ? status : null;
};

const isTransientSessionError = (error) => {
    if (!error) return false;

    const statusCode = getErrorStatusCode(error);
    if (statusCode === 0 || statusCode === 408 || statusCode === 429) return true;
    if (statusCode === 502 || statusCode === 503 || statusCode === 504) return true;

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

const readCachedSessionUser = () => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem('better-auth_session_data');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const cachedUser = parsed?.user;
        return cachedUser && typeof cachedUser.id === 'string' ? cachedUser : null;
    } catch {
        return null;
    }
};

const syncAuthAnalyticsUser = (sessionUser) => {
    const activeUserId = sessionUser?.id;
    if (!activeUserId) {
        setSentryUser(null);
        resetPostHogUser();
        return;
    }

    setSentryUser({
        id: activeUserId,
        email: sessionUser?.email,
        username: sessionUser?.name,
    });
    setPostHogUser({
        id: activeUserId,
        email: sessionUser?.email,
        username: sessionUser?.name,
    });
};

const normalizeErrorForSentry = (error, fallbackMessage = 'Authentication request failed') => {
    if (error instanceof Error) return error;
    const message = getErrorMessage(error, fallbackMessage);
    const normalized = new Error(message);
    if (error && typeof error === 'object' && typeof error.name === 'string') {
        normalized.name = error.name;
    }
    return normalized;
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
    const normalizedError = normalizeErrorForSentry(error, message);

    captureSentryException(normalizedError, {
        level,
        tags: {
            area: 'auth',
            operation,
            authSource: 'better_auth_supabase',
            isTransient: isTransientSessionError(error) ? 'yes' : 'no',
            statusCode: statusCode !== null ? String(statusCode) : 'none',
        },
        extras: {
            authBaseUrl,
            callbackURL,
            provider,
            statusCode,
            errorMessage: message,
            ...extras,
        },
    });
};

const fetchProfileFromApi = async () => {
    const response = await fetch('/api/profile', {
        method: 'GET',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload?.error || `Profile fetch failed (${response.status})`);
        error.status = response.status;
        throw error;
    }
    return payload?.profile || null;
};

const patchProfileOnApi = async (updates) => {
    const response = await fetch('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates || {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload?.error || `Profile update failed (${response.status})`);
        error.status = response.status;
        throw error;
    }
    return payload?.profile || null;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = use(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const { data: session, isPending, error: sessionError } = useSession();
    const [lastKnownUser, setLastKnownUser] = useState(() => readCachedSessionUser());
    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileReady, setProfileReady] = useState(false);

    const sessionUser = session?.user ?? null;
    const sessionErrorIsTransient = isTransientSessionError(sessionError);
    const user = sessionUser ?? ((isPending || sessionErrorIsTransient) ? lastKnownUser : null);

    useEffect(() => {
        if (sessionUser || !isPending) return;
        const cachedUser = readCachedSessionUser();
        if (!cachedUser) return;
        setLastKnownUser((currentUser) => currentUser ?? cachedUser);
    }, [sessionUser, isPending]);

    useEffect(() => {
        if (sessionUser) {
            setLastKnownUser(sessionUser);
            return;
        }
        if (!isPending && !sessionError) {
            setLastKnownUser(null);
        }
    }, [sessionUser, isPending, sessionError]);

    useEffect(() => {
        syncAuthAnalyticsUser(user);
    }, [user]);

    useEffect(() => {
        let cancelled = false;

        if (!sessionUser?.id) {
            setProfile(null);
            setProfileLoading(false);
            setProfileReady(true);
            return undefined;
        }

        setProfileReady(false);
        setProfileLoading(true);

        const loadProfile = async () => {
            try {
                const nextProfile = await fetchProfileFromApi();
                if (cancelled) return;
                setProfile(nextProfile);
            } catch (error) {
                if (cancelled) return;
                captureAuthFailure({
                    error,
                    operation: 'profile_fetch',
                    extras: { phase: 'exception' },
                    level: isTransientSessionError(error) ? 'warning' : 'error',
                });
                setProfile(null);
            } finally {
                if (!cancelled) {
                    setProfileLoading(false);
                    setProfileReady(true);
                }
            }
        };

        loadProfile();
        return () => {
            cancelled = true;
        };
    }, [sessionUser?.id]);

    const loading = (isPending && !user) || (Boolean(user) && !profileReady) || profileLoading;

    const refreshProfile = async () => {
        if (!user?.id) {
            setProfile(null);
            setProfileReady(true);
            return { data: null, error: null };
        }
        setProfileLoading(true);
        try {
            const nextProfile = await fetchProfileFromApi();
            setProfile(nextProfile);
            setProfileReady(true);
            return { data: nextProfile, error: null };
        } catch (error) {
            captureAuthFailure({
                error,
                operation: 'profile_refresh',
                extras: { phase: 'exception' },
                level: isTransientSessionError(error) ? 'warning' : 'error',
            });
            return { data: null, error };
        } finally {
            setProfileLoading(false);
        }
    };

    const signUp = async (email, password, metadata = {}) => {
        try {
            const rawName = typeof metadata === 'string' || typeof metadata === 'number'
                ? metadata
                : (metadata?.full_name || metadata?.name || '');
            const name = String(rawName || email.split('@')[0] || '').trim();
            const result = await betterSignUp.email({
                email,
                password,
                name,
            });
            if (result.error) {
                captureAuthFailure({
                    error: result.error,
                    operation: 'sign_up_email',
                    extras: { phase: 'result_error' },
                    level: isTransientSessionError(result.error) ? 'warning' : 'error',
                });
                return { data: null, error: result.error };
            }
            return { data: result.data, error: null };
        } catch (error) {
            captureAuthFailure({
                error,
                operation: 'sign_up_email',
                extras: { phase: 'exception' },
                level: isTransientSessionError(error) ? 'warning' : 'error',
            });
            return { data: null, error };
        }
    };

    const signIn = async (email, password) => {
        try {
            const result = await betterSignIn.email({
                email,
                password,
            });
            if (result.error) {
                captureAuthFailure({
                    error: result.error,
                    operation: 'sign_in_email',
                    extras: { phase: 'result_error' },
                    level: isTransientSessionError(result.error) ? 'warning' : 'error',
                });
                return { data: null, error: result.error };
            }
            return { data: result.data, error: null };
        } catch (error) {
            captureAuthFailure({
                error,
                operation: 'sign_in_email',
                extras: { phase: 'exception' },
                level: isTransientSessionError(error) ? 'warning' : 'error',
            });
            return { data: null, error };
        }
    };

    const signInWithGoogle = async (callbackPath = '/dashboard') => {
        const normalizedCallbackPath =
            typeof callbackPath === 'string' && callbackPath.trim().startsWith('/')
                ? callbackPath.trim()
                : '/dashboard';
        const startURL = `/api/auth/google-start?${new URLSearchParams({
            callbackURL: normalizedCallbackPath,
        }).toString()}`;

        try {
            if (typeof window === 'undefined') {
                return {
                    data: null,
                    error: { message: 'Google sign-in requires a browser window' },
                };
            }
            window.location.assign(startURL);
            return { data: { redirect: true }, error: null };
        } catch (error) {
            captureAuthFailure({
                error,
                operation: 'sign_in_google',
                callbackURL: startURL,
                provider: 'google',
                extras: { phase: 'navigation_start' },
                level: isTransientSessionError(error) ? 'warning' : 'error',
            });
            return { data: null, error };
        }
    };

    const signOut = async () => {
        try {
            await betterSignOut();
            setLastKnownUser(null);
            setProfile(null);
            setProfileReady(true);
            return { error: null };
        } catch (error) {
            captureAuthFailure({
                error,
                operation: 'sign_out',
                extras: { phase: 'exception' },
                level: isTransientSessionError(error) ? 'warning' : 'error',
            });
            return { error };
        }
    };

    const updateProfile = async (updates) => {
        if (!user) return { error: { message: 'No user logged in' } };
        try {
            const nextProfile = await patchProfileOnApi(updates);
            setProfile(nextProfile);
            setProfileReady(true);
            return { data: nextProfile, error: null };
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
        profileReady,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        updateProfile,
        refreshProfile,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
