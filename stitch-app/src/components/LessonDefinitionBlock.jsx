import React from 'react';
import AppIcon from './AppIcon';

const DEFINITION_VARIANT = {
    className:
        'bg-info-soft dark:bg-sky-950/40 border-info/20 dark:border-sky-700/45 text-info dark:text-sky-300',
    icon: 'menu_book',
};

const LessonDefinitionBlock = ({
    blockKey,
    term,
    text,
    bold,
    animationClass = '',
    animationStyle,
    variant = 'card',
}) => {
    if (variant === 'alert') {
        return (
            <div
                key={blockKey}
                className={`my-4 md:my-6 p-4 md:p-5 rounded-2xl border flex gap-3 md:gap-4 ${DEFINITION_VARIANT.className} ${animationClass}`}
                style={animationStyle}
            >
                <AppIcon name={DEFINITION_VARIANT.icon} className="shrink-0 text-current opacity-70" />
                <div className="flex flex-col gap-1">
                    {term ? (
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{term}</span>
                    ) : null}
                    <div className="text-[15px] md:text-base font-medium leading-relaxed">{bold(text)}</div>
                </div>
            </div>
        );
    }

    return (
        <div
            key={blockKey}
            className={`my-4 md:my-6 rounded-2xl border border-border-subtle bg-primary-subtle/50 p-5 md:p-6 ${animationClass}`}
            style={animationStyle}
        >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                Definition
            </p>
            <h4 className="mt-1.5 font-display text-body-lg font-semibold text-text-primary">
                {term}
            </h4>
            <div className="mt-1.5 text-base md:text-body-lg text-text-secondary leading-relaxed">
                {bold(text)}
            </div>
        </div>
    );
};

export default LessonDefinitionBlock;
