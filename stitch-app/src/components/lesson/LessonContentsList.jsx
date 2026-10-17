import React from 'react';
import { SECTION_ROLE_LABELS } from '../../lib/lessonView';

// The lesson's sections in order, each with its role label ("Example",
// "Common mistake"...) above the title; the current section is marked.
export default function LessonContentsList({ steps, currentIndex, onSelect }) {
    return (
        <ol className="space-y-1">
            {(Array.isArray(steps) ? steps : []).map((step, index) => {
                const roleLabel = step?.type === 'section' ? SECTION_ROLE_LABELS[step.role]?.label : '';
                const current = index === currentIndex;
                return (
                    <li key={`${step?.title || 'section'}-${index}`}>
                        <button
                            type="button"
                            aria-current={current ? 'step' : undefined}
                            onClick={() => onSelect?.(index)}
                            className={`flex min-h-11 w-full items-start gap-3 rounded-xl px-3 py-2 text-left text-body-sm ${
                                current
                                    ? 'bg-primary-subtle font-semibold text-primary'
                                    : 'text-text-primary hover:bg-surface-soft'
                            }`}
                        >
                            <span className="w-6 shrink-0 pt-0.5 text-caption text-text-muted">{index + 1}</span>
                            <span className="min-w-0">
                                {roleLabel ? (
                                    <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                                        {roleLabel}
                                    </span>
                                ) : null}
                                <span className="line-clamp-2">{step?.title || `Section ${index + 1}`}</span>
                            </span>
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}
