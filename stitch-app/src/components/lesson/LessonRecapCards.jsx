import React, { useState } from 'react';
import AppIcon from '../AppIcon';

// Recall practice: each card shows a question; the answer stays hidden until
// the student taps "Show answer".
export default function LessonRecapCards({ items = [] }) {
    const [revealed, setRevealed] = useState(() => new Set());
    const toggle = (index) => {
        setRevealed((previous) => {
            const next = new Set(previous);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    return (
        <div className="space-y-4">
            <p className="text-body-sm text-text-secondary">
                Answer each question from memory, then check yourself.
            </p>
            <ol className="lesson-recap-list">
                {items.map((item, index) => {
                    const isOpen = revealed.has(index);
                    const answerId = `recap-answer-${index}`;
                    return (
                        <li key={`${index}-${item.prompt}`} className="lesson-recap-card">
                            <p className="lesson-recap-prompt">{item.prompt}</p>
                            <button
                                type="button"
                                className="lesson-recap-toggle"
                                aria-expanded={isOpen}
                                aria-controls={answerId}
                                onClick={() => toggle(index)}
                            >
                                <AppIcon name={isOpen ? 'visibility_off' : 'visibility'} className="text-[16px]" aria-hidden="true" />
                                {isOpen ? 'Hide answer' : 'Show answer'}
                            </button>
                            <p id={answerId} className="lesson-recap-answer" hidden={!isOpen}>
                                {item.answer}
                            </p>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
