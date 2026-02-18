import React from 'react';

const Toast = ({ message, onClose }) => {
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

export default Toast;
