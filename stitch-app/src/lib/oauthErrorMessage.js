const OAUTH_ERROR_MESSAGES = {
    please_restart_the_process: 'Google sign-in was interrupted. Please try again.',
    state_mismatch: 'Google sign-in was interrupted. Please try again.',
    state_not_found: 'Google sign-in was interrupted. Please try again.',
    access_denied: 'Google sign-in was cancelled.',
    no_code: 'Google did not return an authorization code. Please try again.',
    invalid_code: 'Google sign-in expired. Please try again.',
    invalid_callback_request: 'Google sign-in was interrupted. Please try again.',
    oauth_provider_not_found: 'Google sign-in is not available right now.',
    unable_to_get_user_info: 'Could not read your Google account. Please try again.',
    unable_to_link_account: 'Could not link this Google account. Please try again.',
};

const OAUTH_RECOVERY_STORAGE_KEY = 'chewnpour:google-oauth-recovery-attempted';
const RECOVERABLE_OAUTH_ERROR_CODES = new Set([
    'please_restart_the_process',
    'state_mismatch',
    'state_not_found',
    'invalid_callback_request',
    'invalid_code',
    'no_code',
]);

export const messageForOAuthErrorCode = (code) => {
    const key = String(code || '').trim();
    if (!key) return '';
    return OAUTH_ERROR_MESSAGES[key] || 'Google sign-in failed. Please try again.';
};

export const isRecoverableOAuthErrorCode = (code) =>
    RECOVERABLE_OAUTH_ERROR_CODES.has(String(code || '').trim());

export const claimOAuthRecoveryAttempt = () => {
    if (typeof window === 'undefined') return false;
    try {
        if (window.sessionStorage.getItem(OAUTH_RECOVERY_STORAGE_KEY)) return false;
        window.sessionStorage.setItem(OAUTH_RECOVERY_STORAGE_KEY, '1');
        return true;
    } catch {
        return false;
    }
};

export const clearOAuthRecoveryAttempt = () => {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.removeItem(OAUTH_RECOVERY_STORAGE_KEY);
    } catch {
        void 0;
    }
};

export const oauthErrorCodeFromSearchParams = (searchParams) => {
    if (!searchParams || typeof searchParams.get !== 'function') return '';
    const error = String(searchParams.get('error') || '').trim();
    if (error) return error;
    if (searchParams.get('state') === 'state_not_found') return 'state_not_found';
    return '';
};

export const stripOAuthErrorParams = (searchParams) => {
    const next = new URLSearchParams(searchParams);
    next.delete('error');
    next.delete('error_description');
    if (next.get('state') === 'state_not_found') next.delete('state');
    return next;
};
