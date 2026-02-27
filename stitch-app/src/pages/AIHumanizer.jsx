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
        <div className="min-h-[100svh] md:min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 p-4 pb-24 md:p-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl md:text-3xl font-display font-extrabold text-neutral-900 dark:text-white">
                        AI Humanizer
                    </h1>
                    <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                        Make AI-generated text appear naturally human-written
                    </p>
                </div>

                {error && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
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

                {/* Sign-in banner for guests */}
                {!isLoggedIn && (
                    <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-[20px]">lock</span>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                Sign in to humanize text
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                AI detection is free for everyone. Humanization requires an account.
                            </p>
                        </div>
                        <Link
                            to="/login"
                            className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors shrink-0"
                        >
                            Sign in
                        </Link>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-soft p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                                    Original Text
                                </h2>
                                <div className="flex items-center gap-3">
                                    {inputText.length > 40000 && (
                                        <span className="text-xs text-amber-600 dark:text-amber-400">
                                            Long text — may take longer
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleClear}
                                        className="text-xs font-medium text-neutral-500 hover:text-primary transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Paste your AI-generated text here..."
                                className="w-full h-64 md:h-80 px-3 py-2 text-sm text-neutral-900 dark:text-white bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                            />

                            {/* Writing Style Selector */}
                            <div className="mt-3">
                                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wider">
                                    Writing Style
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {WRITING_STYLES.map((style) => (
                                        <button
                                            key={style}
                                            type="button"
                                            onClick={() => setSelectedStyle(style)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                                selectedStyle === style
                                                    ? 'bg-primary text-white border-primary'
                                                    : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700 hover:border-primary/50'
                                            }`}
                                        >
                                            {style}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Strength Selector */}
                            <div className="mt-3">
                                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wider">
                                    Strength
                                </p>
                                <div className="flex rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                                    {STRENGTH_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => setStrength(opt.key)}
                                            className={`flex-1 px-3 py-2 text-center transition-colors ${
                                                strength === opt.key
                                                    ? 'bg-primary text-white'
                                                    : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-750'
                                            }`}
                                        >
                                            <span className="block text-xs font-bold">{opt.label}</span>
                                            <span className={`block text-[10px] mt-0.5 ${strength === opt.key ? 'text-white/80' : 'text-neutral-400'}`}>
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
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        {isHumanizing ? 'hourglass_empty' : 'auto_fix_high'}
                                    </span>
                                    {isHumanizing ? 'Working...' : 'Humanize'}
                                </button>

                                {/* Quota indicator for free users */}
                                {isLoggedIn && !isPremium && quotaRemaining !== null && !isHumanizing && (
                                    <span className={`text-xs font-medium ${quotaRemaining > 0 ? 'text-neutral-400' : 'text-red-500'}`}>
                                        {quotaRemaining > 0
                                            ? `${quotaRemaining} free today`
                                            : 'Limit reached'}
                                    </span>
                                )}
                            </div>

                            {/* Step indicator during humanization */}
                            {isHumanizing && verificationStep && (
                                <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                                    <span className="inline-block w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                    <span className="font-medium">
                                        {chunkProgressLabel || VERIFICATION_STEPS.find((s) => s.key === verificationStep)?.label || 'Processing...'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {detectionResult && (
                            <div className={`rounded-2xl border p-4 ${getConfidenceBg(detectionResult.confidence)}`}>
                                <div className="flex items-start gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${detectionResult.confidence >= 70 ? 'bg-red-100 text-red-600' : detectionResult.confidence >= 40 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        <span className="material-symbols-outlined text-[20px]">
                                            {detectionResult.confidence >= 70 ? 'warning' : detectionResult.confidence >= 40 ? 'help' : 'check_circle'}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-lg font-bold ${getConfidenceColor(detectionResult.confidence)}`}>
                                                {detectionResult.confidence}%
                                            </span>
                                            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                                                AI Probability
                                            </span>
                                        </div>
                                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                                            {detectionResult.isAI
                                                ? 'This text appears to be AI-generated'
                                                : 'This text appears to be human-written'}
                                        </p>
                                        {detectionResult.flags?.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {detectionResult.flags.slice(0, 5).map((flag, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="text-xs px-2 py-1 rounded-full bg-white/70 dark:bg-neutral-800/70 text-neutral-600 dark:text-neutral-400"
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

                    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-soft p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                                Humanized Output
                            </h2>
                            {outputText && (
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
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
                            className="w-full h-64 md:h-80 px-3 py-2 text-sm text-neutral-900 dark:text-white bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl resize-none focus:outline-none"
                        />

                        {/* Before/After Score Card */}
                        {verificationResult && (
                            <div className="mt-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-3">
                                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                                    AI Detection Score
                                </p>
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col items-center">
                                        <span className={`text-lg font-bold ${getConfidenceColor(verificationResult.before)}`}>
                                            {verificationResult.before}%
                                        </span>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-400">Before</span>
                                    </div>
                                    <span className="material-symbols-outlined text-neutral-400 text-[20px]">arrow_forward</span>
                                    <div className="flex flex-col items-center">
                                        <span className={`text-lg font-bold ${getConfidenceColor(verificationResult.after)}`}>
                                            {verificationResult.after}%
                                        </span>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-400">After</span>
                                    </div>
                                    {verificationResult.attempts > 1 && (
                                        <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">
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
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                                    Replace Original
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6 p-4 rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/20">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">info</span>
                        <div>
                            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                Tips for best results
                            </p>
                            <ul className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
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
        </div>
    );
};

export default AIHumanizer;
