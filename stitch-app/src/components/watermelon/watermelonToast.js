export const watermelonToast = (message, options = {}) => {
    if (typeof window !== 'undefined' && window.__watermelonAddToast) {
        return window.__watermelonAddToast({ message, ...options });
    }
    console.warn('WatermelonToaster not mounted. Toast dropped:', message);
    return null;
};
