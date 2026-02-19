import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Haptic feedback helper
const triggerHaptic = (type = 'light') => {
    if (navigator.vibrate) {
        const patterns = {
            light: 10,
            medium: 20,
            heavy: 30,
            success: [10, 50, 10],
            error: [50, 100, 50]
        };
        navigator.vibrate(patterns[type] || patterns.light);
    }
};

const gradients = [
    'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
    'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
];

const ExamActionModal = ({ isOpen, onClose, attempt }) => {
    const navigate = useNavigate();
    const modalRef = useRef(null);
    const [translateY, setTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const currentTranslateY = useRef(0);

    // Handle touch start for swipe-to-close (only on header/drag handle)
    const handleTouchStart = useCallback((e) => {
        setIsDragging(true);
        startY.current = e.touches[0].clientY;
        currentTranslateY.current = translateY;
    }, [translateY]);

    // Handle touch move
    const handleTouchMove = useCallback((e) => {
        if (!isDragging) return;

        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        if (diff > 0) {
            const resistance = 0.6;
            setTranslateY(currentTranslateY.current + (diff * resistance));
        }
    }, [isDragging]);

    // Handle touch end
    const handleTouchEnd = useCallback(() => {
        if (!isDragging) return;

        setIsDragging(false);

        if (translateY > 100) {
            triggerHaptic('light');
            onClose();
        } else {
            setTranslateY(0);
        }
    }, [isDragging, translateY, onClose]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (!isOpen) return;
        
        // Always ensure scroll is locked when modal is open
        setTranslateY(0);
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        
        // Save scroll position
        const scrollY = window.scrollY;
        
        return () => {
            // Restore scroll
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
            window.scrollTo(0, scrollY);
        };
    }, [isOpen]);

    // Add keyboard escape handler
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !attempt) return null;

    const scorePercent = Math.round((attempt.score / attempt.totalQuestions) * 100);
    const isExcellent = scorePercent >= 80;
    const isGood = scorePercent >= 60;

    const formattedDate = new Date(attempt._creationTime).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const handleViewResults = () => {
        triggerHaptic('medium');
        onClose();
        navigate('/dashboard/results');
    };

    const handleRetryExam = () => {
        triggerHaptic('medium');
        onClose();
        navigate(`/dashboard/exam/${attempt.topicId}`);
    };

    const handleCloseClick = () => {
        triggerHaptic('light');
        onClose();
    };

    // Prevent touch events from bubbling when scrolling content
    const handleContentTouch = useCallback((e) => {
        e.stopPropagation();
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={handleCloseClick}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ opacity: 1 - (translateY / 500) }}
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative w-full max-w-md bg-white dark:bg-surface-dark rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[75vh] md:max-h-[85vh] flex flex-col mb-safe"
                style={{
                    transform: `translateY(${translateY}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    overscrollBehavior: 'contain'
                }}
            >
                {/* Scrollable Content */}
                <div 
                    className="overflow-y-auto"
                    style={{ overscrollBehavior: 'contain' }}
                >
                {/* Drag Handle (Mobile Only) */}
                <div 
                    className="drag-handle md:hidden w-full pt-3 pb-1 flex justify-center absolute top-0 left-0 right-0 z-20"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="w-12 h-1.5 bg-white/50 rounded-full pointer-events-none"></div>
                </div>

                {/* Close Button */}
                <button
                    onClick={handleCloseClick}
                    className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors active:scale-95"
                >
                    <span className="material-symbols-outlined text-slate-700 dark:text-slate-300">close</span>
                </button>

                {/* Header with Gradient */}
                <div
                    className="modal-header p-8 text-center cursor-grab active:cursor-grabbing"
                    style={{ background: gradients[0] }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-4xl text-white filled">quiz</span>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1">
                        {attempt.topicTitle || 'Exam'}
                    </h2>
                    <p className="text-white/80 text-sm">{formattedDate}</p>
                </div>

                {/* Score Section */}
                <div className="p-6 text-center border-b border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Your Score</p>
                    <div className="flex items-center justify-center gap-2">
                        <span className={`text-5xl font-bold ${
                            isExcellent ? 'text-green-600' :
                            isGood ? 'text-amber-600' : 'text-red-600'
                        }`}>
                            {scorePercent}%
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                        {attempt.score} / {attempt.totalQuestions} correct
                    </p>

                    {/* Score Badge */}
                    <div className="mt-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                            isExcellent
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : isGood
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                            <span className="material-symbols-outlined text-[14px] filled">
                                {isExcellent ? 'emoji_events' : isGood ? 'thumb_up' : 'trending_up'}
                            </span>
                            {isExcellent ? 'Excellent!' : isGood ? 'Good Job!' : 'Keep Practicing!'}
                        </span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="p-6 pb-20 md:pb-6 space-y-3">
                    <button
                        onClick={handleViewResults}
                        className="w-full h-14 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:bg-primary-hover hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">visibility</span>
                        View Full Results
                    </button>

                    <button
                        onClick={handleRetryExam}
                        className="w-full h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">replay</span>
                        Retry Exam
                    </button>
                </div>
                </div>
            </div>
        </div>
    );
};

export default ExamActionModal;
