import { resolveOnboardingPath } from './onboarding.js';

export const ONBOARDING_PATHS = ['/onboarding/name', '/onboarding/level', '/onboarding/department'];

export const resolveProtectedRouteState = ({
    loading,
    user,
    profile,
    profileReady,
    pathname,
}) => {
    const isOnboardingRoute = ONBOARDING_PATHS.some((routePath) => pathname.startsWith(routePath));

    if (loading) {
        return {
            type: 'loading',
            isOnboardingRoute,
        };
    }

    if (!user) {
        return {
            type: 'login',
            isOnboardingRoute,
        };
    }

    if (profileReady) {
        const onboardingPath = resolveOnboardingPath(profile);
        if (!isOnboardingRoute && onboardingPath !== '/dashboard') {
            return {
                type: 'onboarding',
                isOnboardingRoute,
                onboardingPath,
            };
        }
    }

    return {
        type: 'render',
        isOnboardingRoute,
    };
};
