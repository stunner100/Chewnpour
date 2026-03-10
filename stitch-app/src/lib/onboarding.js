export const resolveOnboardingPath = (profile) => {
    // With the streamlined onboarding flow, users go directly from
    // signup to dashboard. Level and department are optional and can
    // be filled in later from the Profile page.
    if (!profile) {
        // Profile not yet created -- let the user through to dashboard
        // where auto-creation will handle it.
        return '/dashboard';
    }

    if (profile.onboardingCompleted === true) {
        return '/dashboard';
    }

    // Legacy: users who signed up under the old multi-step flow but
    // never finished still get sent to dashboard (not back to onboarding).
    return '/dashboard';
};
