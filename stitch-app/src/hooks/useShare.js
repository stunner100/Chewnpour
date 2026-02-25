import { useState, useCallback, useEffect, useRef } from 'react';

// Custom toast hook
export const useToast = () => {
    const [toastMessage, setToastMessage] = useState(null);
    const dismissTimerRef = useRef(null);

    const clearDismissTimer = useCallback(() => {
        if (dismissTimerRef.current) {
            clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = null;
        }
    }, []);

    const showToast = useCallback((message, duration = 3000) => {
        clearDismissTimer();
        setToastMessage(message);

        dismissTimerRef.current = setTimeout(() => {
            setToastMessage(null);
            dismissTimerRef.current = null;
        }, duration);
    }, [clearDismissTimer]);

    const hideToast = useCallback(() => {
        clearDismissTimer();
        setToastMessage(null);
    }, [clearDismissTimer]);

    useEffect(() => {
        return () => {
            clearDismissTimer();
        };
    }, [clearDismissTimer]);

    return { toastMessage, showToast, hideToast };
};

// Share hook
export const useShare = () => {
    const { toastMessage, showToast, hideToast } = useToast();

    const share = useCallback(async (options = {}) => {
        const {
            title = 'ChewnPour',
            text = 'Check out my progress on ChewnPour!',
            url = window.location.href
        } = options;

        // Check if Web Share API is available (mobile)
        if (navigator.share) {
            try {
                await navigator.share({
                    title,
                    text,
                    url
                });
                return { success: true, method: 'native' };
            } catch (error) {
                // User cancelled or share failed, fall through to clipboard
                if (error.name === 'AbortError') {
                    return { success: false, cancelled: true };
                }
            }
        }

        // Fallback: Copy to clipboard
        try {
            await navigator.clipboard.writeText(url);
            showToast('Link copied to clipboard!');
            return { success: true, method: 'clipboard' };
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            showToast('Failed to share. Please try again.');
            return { success: false, error };
        }
    }, [showToast]);

    const shareProfile = useCallback((userName) => {
        return share({
            title: `${userName}'s ChewnPour Profile`,
            text: `Check out ${userName}'s learning progress on ChewnPour!`,
            url: window.location.href
        });
    }, [share]);

    return {
        share,
        shareProfile,
        toastMessage,
        hideToast
    };
};

export default useShare;
