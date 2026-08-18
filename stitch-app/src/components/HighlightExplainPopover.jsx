import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import AppIcon from './AppIcon';

const PRIMARY_ACTIONS = [
    { key: 'explain', label: 'Explain', icon: 'lightbulb', busy: 'Explaining' },
    { key: 'breakdown', label: 'Break down', icon: 'account_tree', busy: 'Breaking down' },
];

const SECONDARY_ACTIONS = [
    { key: 'simplify', label: 'Simplify', icon: 'child_care', busy: 'Simplifying' },
];

const ALL_ACTIONS = [...PRIMARY_ACTIONS, ...SECONDARY_ACTIONS];

const controlClass =
    'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-body-sm font-medium text-text-primary transition-[background-color,color,transform] duration-150 hover:bg-surface-soft active:scale-[0.96]';

const primaryClass =
    'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-primary px-3 text-body-sm font-medium text-white transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.96]';

const explainSelectionRequest = async ({ topicId, selectedText, style }) => {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/explain`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedText, style }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || `Explain failed (${response.status})`);
    }
    return payload;
};

const HighlightExplainPopover = memo(function HighlightExplainPopover({
    selection,
    topicId,
    onClose,
    onCopyToNotes,
}) {
    const [explainState, setExplainState] = useState({
        selectionText: '',
        loading: false,
        explanation: '',
        error: '',
        activeStyle: '',
    });
    const [expanded, setExpanded] = useState(false);
    const [placement, setPlacement] = useState({ top: 0, left: 0, above: false, ready: false });

    const selectionText = selection?.text || '';
    const hasCurrentSelectionState = explainState.selectionText === selectionText;
    const loading = hasCurrentSelectionState ? explainState.loading : false;
    const explanation = hasCurrentSelectionState ? explainState.explanation : '';
    const error = hasCurrentSelectionState ? explainState.error : '';
    const activeStyle = hasCurrentSelectionState ? explainState.activeStyle : '';

    const popoverRef = useRef(null);
    const barRef = useRef(null);
    const contentRef = useRef(null);
    const previousModeRef = useRef('idle');
    const lastWidthRef = useRef(0);
    const widthAnimationRef = useRef(null);

    const mode = loading ? 'thinking' : explanation || error ? 'result' : 'idle';
    const activeAction = ALL_ACTIONS.find((action) => action.key === activeStyle) || PRIMARY_ACTIONS[0];

    const handleExplain = useCallback(async (style) => {
        if (!topicId || !selection?.text) return;
        const selectedText = selection.text;
        setExpanded(false);
        setExplainState({
            selectionText: selectedText,
            loading: true,
            explanation: '',
            error: '',
            activeStyle: style,
        });
        try {
            const result = await explainSelectionRequest({
                topicId,
                selectedText: selectedText.slice(0, 1000),
                style,
            });
            setExplainState({
                selectionText: selectedText,
                loading: false,
                explanation: result?.explanation || 'No explanation generated.',
                error: '',
                activeStyle: style,
            });
        } catch {
            setExplainState({
                selectionText: selectedText,
                loading: false,
                explanation: '',
                error: 'Explanation is still getting ready. Please try again.',
                activeStyle: style,
            });
        }
    }, [topicId, selection]);

    const resetToIdle = useCallback(() => {
        setExpanded(false);
        setExplainState({
            selectionText,
            loading: false,
            explanation: '',
            error: '',
            activeStyle: '',
        });
    }, [selectionText]);

    useEffect(() => {
        if (!selection) return undefined;
        const handleClick = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                onClose();
            }
        };
        const handleEscape = (event) => {
            if (event.key === 'Escape') onClose();
        };
        const timer = window.setTimeout(() => {
            document.addEventListener('mousedown', handleClick);
            document.addEventListener('keydown', handleEscape);
        }, 100);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [selection, onClose]);

    const updatePlacement = useCallback(() => {
        if (!selection?.rect || !popoverRef.current) return;
        const { top, left, width, bottom } = selection.rect;
        const centerX = left + width / 2;
        const gap = 8;
        const popoverHeight = popoverRef.current.getBoundingClientRect().height || 44;
        const above = bottom + gap + popoverHeight > window.innerHeight - 16 && top - gap - popoverHeight > 16;
        const nextLeft = Math.max(16, Math.min(centerX, window.innerWidth - 16));
        const nextTop = above ? top - gap : bottom + gap;
        setPlacement((current) => {
            if (
                current.ready
                && current.above === above
                && Math.abs(current.top - nextTop) < 1
                && Math.abs(current.left - nextLeft) < 1
            ) {
                return current;
            }
            return { top: nextTop, left: nextLeft, above, ready: true };
        });
    }, [selection]);

    useLayoutEffect(() => {
        updatePlacement();
    }, [updatePlacement, mode, expanded, explanation, error]);

    useEffect(() => {
        if (!selection) return undefined;
        const onResize = () => updatePlacement();
        window.addEventListener('resize', onResize);
        window.addEventListener('scroll', onResize, true);
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', onResize, true);
        };
    }, [selection, updatePlacement]);

    useLayoutEffect(() => {
        const bar = barRef.current;
        const content = contentRef.current;
        if (!bar || !content || mode === 'result') return;

        const nextWidth = Math.ceil(content.getBoundingClientRect().width) + 8;
        const previousWidth = lastWidthRef.current || Math.ceil(bar.getBoundingClientRect().width);

        if (previousModeRef.current !== mode && Math.abs(nextWidth - previousWidth) > 1) {
            widthAnimationRef.current?.cancel();
            const animation = bar.animate(
                [{ width: `${previousWidth}px` }, { width: `${nextWidth}px` }],
                { duration: 320, easing: 'cubic-bezier(0.23,1,0.32,1)' },
            );
            widthAnimationRef.current = animation;
            animation.onfinish = () => {
                lastWidthRef.current = nextWidth;
                widthAnimationRef.current = null;
                bar.style.width = '';
            };
        } else {
            lastWidthRef.current = nextWidth;
        }

        previousModeRef.current = mode;
    }, [mode, expanded]);

    const style = useMemo(() => {
        if (!selection?.rect || !placement.ready) {
            return { position: 'fixed', opacity: 0, pointerEvents: 'none', zIndex: 50 };
        }
        return {
            position: 'fixed',
            top: `${placement.top}px`,
            left: `${placement.left}px`,
            transform: placement.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 50,
            maxWidth: `${Math.min(420, window.innerWidth - 32)}px`,
            opacity: 1,
            transition: 'opacity 180ms ease-out, transform 220ms cubic-bezier(0.23,1,0.32,1)',
        };
    }, [selection, placement]);

    if (!selection) return null;

    return (
        <div ref={popoverRef} style={style} className="w-max max-w-[calc(100vw-2rem)] ph-mask">
            <div className="flex flex-col items-center gap-2">
                <div
                    ref={barRef}
                    className={`flex h-9 w-fit max-w-[calc(100vw-2rem)] items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface p-1 shadow-elevated ${placement.ready ? 'animate-fade-in' : 'opacity-0'}`}
                >
                    <div ref={contentRef} className="flex w-fit shrink-0 items-center justify-center gap-0.5">
                        {loading ? (
                            <span className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap px-3 text-body-sm text-text-secondary">
                                <span className="size-3 shrink-0 animate-spin rounded-full border-[1.5px] border-border-subtle border-t-text-secondary" />
                                <span className="shimmer text-[12.5px] font-medium">
                                    {activeAction.busy}…
                                </span>
                            </span>
                        ) : null}

                        {mode === 'result' ? (
                            <>
                                {onCopyToNotes && explanation ? (
                                    <button
                                        type="button"
                                        onClick={() => onCopyToNotes(explanation)}
                                        className={primaryClass}
                                    >
                                        <AppIcon name="note_add" className="text-[14px]" />
                                        Keep in notes
                                    </button>
                                ) : null}
                                <button type="button" onClick={onClose} className={controlClass}>
                                    <AppIcon name="close" className="text-[14px]" />
                                    Dismiss
                                </button>
                                <span className="mx-0.5 h-4 w-px shrink-0 bg-border-subtle" />
                                <button
                                    type="button"
                                    aria-label="Try again"
                                    onClick={() => handleExplain(activeStyle || 'explain')}
                                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-muted transition-[background-color,color,transform] duration-150 hover:bg-surface-soft hover:text-text-secondary active:scale-[0.96]"
                                >
                                    <AppIcon name="refresh" className="text-[16px]" />
                                </button>
                            </>
                        ) : null}

                        {mode === 'idle' ? (
                            <>
                                <div
                                    className="flex min-w-0 items-center gap-0.5 overflow-hidden transition-[max-width,opacity] duration-300"
                                    style={{
                                        maxWidth: expanded ? 420 : 220,
                                        transitionTimingFunction: 'cubic-bezier(0.23,1,0.32,1)',
                                    }}
                                >
                                    {PRIMARY_ACTIONS.map((action) => (
                                        <button
                                            key={action.key}
                                            type="button"
                                            onClick={() => handleExplain(action.key)}
                                            className={controlClass}
                                        >
                                            <AppIcon name={action.icon} className="text-[14px]" />
                                            {action.label}
                                        </button>
                                    ))}

                                    <div
                                        className="flex min-w-0 items-center gap-0.5 overflow-hidden transition-[max-width,opacity,margin] duration-300"
                                        style={{
                                            maxWidth: expanded ? 160 : 0,
                                            opacity: expanded ? 1 : 0,
                                            marginLeft: expanded ? 2 : 0,
                                            transitionTimingFunction: 'cubic-bezier(0.23,1,0.32,1)',
                                        }}
                                    >
                                        {SECONDARY_ACTIONS.map((action) => (
                                            <button
                                                key={action.key}
                                                type="button"
                                                onClick={() => handleExplain(action.key)}
                                                className={controlClass}
                                            >
                                                <AppIcon name={action.icon} className="text-[14px]" />
                                                {action.label}
                                            </button>
                                        ))}
                                    </div>

                                    <span className="mx-0.5 h-4 w-px shrink-0 bg-border-subtle" />
                                    <button
                                        type="button"
                                        aria-label={expanded ? 'Show fewer actions' : 'Show more actions'}
                                        aria-expanded={expanded}
                                        onClick={() => setExpanded((value) => !value)}
                                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-secondary transition-[background-color,transform] duration-200 hover:bg-surface-soft active:scale-[0.96]"
                                    >
                                        <AppIcon
                                            name="chevron_right"
                                            className={`text-[16px] transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>

                {(explanation || error) && !loading ? (
                    <div className="w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-border-subtle bg-surface p-3 shadow-elevated">
                        {error ? (
                            <p className="text-caption text-amber-700 dark:text-amber-400">{error}</p>
                        ) : (
                            <div className="max-h-48 overflow-y-auto whitespace-pre-wrap text-body-sm leading-relaxed text-text-secondary">
                                {explanation}
                            </div>
                        )}
                        {error ? (
                            <div className="mt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleExplain(activeStyle || 'explain')}
                                    className="text-caption font-semibold text-primary hover:text-primary/80"
                                >
                                    Retry
                                </button>
                                <button
                                    type="button"
                                    onClick={resetToIdle}
                                    className="text-caption font-semibold text-text-muted hover:text-text-secondary"
                                >
                                    Back
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={resetToIdle}
                                className="mt-2 text-caption font-semibold text-text-muted hover:text-text-secondary"
                            >
                                Try another
                            </button>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
});

export default HighlightExplainPopover;
