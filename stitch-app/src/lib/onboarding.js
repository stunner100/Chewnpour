export const resolveOnboardingPath = (profile) => {
    // Signup goes straight to the dashboard. Education level and department
    // are optional and are collected from Settings → Profile.
    void profile;
    return '/dashboard';
};
