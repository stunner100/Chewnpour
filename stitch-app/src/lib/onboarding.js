export const resolveOnboardingPath = (profile) => {
    if (profile?.onboardingCompleted === true) {
        return '/dashboard';
    }

    const educationLevel = typeof profile?.educationLevel === 'string'
        ? profile.educationLevel.trim()
        : '';

    if (educationLevel) {
        return '/onboarding/department';
    }

    return '/onboarding/level';
};
