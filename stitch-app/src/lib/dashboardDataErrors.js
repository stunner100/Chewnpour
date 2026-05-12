const DISABLED_CONVEX_PATTERNS = [
    /exceeded the free plan limits/i,
    /deployments have been disabled/i,
    /projects are disabled/i,
];

export const getDashboardDataErrorMessage = (error) => {
    const rawMessage = error instanceof Error ? error.message : String(error || '');

    if (DISABLED_CONVEX_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
        return 'The configured Convex deployment is disabled. Re-enable it or point VITE_CONVEX_URL at an active deployment, then reload.';
    }

    return 'Your account loaded, but ChewnPour could not reach your study data. Refresh the page and try again.';
};
