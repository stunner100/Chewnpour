import React, { useMemo, useState } from 'react';
import AppIcon from '../AppIcon';

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

export default function LessonOrderingCheck({ check }) {
    const canonical = useMemo(
        () => (Array.isArray(check?.stepsInOrder) ? check.stepsInOrder.map((step) => String(step).trim()).filter(Boolean) : []),
        [check],
    );
    const [order, setOrder] = useState(() => shuffleSteps(canonical));
    const [draggingId, setDraggingId] = useState(null);
    const [submitted, setSubmitted] = useState(false);

    if (!check?.prompt || canonical.length !== 3) return null;

    const current = order.map((item) => item.text);
    const isCorrect = submitted && sameOrder(current, canonical);

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

    return (
        <section className="my-6 rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm md:p-5">
            <div className="mb-3 flex items-center gap-2">
                <AppIcon name="low_priority" className="text-[20px] text-primary" />
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Process check</p>
                    <h3 className="text-body-md font-semibold text-text-primary">{check.prompt}</h3>
                </div>
            </div>
            <p className="mb-3 text-caption text-text-secondary">Drag the steps into the order described in the lesson.</p>
            <ol className="space-y-2">
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
                        <span className="text-body-sm leading-6 text-text-primary">{item.text}</span>
                    </li>
                ))}
            </ol>
            <div className="mt-4 flex flex-wrap items-center gap-2">
                {!submitted ? (
                    <button
                        type="button"
                        className="btn-primary inline-flex min-h-10 items-center gap-1.5 text-body-sm"
                        onClick={() => setSubmitted(true)}
                    >
                        Check order
                    </button>
                ) : (
                    <button
                        type="button"
                        className="btn-secondary inline-flex min-h-10 items-center gap-1.5 text-body-sm"
                        onClick={() => {
                            setSubmitted(false);
                            setOrder(shuffleSteps(canonical));
                        }}
                    >
                        Try again
                    </button>
                )}
            </div>
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
                    {!isCorrect ? (
                        <ol className="mt-2 list-decimal space-y-1 pl-5 text-body-sm text-text-secondary">
                            {canonical.map((step) => (
                                <li key={step}>{step}</li>
                            ))}
                        </ol>
                    ) : null}
                    {check.explanation ? (
                        <p className="mt-2 text-body-sm text-text-secondary">{check.explanation}</p>
                    ) : null}
                    {check.hint && !isCorrect ? (
                        <p className="mt-2 text-caption text-text-muted">{check.hint}</p>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}
