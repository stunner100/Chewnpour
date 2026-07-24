import React, { useReducer } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

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

const initialResearchState = {
    howUsingApp: '',
    wantedFeatures: '',
    notes: '',
    submitting: false,
    submitted: false,
    errorMessage: '',
};

const researchReducer = (state, action) => {
    switch (action.type) {
        case 'fieldChanged':
            return {
                ...state,
                [action.field]: action.value,
            };
        case 'submitStarted':
            return {
                ...state,
                submitting: true,
                errorMessage: '',
            };
        case 'submitSucceeded':
            return {
                ...state,
                submitting: false,
                submitted: true,
            };
        case 'submitFailed':
            return {
                ...state,
                submitting: false,
                errorMessage: action.message,
            };
        default:
            return state;
    }
};

/**
 * Product research is parked during the Supabase hard cutover.
 * Keep the public route live with a clear unavailable state (no Convex).
 */
const ProductResearch = () => {
    const [searchParams] = useSearchParams();
    const [{
        howUsingApp,
        wantedFeatures,
        notes,
        submitting,
        submitted,
        errorMessage,
    }, dispatchResearch] = useReducer(researchReducer, initialResearchState);

    const token = getTrimmedParam(searchParams, 'token');
    const tokenMissing = !token;

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (tokenMissing || submitting) return;
        dispatchResearch({ type: 'submitStarted' });
        dispatchResearch({
            type: 'submitFailed',
            message: 'Product research intake is temporarily unavailable while we finish the backend cutover. Please try again later.',
        });
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-6">
                <div className="max-w-lg w-full card-base p-8 text-center">
                    <h1 className="text-2xl font-semibold">Thanks for the feedback</h1>
                    <p className="mt-3 text-sm text-text-faint-light dark:text-text-faint-dark">
                        Your responses help us improve ChewnPour.
                    </p>
                    <Link to="/" className="btn-primary inline-flex mt-6 px-5 py-2.5 text-sm">
                        Back to home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-6 py-10">
            <div className="max-w-lg w-full card-base p-8">
                <p className="text-overline text-primary">Product Research</p>
                <h1 className="mt-2 text-2xl font-semibold">How are you mainly using the app?</h1>
                <p className="mt-2 text-sm text-text-faint-light dark:text-text-faint-dark">
                    What would you most like us to improve next?
                </p>

                {tokenMissing ? (
                    <p className="mt-6 text-sm text-amber-700 dark:text-amber-300">
                        This research link is missing a token.
                    </p>
                ) : (
                    <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                        <fieldset>
                            <legend className="text-sm font-semibold mb-2">How are you mainly using the app?</legend>
                            <div className="space-y-2">
                                {HOW_USING_OPTIONS.map((option) => (
                                    <label key={option.value} className="flex items-center gap-2 text-sm">
                                        <input
                                            type="radio"
                                            name="howUsingApp"
                                            value={option.value}
                                            checked={howUsingApp === option.value}
                                            onChange={(event) => dispatchResearch({
                                                type: 'fieldChanged',
                                                field: 'howUsingApp',
                                                value: event.target.value,
                                            })}
                                        />
                                        {option.label}
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <fieldset>
                            <legend className="text-sm font-semibold mb-2">What would you most like us to improve next?</legend>
                            <div className="space-y-2">
                                {WANTED_FEATURES_OPTIONS.map((option) => (
                                    <label key={option.value} className="flex items-center gap-2 text-sm">
                                        <input
                                            type="radio"
                                            name="wantedFeatures"
                                            value={option.value}
                                            checked={wantedFeatures === option.value}
                                            onChange={(event) => dispatchResearch({
                                                type: 'fieldChanged',
                                                field: 'wantedFeatures',
                                                value: event.target.value,
                                            })}
                                        />
                                        {option.label}
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <label className="block text-sm">
                            <span className="font-semibold">Additional notes</span>
                            <textarea
                                className="mt-2 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2"
                                rows={4}
                                value={notes}
                                onChange={(event) => dispatchResearch({
                                    type: 'fieldChanged',
                                    field: 'notes',
                                    value: event.target.value,
                                })}
                            />
                        </label>

                        {errorMessage ? (
                            <p className="text-sm text-amber-700 dark:text-amber-300">{errorMessage}</p>
                        ) : null}

                        <button
                            type="submit"
                            disabled={submitting || !howUsingApp || !wantedFeatures}
                            className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
                        >
                            {submitting ? 'Submitting…' : 'Submit feedback'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ProductResearch;
