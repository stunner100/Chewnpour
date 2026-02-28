import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ONBOARDING_PATHS = ['/onboarding/level', '/onboarding/department'];

const ProtectedRoute = ({ children }) => {
    const { user, profile, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const isOnboardingRoute = ONBOARDING_PATHS.some((p) => location.pathname.startsWith(p));

    // Redirect users who haven't completed onboarding to the onboarding flow
    // (skip this check if they're already on an onboarding page)
    if (!isOnboardingRoute && !profile?.onboardingCompleted) {
        return <Navigate to="/onboarding/level" replace />;
    }

    return children;
};

export default ProtectedRoute;
