import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const StudentDashboard = () => {
    const { user, profile } = useAuth();
    const displayName = String(profile?.fullName || user?.name || user?.email || 'there').trim();
    const education = profile?.educationLevel || null;
    const department = profile?.department || null;
    const onboardingDone = profile?.onboardingCompleted === true;

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background-light px-space-6 py-space-10">
            <section className="mx-auto max-w-3xl">
                <p className="text-body-sm font-medium text-text-secondary">Welcome back</p>
                <h1 className="mt-2 font-headline-lg text-headline-lg font-bold text-text-primary">
                    {displayName}
                </h1>
                <p className="mt-4 max-w-xl text-body text-text-secondary">
                    Your profile, uploads, courses, and quizzes now run on Supabase.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border-subtle bg-surface p-space-6">
                        <p className="text-body-sm font-medium text-text-secondary">Profile</p>
                        <dl className="mt-4 space-y-3 text-body-sm">
                            <div>
                                <dt className="text-text-secondary">Email</dt>
                                <dd className="mt-1 font-medium text-text-primary">{user?.email || '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-text-secondary">Education</dt>
                                <dd className="mt-1 font-medium text-text-primary">{education || 'Not set'}</dd>
                            </div>
                            <div>
                                <dt className="text-text-secondary">Department</dt>
                                <dd className="mt-1 font-medium text-text-primary">{department || 'Not set'}</dd>
                            </div>
                            <div>
                                <dt className="text-text-secondary">Onboarding</dt>
                                <dd className="mt-1 font-medium text-text-primary">
                                    {onboardingDone ? 'Complete' : 'Incomplete'}
                                </dd>
                            </div>
                        </dl>
                        <Link
                            to="/dashboard/settings#profile"
                            className="btn-secondary mt-6 inline-flex text-body-sm"
                        >
                            Edit profile
                        </Link>
                    </div>

                    <div className="rounded-2xl border border-border-subtle bg-surface p-space-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                            <span aria-hidden="true" className="material-symbols-outlined">
                                menu_book
                            </span>
                        </div>
                        <h2 className="mt-4 font-headline-sm text-headline-sm font-bold text-text-primary">
                            Study workspace
                        </h2>
                        <p className="mt-2 text-body-sm text-text-secondary">
                            Upload materials, open generated topics, and practice quizzes.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <Link to="/dashboard/upload" className="btn-primary inline-flex text-body-sm">
                                Upload
                            </Link>
                            <Link to="/dashboard/library" className="btn-secondary inline-flex text-body-sm">
                                Library
                            </Link>
                            <Link to="/dashboard/quiz" className="btn-secondary inline-flex text-body-sm">
                                Quizzes
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default StudentDashboard;
