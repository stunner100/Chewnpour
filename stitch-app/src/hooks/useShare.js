import React, { useState, useCallback } from 'react';

// Toast component
export const Toast = ({ message, onClose }) => {
    if (!message) return null;
    
    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
            <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-green-400 dark:text-green-600">check_circle</span>
                <span className="text-sm font-medium">{message}</span>
            </div>
        </div>
    );
};

// Custom toast hook
export const useToast = () => {
    const [toastMessage, setToastMessage] = useState(null);

    const showToast = useCallback((message, duration = 3000) => {
        setToastMessage(message);
        
        setTimeout(() => {
            setToastMessage(null);
        }, duration);
    }, []);

    const hideToast = useCallback(() => {
        setToastMessage(null);
    }, []);

    return { toastMessage, showToast, hideToast };
};

// Share hook
export const useShare = () => {
    const { toastMessage, showToast, hideToast } = useToast();

    const share = useCallback(async (options = {}) => {
        const {
            title = 'StudyMate',
            text = 'Check out my progress on StudyMate!',
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
            title: `${userName}'s StudyMate Profile`,
            text: `Check out ${userName}'s learning progress on StudyMate!`,
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
