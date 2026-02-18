import React from 'react';
import { useNavigate } from 'react-router-dom';

const gradients = [
    'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
    'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
];

const ExamActionModal = ({ isOpen, onClose, attempt }) => {
    const navigate = useNavigate();

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
        onClose();
        navigate('/dashboard/results');
    };

    const handleRetryExam = () => {
        onClose();
        navigate(`/dashboard/exam/${attempt.topicId}`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative w-full max-w-md bg-white dark:bg-surface-dark rounded-3xl shadow-2xl overflow-hidden">
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors"
                >
                    <span className="material-symbols-outlined text-slate-700 dark:text-slate-300">close</span>
                </button>

                {/* Header with Gradient */}
                <div 
                    className="p-8 text-center"
                    style={{ background: gradients[0] }}
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
                <div className="p-6 space-y-3">
                    <button
                        onClick={handleViewResults}
                        className="w-full h-14 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:bg-primary-hover hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">visibility</span>
                        View Full Results
                    </button>
                    
                    <button
                        onClick={handleRetryExam}
                        className="w-full h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">replay</span>
                        Retry Exam
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExamActionModal;
