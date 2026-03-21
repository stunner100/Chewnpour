import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

const HOW_USING_OPTIONS = [
    { value: 'exam_prep', label: 'Preparing for exams and quizzes' },
    { value: 'topic_understanding', label: 'Understanding difficult topics' },
    { value: 'assignment_support', label: 'Working through assignments' },
    { value: 'quick_revision', label: 'Quick revision before class/tests' },
    { value: 'other', label: 'Something else' },
];

const WANTED_FEATURES_OPTIONS = [
    { value: 'better_explanations', label: 'Clearer explanations and summaries' },
    { value: 'better_exam_quality', label: 'Higher-quality exam questions' },
    { value: 'faster_processing', label: 'Faster upload and processing speed' },
    { value: 'stronger_study_plans', label: 'Better reminders and study planning' },
    { value: 'collaboration', label: 'Study groups or collaboration tools' },
    { value: 'other', label: 'Something else' },
];

const getTrimmedParam = (searchParams, key) => {
    const value = String(searchParams.get(key) || '').trim();
    return value || '';
};

const ProductResearch = () => {
    const [searchParams] = useSearchParams();
    const submitResponseByToken = useMutation(api.productResearch.submitResponseByToken);

    const [howUsingApp, setHowUsingApp] = useState('');
    const [wantedFeatures, setWantedFeatures] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const token = getTrimmedParam(searchParams, 'token');
    const campaign = getTrimmedParam(searchParams, 'campaign');
    const cohort = getTrimmedParam(searchParams, 'cohort');
    const tokenMissing = !token;

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (tokenMissing || submitting) return;

        setSubmitting(true);
        setErrorMessage('');

        try {
            await submitResponseByToken({
                token,
                campaign: campaign || undefined,
                cohort: cohort || undefined,
                howUsingApp,
                wantedFeatures,
                additionalNotes: notes.trim() || undefined,
                source: 'email_research_form',
            });
            setSubmitted(true);
        } catch (error) {
            const message = String(error?.message || error || '');
            if (message.includes('invalid or expired')) {
                setErrorMessage('This research link is no longer valid. Please use the latest email link.');
            } else {
                setErrorMessage('We could not save your response right now. Please try again shortly.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4 py-10">
                <div className="w-full max-w-2xl card-base p-6 sm:p-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-emerald/10 text-accent-emerald">
                        <span className="material-symbols-outlined text-[24px]">done</span>
                    </div>
                    <h1 className="mt-4 text-display-sm text-text-main-light dark:text-text-main-dark">Thanks for your feedback</h1>
                    <p className="mt-2 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        Your response was saved and will help shape the next product updates.
                    </p>
                    <div className="mt-6 flex justify-center">
                        <Link
                            to="/dashboard"
                            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-body-sm"
                        >
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                            Back to dashboard
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-2xl card-base p-6 sm:p-8">
                <div className="mb-6">
                    <p className="text-overline text-primary">Product Research</p>
                    <h1 className="mt-2 text-display-sm text-text-main-light dark:text-text-main-dark">Help us improve ChewnPour</h1>
                    <p className="mt-2 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        This takes less than a minute. Your answers help us prioritize the next features.
                    </p>
                </div>

                {tokenMissing && (
                    <div className="mb-5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-body-sm text-amber-800 dark:text-amber-300">
                        This research link is missing a token. Please open the full link from the email.
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <label className="block space-y-2">
                        <span className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">How are you mainly using the app?</span>
                        <select
                            value={howUsingApp}
                            onChange={(event) => setHowUsingApp(event.target.value)}
                            required
                            disabled={tokenMissing || submitting}
                            className="input-field text-body-sm"
                        >
                            <option value="" disabled>Select one option</option>
                            {HOW_USING_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block space-y-2">
                        <span className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">What would you most like us to improve next?</span>
                        <select
                            value={wantedFeatures}
                            onChange={(event) => setWantedFeatures(event.target.value)}
                            required
                            disabled={tokenMissing || submitting}
                            className="input-field text-body-sm"
                        >
                            <option value="" disabled>Select one option</option>
                            {WANTED_FEATURES_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block space-y-2">
                        <span className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Anything else we should know? (optional)</span>
                        <textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            rows={4}
                            maxLength={1200}
                            disabled={tokenMissing || submitting}
                            placeholder="Share examples, blockers, or feature ideas..."
                            className="input-field text-body-sm resize-y"
                        />
                    </label>

                    {errorMessage && (
                        <p className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-body-sm text-red-700 dark:text-red-300">
                            {errorMessage}
                        </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={tokenMissing || submitting || !howUsingApp || !wantedFeatures}
                            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-body-sm"
                        >
                            <span className="material-symbols-outlined text-[18px]">{submitting ? 'hourglass_top' : 'send'}</span>
                            {submitting ? 'Submitting...' : 'Submit feedback'}
                        </button>
                        <Link
                            to="/dashboard"
                            className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-body-sm"
                        >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                            Skip for now
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductResearch;
