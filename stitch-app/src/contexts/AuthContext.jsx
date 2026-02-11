import React, { createContext, useContext, useState, useEffect } from 'react';
import { authClient, useSession, signIn as betterSignIn, signUp as betterSignUp, signOut as betterSignOut } from '../lib/auth-client';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { hasConvexUrl as convexEnabled } from '../lib/convex-config';

const AuthContext = createContext({});
const absoluteUrl = (path = '/') => {
    if (typeof window === 'undefined') return path;
    return new URL(path, window.location.origin).toString();
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
    const { data: session, isPending, refetch } = useSession();

    // Handle OTT (One-Time Token) exchange for cross-domain auth
    const [ottPending, setOttPending] = useState(() => {
        if (typeof window === 'undefined') return false;
        const params = new URLSearchParams(window.location.search);
        return params.has('ott');
    });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const ott = params.get('ott');

        if (ott && ottPending) {
            const verifyOtt = async () => {
                try {
                    const result = await authClient.crossDomain.oneTimeToken.verify({
                        token: ott,
                    });

                    if (result.error) {
                        throw new Error(result.error.message || 'Failed to verify one-time token');
                    }

                    await refetch();
                } catch (error) {
                    console.error('[AuthContext] OTT verification error:', error);
                } finally {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('ott');
                    window.history.replaceState({}, '', url.toString());
                    setOttPending(false);
                }
            };

            verifyOtt();
        }
    }, [ottPending, refetch]);

    // The user from Better Auth session
    const user = session?.user ?? null;
    const profileData = useQuery(
        api.profiles.getProfile,
        user?.id ? { userId: user.id } : 'skip'
    );
    const profile = profileData ?? null;
    const profileLoading = user ? profileData === undefined : false;
    const loading = isPending || profileLoading || ottPending;

    const upsertProfile = useMutation(api.profiles.upsertProfile);

    const signUp = async (email, password, fullName) => {
        try {
            const result = await betterSignUp.email({
                email,
                password,
                name: fullName,
                callbackURL: absoluteUrl('/onboarding/level'),
            });
            if (result.error) {
                return { data: null, error: result.error };
            }
            return { data: result.data, error: null };
        } catch (error) {
            return { data: null, error };
        }
    };

    const signIn = async (email, password) => {
        try {
            const result = await betterSignIn.email({
                email,
                password,
                callbackURL: absoluteUrl('/dashboard'),
            });
            if (result.error) {
                return { data: null, error: result.error };
            }
            return { data: result.data, error: null };
        } catch (error) {
            return { data: null, error };
        }
    };

    const signInWithGoogle = async () => {
        try {
            const result = await betterSignIn.social({
                provider: "google",
                callbackURL: absoluteUrl('/dashboard'),
            });
            if (result.error) {
                return { data: null, error: result.error };
            }
            return { data: result.data, error: null };
        } catch (error) {
            return { data: null, error };
        }
    };

    const signOut = async () => {
        try {
            await betterSignOut();
            return { error: null };
        } catch (error) {
            return { error };
        }
    };

    const updateProfile = async (updates) => {
        if (!user) return { error: { message: 'No user logged in' } };
        try {
            await upsertProfile({ userId: user.id, ...updates });
            return { data: { ...profile, ...updates }, error: null };
        } catch (error) {
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
