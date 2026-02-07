import React, { createContext, useContext } from 'react';
import { useSession, signIn as betterSignIn, signUp as betterSignUp, signOut as betterSignOut } from '../lib/auth-client';
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
    const { data: session, isPending } = useSession();

    // The user from Better Auth session
    const user = session?.user ?? null;
    const profileData = useQuery(
        api.profiles.getProfile,
        user?.id ? { userId: user.id } : 'skip'
    );
    const profile = profileData ?? null;
    const profileLoading = user ? profileData === undefined : false;
    const loading = isPending || profileLoading;

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
