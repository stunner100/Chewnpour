import React from 'react';

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
                <span className="material-symbols-outlined shrink-0 text-current opacity-70">{DEFINITION_VARIANT.icon}</span>
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
            className={`my-4 md:my-6 p-5 md:p-6 rounded-[2rem] bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow duration-300 ${animationClass}`}
            style={animationStyle}
        >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <span className="material-symbols-outlined text-6xl">{DEFINITION_VARIANT.icon}</span>
            </div>
            <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                {term}
            </h4>
            <div className="text-base md:text-lg text-neutral-800 dark:text-neutral-100 leading-relaxed">
                {bold(text)}
            </div>
        </div>
    );
};

export default LessonDefinitionBlock;
