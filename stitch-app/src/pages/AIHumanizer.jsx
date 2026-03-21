import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAction, useQuery, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const WRITING_STYLES = [
    'Academic Essay',
    'Lab Report',
    'Casual/Blog',
    'Formal Letter',
];

const STRENGTH_OPTIONS = [
    { key: 'light', label: 'Light', description: 'Subtle tweaks, preserves structure' },
    { key: 'medium', label: 'Medium', description: 'Balanced rewrite' },
    { key: 'heavy', label: 'Heavy', description: 'Full transformation' },
];

const VERIFICATION_STEPS = [
    { key: 'analyzing_input', label: 'Analyzing original text' },
    { key: 'humanizing', label: 'Rewriting in your style' },
    { key: 'verifying', label: 'Verifying result' },
    { key: 'done', label: 'Done' },
];

const HUMANIZE_CHUNK_ESTIMATE_CHARS = 4000;

export const AIHumanizer = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
    const isLoggedIn = Boolean(user);
    const userId = user?.id;

    const detectAIText = useAction(api.ai.detectAIText);
    const humanizeWithVerification = useAction(api.ai.humanizeWithVerification);

    const humanizerQuota = useQuery(
        api.subscriptions.getHumanizerQuotaStatus,
        userId && isConvexAuthenticated ? {} : 'skip'
    );

    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [isDetecting, setIsDetecting] = useState(false);
    const [isHumanizing, setIsHumanizing] = useState(false);
    const [detectionResult, setDetectionResult] = useState(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const copiedTimerRef = useRef(null);

    const [selectedStyle, setSelectedStyle] = useState('Casual/Blog');
    const [strength, setStrength] = useState('medium');
    const [verificationResult, setVerificationResult] = useState(null);
    const [verificationStep, setVerificationStep] = useState(null);
    const [chunkProgressLabel, setChunkProgressLabel] = useState('');

    useEffect(() => {
        if (location.state?.text) {
            setInputText(location.state.text);
            navigate(location.pathname, { replace: true });
        }
    }, [location.state, navigate, location.pathname]);

    useEffect(() => {
        return () => {
            if (copiedTimerRef.current) {
                clearTimeout(copiedTimerRef.current);
                copiedTimerRef.current = null;
            }
        };
    }, []);

    const resolveConvexError = (err, fallbackMessage) => {
        const dataMessage = typeof err?.data === 'string'
            ? err.data
            : typeof err?.data?.message === 'string'
                ? err.data.message
                : '';
        const resolved = dataMessage || err?.message || fallbackMessage;
        return String(resolved)
            .replace(/^Uncaught (ConvexError|Error):\s*/i, '')
            .trim();
    };

    const isQuotaExceeded = (err) => {
        const code = err?.data?.code || '';
        return code === 'HUMANIZER_QUOTA_EXCEEDED';
    };

    const quotaRemaining = humanizerQuota?.remaining ?? null;
    const isPremium = humanizerQuota?.isPremium ?? false;
    const canHumanize = isLoggedIn && (isPremium || quotaRemaining === null || quotaRemaining > 0);

    const handleDetect = async () => {
        const trimmedText = inputText.trim();
        if (!trimmedText) {
            setError('Please enter some text to analyze.');
            return;
        }
        if (trimmedText.length < 50) {
            setError('Text must be at least 50 characters for accurate detection.');
            return;
        }

        setIsDetecting(true);
        setError('');
        setDetectionResult(null);

        try {
            const result = await detectAIText({ text: trimmedText });
            setDetectionResult(result);
        } catch (err) {
            setError(resolveConvexError(err, 'Failed to analyze text. Please try again.'));
        } finally {
            setIsDetecting(false);
        }
    };

    const handleHumanize = async () => {
        const trimmedText = inputText.trim();
        if (!trimmedText) {
            setError('Please enter some text to humanize.');
            return;
        }
        if (trimmedText.length < 10) {
            setError('Text must be at least 10 characters to humanize.');
            return;
        }
        if (trimmedText.length > 50000) {
            setError('Text is too long. Maximum 50,000 characters.');
            return;
        }
        if (!isLoggedIn) {
            setError('Please sign in to humanize text. AI detection is free for everyone.');
            return;
        }

        setIsHumanizing(true);
        setError('');
        setDetectionResult(null);
        setVerificationResult(null);
        setChunkProgressLabel('');

        // Estimate chunks for progress display
        const estimatedChunks = Math.max(1, Math.ceil(trimmedText.length / HUMANIZE_CHUNK_ESTIMATE_CHARS));
        let chunkTimer = null;

        try {
            setVerificationStep('analyzing_input');
            await new Promise((r) => setTimeout(r, 400));

            setVerificationStep('humanizing');

            // For long texts, cycle through chunk progress labels
            if (estimatedChunks > 1) {
                let currentChunk = 1;
                setChunkProgressLabel(`Rewriting section 1 of ${estimatedChunks}...`);
                chunkTimer = setInterval(() => {
                    currentChunk = Math.min(currentChunk + 1, estimatedChunks);
                    setChunkProgressLabel(`Rewriting section ${currentChunk} of ${estimatedChunks}...`);
                }, 4000);
            }

            const stepAdvanceTimer = setTimeout(() => setVerificationStep('verifying'), estimatedChunks > 1 ? estimatedChunks * 4000 : 8000);

            const result = await humanizeWithVerification({
                text: trimmedText,
                style: selectedStyle,
                strength,
            });

            clearTimeout(stepAdvanceTimer);
            if (chunkTimer) clearInterval(chunkTimer);
            setChunkProgressLabel('');
            setVerificationStep('done');
            setOutputText(result.humanizedText);
            setVerificationResult({
                before: result.passes.before,
                after: result.passes.after,
                attempts: result.attempts,
            });
        } catch (err) {
            if (chunkTimer) clearInterval(chunkTimer);
            setChunkProgressLabel('');
            if (isQuotaExceeded(err)) {
                setError("You've used your free humanization today. Upgrade to premium for unlimited access.");
            } else {
                setError(resolveConvexError(err, 'Failed to humanize text. Please try again.'));
            }
        } finally {
            setIsHumanizing(false);
            setTimeout(() => setVerificationStep(null), 2000);
        }
    };

    const handleCopy = async () => {
        if (!outputText) return;
        try {
            await navigator.clipboard.writeText(outputText);
            setCopied(true);
            if (copiedTimerRef.current) {
                clearTimeout(copiedTimerRef.current);
            }
            copiedTimerRef.current = setTimeout(() => {
                setCopied(false);
                copiedTimerRef.current = null;
            }, 2000);
        } catch {
            setError('Failed to copy to clipboard.');
        }
    };

    const handleReplace = () => {
        if (!outputText) return;
        setInputText(outputText);
        setOutputText('');
        setVerificationResult(null);
    };

    const handleClear = () => {
        setInputText('');
        setOutputText('');
        setDetectionResult(null);
        setVerificationResult(null);
        setError('');
    };

    const getConfidenceColor = (confidence) => {
        if (confidence >= 70) return 'text-red-600';
        if (confidence >= 40) return 'text-amber-600';
        return 'text-emerald-600';
    };

    const getConfidenceBg = (confidence) => {
        if (confidence >= 70) return 'bg-red-50 border-red-200';
        if (confidence >= 40) return 'bg-amber-50 border-amber-200';
        return 'bg-emerald-50 border-emerald-200';
    };

    return (
        <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-8 pb-24 md:pb-12">
            <div className="mb-6">
                <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark">
                    AI Humanizer
                </h1>
                <p className="mt-1 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                    Make AI-generated text appear naturally human-written
                </p>
            </div>

            {error && (
                <div className="mb-5 p-3 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-body-sm font-medium text-red-700 dark:text-red-300">
                    {error}
                    {error.includes('Upgrade to premium') && (
                        <Link
                            to="/subscription"
                            className="ml-2 underline font-bold hover:text-red-800 dark:hover:text-red-200"
                        >
                            Upgrade now
                        </Link>
                    )}
                </div>
            )}

            {!isLoggedIn && (
                <div className="mb-5 p-3 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px]">lock</span>
                    <div className="flex-1">
                        <p className="text-body-sm font-medium text-text-main-light dark:text-text-main-dark">
                            Sign in to humanize text
                        </p>
                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                            AI detection is free for everyone. Humanization requires an account.
                        </p>
                    </div>
                    <Link
                        to="/login"
                        className="btn-primary px-4 py-2 text-body-sm shrink-0"
                    >
                        Sign in
                    </Link>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                    <div className="card-base p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-overline text-text-faint-light dark:text-text-faint-dark">
                                Original Text
                            </h2>
                            <div className="flex items-center gap-3">
                                {inputText.length > 40000 && (
                                    <span className="text-caption text-accent-amber">
                                        Long text — may take longer
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="text-caption font-medium text-text-faint-light dark:text-text-faint-dark hover:text-primary transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Paste your AI-generated text here..."
                            className="input-field h-64 md:h-80 text-body-sm resize-none"
                        />

                        <div className="mt-3">
                            <p className="text-overline text-text-faint-light dark:text-text-faint-dark mb-2">
                                Writing Style
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {WRITING_STYLES.map((style) => (
                                    <button
                                        key={style}
                                        type="button"
                                        onClick={() => setSelectedStyle(style)}
                                        className={`px-3 py-1.5 rounded-full text-caption font-semibold border transition-colors ${
                                            selectedStyle === style
                                                ? 'bg-primary text-white border-primary'
                                                : 'bg-surface-light dark:bg-surface-dark text-text-sub-light dark:text-text-sub-dark border-border-light dark:border-border-dark hover:border-primary/50'
                                        }`}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-3">
                            <p className="text-overline text-text-faint-light dark:text-text-faint-dark mb-2">
                                Strength
                            </p>
                            <div className="flex rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
                                {STRENGTH_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => setStrength(opt.key)}
                                        className={`flex-1 px-3 py-2 text-center transition-colors ${
                                            strength === opt.key
                                                ? 'bg-primary text-white'
                                                : 'bg-surface-light dark:bg-surface-dark text-text-sub-light dark:text-text-sub-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark'
                                        }`}
                                    >
                                        <span className="block text-caption font-bold">{opt.label}</span>
                                        <span className={`block text-[10px] mt-0.5 ${strength === opt.key ? 'text-white/80' : 'text-text-faint-light dark:text-text-faint-dark'}`}>
                                            {opt.description}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={handleDetect}
                                disabled={isDetecting}
                                className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-body-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">
                                    {isDetecting ? 'hourglass_empty' : 'psychology'}
                                </span>
                                {isDetecting ? 'Analyzing...' : 'Detect AI'}
                            </button>
                            <button
                                type="button"
                                onClick={handleHumanize}
                                disabled={isHumanizing || !canHumanize}
                                className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-body-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">
                                    {isHumanizing ? 'hourglass_empty' : 'auto_fix_high'}
                                </span>
                                {isHumanizing ? 'Working...' : 'Humanize'}
                            </button>

                            {isLoggedIn && !isPremium && quotaRemaining !== null && !isHumanizing && (
                                <span className={`text-caption font-medium ${quotaRemaining > 0 ? 'text-text-faint-light dark:text-text-faint-dark' : 'text-red-500'}`}>
                                    {quotaRemaining > 0
                                        ? `${quotaRemaining} free today`
                                        : 'Limit reached'}
                                </span>
                            )}
                        </div>

                        {isHumanizing && verificationStep && (
                            <div className="mt-3 flex items-center gap-2 text-caption text-text-faint-light dark:text-text-faint-dark">
                                <span className="inline-block w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                <span className="font-medium">
                                    {chunkProgressLabel || VERIFICATION_STEPS.find((s) => s.key === verificationStep)?.label || 'Processing...'}
                                </span>
                            </div>
                        )}
                    </div>

                    {detectionResult && (
                        <div className={`rounded-xl border p-4 ${getConfidenceBg(detectionResult.confidence)} dark:bg-surface-dark dark:border-border-dark`}>
                            <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${detectionResult.confidence >= 70 ? 'bg-red-100 dark:bg-red-900/20 text-red-600' : detectionResult.confidence >= 40 ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600' : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600'}`}>
                                    <span className="material-symbols-outlined text-[20px]">
                                        {detectionResult.confidence >= 70 ? 'warning' : detectionResult.confidence >= 40 ? 'help' : 'check_circle'}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-body-lg font-bold ${getConfidenceColor(detectionResult.confidence)}`}>
                                            {detectionResult.confidence}%
                                        </span>
                                        <span className="text-body-sm font-medium text-text-sub-light dark:text-text-sub-dark">
                                            AI Probability
                                        </span>
                                    </div>
                                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-1">
                                        {detectionResult.isAI
                                            ? 'This text appears to be AI-generated'
                                            : 'This text appears to be human-written'}
                                    </p>
                                    {detectionResult.flags?.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {detectionResult.flags.slice(0, 5).map((flag, idx) => (
                                                <span
                                                    key={idx}
                                                    className="text-caption px-2 py-1 rounded-full bg-surface-hover-light dark:bg-surface-hover-dark text-text-faint-light dark:text-text-faint-dark"
                                                >
                                                    {flag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="card-base p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-overline text-text-faint-light dark:text-text-faint-dark">
                            Humanized Output
                        </h2>
                        {outputText && (
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="inline-flex items-center gap-1 text-caption font-medium text-primary hover:text-primary/80 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    {copied ? 'check' : 'content_copy'}
                                </span>
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        )}
                    </div>
                    <textarea
                        value={outputText}
                        readOnly
                        placeholder="Humanized text will appear here..."
                        className="input-field h-64 md:h-80 text-body-sm resize-none"
                    />

                    {verificationResult && (
                        <div className="mt-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-hover-light dark:bg-surface-hover-dark p-3">
                            <p className="text-overline text-text-faint-light dark:text-text-faint-dark mb-2">
                                AI Detection Score
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-center">
                                    <span className={`text-body-lg font-bold ${getConfidenceColor(verificationResult.before)}`}>
                                        {verificationResult.before}%
                                    </span>
                                    <span className="text-caption text-text-faint-light dark:text-text-faint-dark">Before</span>
                                </div>
                                <span className="material-symbols-outlined text-text-faint-light dark:text-text-faint-dark text-[20px]">arrow_forward</span>
                                <div className="flex flex-col items-center">
                                    <span className={`text-body-lg font-bold ${getConfidenceColor(verificationResult.after)}`}>
                                        {verificationResult.after}%
                                    </span>
                                    <span className="text-caption text-text-faint-light dark:text-text-faint-dark">After</span>
                                </div>
                                {verificationResult.attempts > 1 && (
                                    <span className="ml-auto text-caption text-text-faint-light dark:text-text-faint-dark">
                                        {verificationResult.attempts} rewrite{verificationResult.attempts > 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {outputText && (
                        <div className="mt-3">
                            <button
                                type="button"
                                onClick={handleReplace}
                                className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-body-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                                Replace Original
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
                <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">info</span>
                    <div>
                        <p className="text-body-sm font-medium text-text-main-light dark:text-text-main-dark">
                            Tips for best results
                        </p>
                        <ul className="mt-1 text-caption text-text-sub-light dark:text-text-sub-dark space-y-1">
                            <li>Paste 100+ words for more accurate detection</li>
                            <li>Choose a writing style that matches your assignment type</li>
                            <li>Use Light strength for polish, Heavy for a complete rewrite</li>
                            <li>Long texts are automatically split into sections and reassembled</li>
                            <li>Review the output — you may want to make small edits</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIHumanizer;
