import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { resolveOnboardingPath } from '../lib/onboarding';

const ONBOARDING_PATHS = ['/onboarding/name', '/onboarding/level', '/onboarding/department'];
const LOADING_TIMEOUT_MS = 15000;

const LoadingTimeoutGuard = ({ delayMs = LOADING_TIMEOUT_MS, children }) => {
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setTimedOut(true);
        }, delayMs);
        return () => clearTimeout(timeout);
    }, [delayMs]);

    return children(timedOut);
};

const ProtectedRoute = ({ children }) => {
    const { user, profile, loading, profileReady } = useAuth();
    const location = useLocation();
    const isOnboardingRoute = ONBOARDING_PATHS.some((p) => location.pathname.startsWith(p));

    if (loading && user && profileReady) {
        return children;
    }

    if (loading || (user && !profileReady)) {
        return (
            <LoadingTimeoutGuard key={location.pathname}>
                {(loadingTimedOut) => {
                    if (loadingTimedOut && user) {
                        return children;
                    }
                    if (loadingTimedOut && isOnboardingRoute && !user) {
                        return <Navigate to="/login" state={{ from: location }} replace />;
                    }
                    return (
                        <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-10 h-10 border-[3px] border-slate-200 dark:border-slate-700 border-t-primary rounded-full animate-spin"></div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading your account...</p>
                            </div>
                        </div>
                    );
                }}
            </LoadingTimeoutGuard>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Redirect users who haven't completed onboarding to the onboarding flow
    // (skip this check if they're already on an onboarding page)
    const onboardingPath = resolveOnboardingPath(profile);
    if (!isOnboardingRoute && onboardingPath !== '/dashboard') {
        return <Navigate to={onboardingPath} replace />;
    }

    return children;
};

export default ProtectedRoute;
