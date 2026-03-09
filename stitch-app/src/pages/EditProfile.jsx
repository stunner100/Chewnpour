import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const EDUCATION_LEVELS = {
    'freshman': 'Level 1',
    'sophomore': 'Level 2',
    'junior': 'Level 3',
    'senior': 'Level 4',
    'high_school': 'High School',
    'undergrad': 'Undergraduate',
    'postgrad': 'Postgraduate',
    'professional': 'Professional'
};

const DEPARTMENTS = {
    'cs': 'Computer Science',
    'business': 'Business',
    'engineering': 'Engineering',
    'nursing': 'Nursing',
    'economics': 'Economics',
    'psychology': 'Psychology',
    'arts': 'Arts & Design',
    'biology': 'Biology',
    'law': 'Law',
    'math': 'Mathematics'
};

const GRADIENTS = [
    { id: 0, style: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', name: 'Indigo' },
    { id: 1, style: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', name: 'Blue' },
    { id: 2, style: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', name: 'Pink' },
    { id: 3, style: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)', name: 'Emerald' },
    { id: 4, style: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', name: 'Amber' },
];

const EditProfile = () => {
    const navigate = useNavigate();
    const { user, profile, updateProfile, loading: authLoading } = useAuth();
    
    const [fullName, setFullName] = useState('');
    const [educationLevel, setEducationLevel] = useState('');
    const [department, setDepartment] = useState('');
    const [selectedGradient, setSelectedGradient] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Initialize form with current profile data
    useEffect(() => {
        if (profile) {
            const gradientValue = Number(profile.avatarGradient);
            const safeGradient =
                Number.isInteger(gradientValue)
                && gradientValue >= 0
                && gradientValue < GRADIENTS.length
                    ? gradientValue
                    : 0;
            setFullName(profile.fullName || '');
            setEducationLevel(profile.educationLevel || '');
            setDepartment(profile.department || '');
            setSelectedGradient(safeGradient);
        }
    }, [profile]);

    const displayName = fullName || user?.name || user?.email?.split('@')[0] || 'Student';
    const initial = displayName.charAt(0).toUpperCase();

    const handleSave = async () => {
        if (!fullName.trim()) {
            setError('Please enter your name');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            const { error: updateError } = await updateProfile({
                fullName: fullName.trim(),
                educationLevel,
                department,
                avatarGradient: selectedGradient
            });

            if (updateError) {
                setError(updateError.message || 'Failed to save changes');
            } else {
                navigate('/profile', { replace: true });
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        navigate('/profile');
    };

    if (authLoading || !profile) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark font-body antialiased text-neutral-900 dark:text-neutral-100 min-h-screen flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 flex items-center justify-between glass border-b border-neutral-200/50 dark:border-neutral-800/50 p-4">
                <button 
                    onClick={handleCancel}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-primary transition-all"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold">Edit Profile</h1>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="text-sm font-bold text-primary hover:text-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isSaving ? 'Saving...' : 'Save'}
                </button>
            </header>

            {/* Form Content */}
            <main className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-6 pb-24 space-y-8">
                {/* Error Message */}
                {error && (
                    <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium">
                        {error}
                    </div>
                )}

                {/* Avatar Section */}
                <section className="flex flex-col items-center gap-6">
                    <div 
                        className="w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-lg"
                        style={{ background: GRADIENTS[selectedGradient].style }}
                    >
                        {initial}
                    </div>
                    
                    {/* Gradient Picker */}
                    <div className="flex items-center gap-3">
                        {GRADIENTS.map((gradient) => (
                            <button
                                key={gradient.id}
                                onClick={() => setSelectedGradient(gradient.id)}
                                className={`w-10 h-10 rounded-full transition-all duration-200 ${
                                    selectedGradient === gradient.id 
                                        ? 'ring-2 ring-offset-2 ring-primary scale-110' 
                                        : 'hover:scale-105'
                                }`}
                                style={{ background: gradient.style }}
                                aria-label={`Select ${gradient.name} color`}
                            />
                        ))}
                    </div>
                    <p className="text-xs text-neutral-400">Choose your avatar color</p>
                </section>

                {/* Form Fields */}
                <section className="space-y-6">
                    {/* Full Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => {
                                setFullName(e.target.value);
                                if (error) setError('');
                            }}
                            placeholder="Enter your full name"
                            className="w-full h-14 px-4 rounded-2xl bg-white dark:bg-surface-dark border-2 border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                        />
                    </div>

                    {/* Education Level */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                            Education Level
                        </label>
                        <div className="relative">
                            <select
                                value={educationLevel}
                                onChange={(e) => setEducationLevel(e.target.value)}
                                className="w-full h-14 px-4 pr-12 rounded-2xl bg-white dark:bg-surface-dark border-2 border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white appearance-none focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                            >
                                <option value="">Select your level</option>
                                {Object.entries(EDUCATION_LEVELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                                expand_more
                            </span>
                        </div>
                    </div>

                    {/* Department */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                            Department
                        </label>
                        <div className="relative">
                            <select
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                className="w-full h-14 px-4 pr-12 rounded-2xl bg-white dark:bg-surface-dark border-2 border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white appearance-none focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                            >
                                <option value="">Select your department</option>
                                {Object.entries(DEPARTMENTS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                                expand_more
                            </span>
                        </div>
                    </div>
                </section>
            </main>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark safe-area-bottom">
                <div className="max-w-2xl mx-auto flex gap-3">
                    <button
                        onClick={handleCancel}
                        className="flex-1 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 h-14 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:bg-primary-hover hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditProfile;
