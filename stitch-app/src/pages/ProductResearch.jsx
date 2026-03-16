import React, { useMemo, useState } from 'react';
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

const isMissingFunctionError = (message) => (
    message.includes('Could not find public function')
    || message.includes('Could not find function')
);

const isValidationShapeError = (message) => (
    message.includes('ArgumentValidationError')
    || message.includes('Object contains extra field')
    || message.includes('Object has extra field')
    || message.includes('Missing required field')
    || message.includes('Value does not match validator')
);

const ProductResearch = () => {
    const [searchParams] = useSearchParams();
    const submitResponseByToken = useMutation(api.productResearch.submitResponseByToken);
    const submitProductResearchResponse = useMutation(api.productResearch.submitProductResearchResponse);

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

    const payloadCandidates = useMemo(() => {
        const trimmedNotes = notes.trim();
        const common = {
            token,
            campaign: campaign || undefined,
            cohort: cohort || undefined,
            howUsingApp,
            notes: trimmedNotes || undefined,
        };
        return [
            { ...common, wantedFeatures },
            { ...common, wantedFeature: wantedFeatures },
        ];
    }, [campaign, cohort, howUsingApp, notes, token, wantedFeatures]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (tokenMissing || submitting) return;

        setSubmitting(true);
        setErrorMessage('');

        const submitters = [submitResponseByToken, submitProductResearchResponse];
        let lastError = null;

        for (const submitter of submitters) {
            for (const payload of payloadCandidates) {
                try {
                    await submitter(payload);
                    setSubmitted(true);
                    setSubmitting(false);
                    return;
                } catch (error) {
                    lastError = error;
                    const message = String(error?.message || error || '');
                    if (isMissingFunctionError(message) || isValidationShapeError(message)) {
                        continue;
                    }
                    setErrorMessage('We could not save your response right now. Please try again shortly.');
                    setSubmitting(false);
                    return;
                }
            }
        }

        const lastMessage = String(lastError?.message || lastError || '');
        if (isMissingFunctionError(lastMessage)) {
            setErrorMessage('This feedback link is not fully configured yet. Please try again later.');
        } else {
            setErrorMessage('We could not save your response right now. Please try again shortly.');
        }
        setSubmitting(false);
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark px-4 py-10 sm:px-6">
                <div className="mx-auto w-full max-w-2xl card-base p-6 sm:p-8">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <span className="material-symbols-outlined">done</span>
                    </div>
                    <h1 className="mt-4 text-center text-2xl font-black text-slate-900 dark:text-white">Thanks for your feedback</h1>
                    <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300">
                        Your response was saved and will help shape the next product updates.
                    </p>
                    <div className="mt-6 flex justify-center">
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-hover transition-colors"
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
        <div className="min-h-screen bg-background-light dark:bg-background-dark px-4 py-10 sm:px-6">
            <div className="mx-auto w-full max-w-2xl card-base p-6 sm:p-8">
                <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Product Research</p>
                    <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Help us improve ChewnPour</h1>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        This takes less than a minute. Your answers help us prioritize the next features.
                    </p>
                </div>

                {tokenMissing ? (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                        This research link is missing a token. Please open the full link from the email.
                    </div>
                ) : null}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <label className="block space-y-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">How are you mainly using the app?</span>
                        <select
                            value={howUsingApp}
                            onChange={(event) => setHowUsingApp(event.target.value)}
                            required
                            disabled={tokenMissing || submitting}
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white disabled:opacity-60"
                        >
                            <option value="" disabled>Select one option</option>
                            {HOW_USING_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">What would you most like us to improve next?</span>
                        <select
                            value={wantedFeatures}
                            onChange={(event) => setWantedFeatures(event.target.value)}
                            required
                            disabled={tokenMissing || submitting}
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white disabled:opacity-60"
                        >
                            <option value="" disabled>Select one option</option>
                            {WANTED_FEATURES_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">Anything else we should know? (optional)</span>
                        <textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            rows={4}
                            maxLength={1200}
                            disabled={tokenMissing || submitting}
                            placeholder="Share examples, blockers, or feature ideas..."
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white disabled:opacity-60"
                        />
                    </label>

                    {errorMessage ? (
                        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
                            {errorMessage}
                        </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={tokenMissing || submitting || !howUsingApp || !wantedFeatures}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <span className="material-symbols-outlined text-[18px]">{submitting ? 'hourglass_top' : 'send'}</span>
                            {submitting ? 'Submitting...' : 'Submit feedback'}
                        </button>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-primary/40 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
