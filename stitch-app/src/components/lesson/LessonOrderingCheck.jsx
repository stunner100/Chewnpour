import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../AppIcon';
import { moveAnnouncement, moveStep } from '../../lib/lessonCheckControls';

const shuffleSteps = (steps) => {
    const items = (Array.isArray(steps) ? steps : []).map((text, index) => ({
        id: `step-${index}`,
        text: String(text || '').trim(),
    })).filter((item) => item.text);
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    if (copy.length > 1 && copy.every((item, index) => item.text === items[index]?.text)) {
        [copy[0], copy[copy.length - 1]] = [copy[copy.length - 1], copy[0]];
    }
    return copy;
};

const sameOrder = (left, right) =>
    left.length === right.length && left.every((item, index) => item === right[index]);

const toItems = (steps) =>
    (Array.isArray(steps) ? steps : [])
        .map((text, index) => ({ id: `step-${index}`, text: String(text || '').trim() }))
        .filter((item) => item.text);

export default function LessonOrderingCheck({ check, onSubmit, result, submitting = false }) {
    const playable = useMemo(() => {
        if (Array.isArray(check?.options) && check.options.filter(Boolean).length >= 3) {
            return toItems(check.options);
        }
        return shuffleSteps(check?.stepsInOrder);
    }, [check]);
    const localCanonical = useMemo(
        () => (Array.isArray(check?.stepsInOrder) ? check.stepsInOrder.map((step) => String(step).trim()).filter(Boolean) : []),
        [check],
    );
    const [order, setOrder] = useState(playable);
    const [draggingId, setDraggingId] = useState(null);
    const [localSubmitted, setLocalSubmitted] = useState(false);
    const [announcement, setAnnouncement] = useState('');
    // After a button move, focus follows the moved step: { id, direction }.
    const pendingFocus = useRef(null);
    const moveButtons = useRef({});

    useEffect(() => {
        const focus = pendingFocus.current;
        if (!focus) return;
        pendingFocus.current = null;
        const buttons = moveButtons.current[focus.id] || {};
        // At the top or bottom the pressed button is disabled; use the other.
        const target = buttons[focus.direction]?.disabled
            ? buttons[focus.direction === 'up' ? 'down' : 'up']
            : buttons[focus.direction];
        target?.focus();
    }, [order]);

    const submitted = Boolean(result) || localSubmitted;
    const canonical = Array.isArray(result?.stepsInOrder) && result.stepsInOrder.length
        ? result.stepsInOrder
        : localCanonical;
    const current = order.map((item) => item.text);
    const isCorrect = submitted && (typeof result?.correct === 'boolean'
        ? result.correct
        : sameOrder(current, canonical));

    if (!check?.prompt || playable.length < 3) return null;

    const moveItem = (fromId, toId) => {
        if (!fromId || !toId || fromId === toId || submitted) return;
        setOrder((prev) => {
            const next = [...prev];
            const fromIndex = next.findIndex((item) => item.id === fromId);
            const toIndex = next.findIndex((item) => item.id === toId);
            if (fromIndex < 0 || toIndex < 0) return prev;
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return next;
        });
    };

    const moveByButton = (index, delta) => {
        if (submitted) return;
        const next = moveStep(order, index, delta);
        if (next === order) return;
        setOrder(next);
        setAnnouncement(moveAnnouncement(order[index].text, index + delta + 1, order.length));
        pendingFocus.current = { id: order[index].id, direction: delta < 0 ? 'up' : 'down' };
    };

    const handleCheck = async () => {
        if (typeof onSubmit === 'function') {
            await onSubmit(current);
            return;
        }
        setLocalSubmitted(true);
    };

    return (
        <section className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm md:p-5 ph-mask">
            <div className="mb-3 flex items-center gap-2">
                <AppIcon name="low_priority" className="text-[20px] text-primary" />
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Process check</p>
                    <h3 className="text-body-md font-semibold text-text-primary">{check.prompt}</h3>
                </div>
            </div>
            <p id={`${check.id || 'ordering'}-instructions`} className="mb-3 text-caption text-text-secondary">
                Put the steps in the order described in the lesson: drag them, or use the move buttons.
            </p>
            <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
            <ol className="space-y-2" aria-describedby={`${check.id || 'ordering'}-instructions`}>
                {order.map((item, index) => (
                    <li
                        key={item.id}
                        draggable={!submitted}
                        onDragStart={() => setDraggingId(item.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                            moveItem(draggingId, item.id);
                            setDraggingId(null);
                        }}
                        className={`flex cursor-grab items-start gap-3 rounded-xl border px-3 py-3 active:cursor-grabbing ${
                            draggingId === item.id
                                ? 'border-primary bg-primary-subtle'
                                : 'border-border-subtle bg-surface-soft'
                        } ${submitted ? 'cursor-default' : ''}`}
                    >
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-caption font-bold text-primary">
                            {index + 1}
                        </span>
                        <span className="flex-1 text-body-sm leading-6 text-text-primary">{item.text}</span>
                        {!submitted ? (
                            <span className="flex shrink-0 gap-1">
                                {[['up', -1, 'arrow_upward'], ['down', 1, 'arrow_downward']].map(([direction, delta, icon]) => (
                                    <button
                                        key={direction}
                                        type="button"
                                        ref={(node) => {
                                            moveButtons.current[item.id] = { ...moveButtons.current[item.id], [direction]: node };
                                        }}
                                        aria-label={`Move step ${index + 1}, ${item.text}, ${direction}`}
                                        disabled={delta < 0 ? index === 0 : index === order.length - 1}
                                        onClick={() => moveByButton(index, delta)}
                                        className="flex size-9 items-center justify-center rounded-lg border border-border-subtle text-text-secondary hover:border-primary/40 hover:text-primary disabled:opacity-30"
                                    >
                                        <AppIcon name={icon} className="text-[18px]" />
                                    </button>
                                ))}
                            </span>
                        ) : null}
                    </li>
                ))}
            </ol>
            <div className="mt-4 flex flex-wrap items-center gap-2">
                {!submitted ? (
                    <button
                        type="button"
                        className="btn-primary inline-flex min-h-10 items-center gap-1.5 text-body-sm disabled:opacity-50"
                        disabled={submitting}
                        onClick={handleCheck}
                    >
                        {submitting ? 'Checking…' : 'Check order'}
                    </button>
                ) : null}
            </div>
            <div role="status" aria-live="polite">
            {submitted ? (
                <div
                    className={`mt-4 rounded-xl border px-4 py-3 ${
                        isCorrect
                            ? 'border-success/30 bg-success-soft text-success'
                            : 'border-warning/30 bg-warning-soft text-text-primary'
                    }`}
                >
                    <p className="text-body-sm font-semibold">
                        {isCorrect ? 'That matches the process in the lesson.' : 'Not quite. The lesson order is:'}
                    </p>
                    {!isCorrect && canonical.length > 0 ? (
                        <ol className="mt-2 list-decimal space-y-1 pl-5 text-body-sm text-text-secondary">
                            {canonical.map((step) => (
                                <li key={step}>{step}</li>
                            ))}
                        </ol>
                    ) : null}
                    {(result?.explanation || check.explanation) ? (
                        <p className="mt-2 text-body-sm text-text-secondary">{result?.explanation || check.explanation}</p>
                    ) : null}
                    {(result?.hint || check.hint) && !isCorrect ? (
                        <p className="mt-2 text-caption text-text-muted">{result?.hint || check.hint}</p>
                    ) : null}
                </div>
            ) : null}
            </div>
        </section>
    );
}
