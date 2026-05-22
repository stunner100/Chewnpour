export const TABS = [
    { key: 'overview', label: 'Overview', icon: 'dashboard' },
    { key: 'learning', label: 'Learning', icon: 'school' },
    { key: 'features', label: 'Features', icon: 'analytics' },
    { key: 'revenue', label: 'Revenue', icon: 'payments' },
    { key: 'content', label: 'Content', icon: 'library_books' },
    { key: 'users', label: 'Users', icon: 'group' },
    { key: 'uploads', label: 'Uploads', icon: 'cloud_upload' },
    { key: 'feedback', label: 'Feedback', icon: 'reviews' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
];

export const PAYMENT_PROVIDER_FALLBACK_OPTIONS = [
    {
        id: 'paystack',
        label: 'Paystack',
        requiresKey: true,
        helpText: 'Use the live Paystack checkout and webhook flow.',
    },
    {
        id: 'manual',
        label: 'Manual (no API key)',
        requiresKey: false,
        helpText: 'Skip Paystack API calls and grant credits on callback.',
    },
];