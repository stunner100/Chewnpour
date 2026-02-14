import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

const AIHumanizer = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const detectAIText = useAction(api.ai.detectAIText);
    const humanizeText = useAction(api.ai.humanizeText);

    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [isDetecting, setIsDetecting] = useState(false);
    const [isHumanizing, setIsHumanizing] = useState(false);
    const [detectionResult, setDetectionResult] = useState(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (location.state?.text) {
            setInputText(location.state.text);
            navigate(location.pathname, { replace: true });
        }
    }, [location.state, navigate, location.pathname]);

    const handleDetect = async () => {
        if (!inputText.trim()) {
            setError('Please enter some text to analyze.');
            return;
        }

        setIsDetecting(true);
        setError('');
        setDetectionResult(null);

        try {
            const result = await detectAIText({ text: inputText });
            setDetectionResult(result);
        } catch (err) {
            setError(err.message || 'Failed to analyze text. Please try again.');
        } finally {
            setIsDetecting(false);
        }
    };

    const handleHumanize = async () => {
        if (!inputText.trim()) {
            setError('Please enter some text to humanize.');
            return;
        }

        setIsHumanizing(true);
        setError('');
        setDetectionResult(null);

        try {
            const result = await humanizeText({ text: inputText });
            setOutputText(result.humanizedText);
        } catch (err) {
            setError(err.message || 'Failed to humanize text. Please try again.');
        } finally {
            setIsHumanizing(false);
        }
    };

    const handleCopy = async () => {
        if (!outputText) return;
        try {
            await navigator.clipboard.writeText(outputText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('Failed to copy to clipboard.');
        }
    };

    const handleReplace = () => {
        if (!outputText) return;
        setInputText(outputText);
        setOutputText('');
    };

    const handleClear = () => {
        setInputText('');
        setOutputText('');
        setDetectionResult(null);
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl md:text-3xl font-display font-extrabold text-slate-900 dark:text-white">
                        AI Humanizer
                    </h1>
                    <p className="mt-1 text-slate-600 dark:text-slate-400">
                        Make AI-generated text appear naturally human-written
                    </p>
                </div>

                {error && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-soft p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Original Text
                                </h2>
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="text-xs font-medium text-slate-500 hover:text-primary transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Paste your AI-generated text here..."
                                className="w-full h-64 md:h-80 px-3 py-2 text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={handleDetect}
                                    disabled={isDetecting || !inputText.trim()}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        {isDetecting ? 'hourglass_empty' : 'psychology'}
                                    </span>
                                    {isDetecting ? 'Analyzing...' : 'Detect AI'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleHumanize}
                                    disabled={isHumanizing || !inputText.trim()}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        {isHumanizing ? 'hourglass_empty' : 'auto_fix_high'}
                                    </span>
                                    {isHumanizing ? 'Humanizing...' : 'Humanize'}
                                </button>
                            </div>
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
                                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                                AI Probability
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                            {detectionResult.isAI
                                                ? 'This text appears to be AI-generated'
                                                : 'This text appears to be human-written'}
                                        </p>
                                        {detectionResult.flags?.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {detectionResult.flags.slice(0, 5).map((flag, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="text-xs px-2 py-1 rounded-full bg-white/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400"
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

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-soft p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                            onChange={(e) => setOutputText(e.target.value)}
                            placeholder="Humanized text will appear here..."
                            className="w-full h-64 md:h-80 px-3 py-2 text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                        />
                        {outputText && (
                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={handleReplace}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                                    Replace Original
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[20px] mt-0.5">info</span>
                    <div>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                            Tips for best results
                        </p>
                        <ul className="mt-1 text-xs text-blue-700 dark:text-blue-400 space-y-1">
                            <li>• Paste 100+ words for more accurate detection</li>
                            <li>• Humanization works best on paragraphs of text</li>
                            <li>• Review the output - you may want to make small edits</li>
                        </ul>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIHumanizer;
