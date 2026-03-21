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
    { id: 0, style: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)', name: 'Blue' },
    { id: 1, style: 'linear-gradient(135deg, #34a853 0%, #0d9488 100%)', name: 'Green' },
    { id: 2, style: 'linear-gradient(135deg, #ea4335 0%, #d93025 100%)', name: 'Red' },
    { id: 3, style: 'linear-gradient(135deg, #fbbc04 0%, #f59e0b 100%)', name: 'Yellow' },
    { id: 4, style: 'linear-gradient(135deg, #5f6368 0%, #3c4043 100%)', name: 'Gray' },
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
            <div className="w-full max-w-2xl mx-auto px-4 md:px-8 py-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-24 w-24 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark mx-auto" />
                    <div className="space-y-4">
                        <div className="h-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark" />
                        <div className="h-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark" />
                        <div className="h-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto px-4 md:px-8 py-8 pb-24 md:pb-12 space-y-8">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark">Edit Profile</h1>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="text-body-sm font-semibold text-primary hover:text-primary-hover disabled:opacity-50 transition-colors"
                >
                    {isSaving ? 'Saving...' : 'Save'}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                    <p className="text-body-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Avatar Section */}
            <div className="card-base p-6 flex flex-col items-center gap-5">
                <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold"
                    style={{ background: GRADIENTS[selectedGradient].style }}
                >
                    {initial}
                </div>

                <div className="flex items-center gap-3">
                    {GRADIENTS.map((gradient) => (
                        <button
                            key={gradient.id}
                            onClick={() => setSelectedGradient(gradient.id)}
                            className={`w-8 h-8 rounded-full transition-all ${
                                selectedGradient === gradient.id
                                    ? 'ring-2 ring-offset-2 ring-primary ring-offset-surface-light dark:ring-offset-surface-dark scale-110'
                                    : 'hover:scale-105'
                            }`}
                            style={{ background: gradient.style }}
                            aria-label={`Select ${gradient.name} color`}
                        />
                    ))}
                </div>
                <p className="text-caption text-text-faint-light dark:text-text-faint-dark">Choose your avatar color</p>
            </div>

            {/* Form Fields */}
            <div className="card-base divide-y divide-border-light dark:divide-border-dark">
                {/* Full Name */}
                <div className="p-4 space-y-2">
                    <label className="text-caption font-semibold text-text-sub-light dark:text-text-sub-dark">
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
                        className="input-field text-body-sm"
                    />
                </div>

                {/* Education Level */}
                <div className="p-4 space-y-2">
                    <label className="text-caption font-semibold text-text-sub-light dark:text-text-sub-dark">
                        Education Level
                    </label>
                    <div className="relative">
                        <select
                            value={educationLevel}
                            onChange={(e) => setEducationLevel(e.target.value)}
                            className="input-field text-body-sm appearance-none pr-10 cursor-pointer"
                        >
                            <option value="">Select your level</option>
                            {Object.entries(EDUCATION_LEVELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-faint-light dark:text-text-faint-dark text-[18px] pointer-events-none">
                            expand_more
                        </span>
                    </div>
                </div>

                {/* Department */}
                <div className="p-4 space-y-2">
                    <label className="text-caption font-semibold text-text-sub-light dark:text-text-sub-dark">
                        Department
                    </label>
                    <div className="relative">
                        <select
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            className="input-field text-body-sm appearance-none pr-10 cursor-pointer"
                        >
                            <option value="">Select your department</option>
                            {Object.entries(DEPARTMENTS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-faint-light dark:text-text-faint-dark text-[18px] pointer-events-none">
                            expand_more
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={handleCancel}
                    className="flex-1 btn-secondary text-body-sm py-2.5"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 btn-primary text-body-sm py-2.5"
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
};

export default EditProfile;
