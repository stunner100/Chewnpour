import React from 'react';
import { Link } from 'react-router-dom';

const MobileLessonActions = ({ items = [] }) => {
    if (items.length === 0) return null;
    return (
        <nav
            className="lg:hidden fixed inset-x-0 bottom-0 z-30 safe-area-bottom border-t border-border-subtle dark:border-border-subtle-dark bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-xl"
            aria-label="Lesson actions"
        >
            <div className="grid grid-cols-4 max-w-md mx-auto h-14">
                {items.slice(0, 4).map((item) => {
                    const Tag = item.href ? Link : 'button';
                    const tagProps = item.href ? { to: item.href, reloadDocument: item.reloadDocument } : { type: 'button', onClick: item.onClick };
                    return (
                        <Tag
                            key={item.id}
                            {...tagProps}
                            disabled={item.disabled}
                            className={`flex flex-col items-center justify-center gap-0.5 transition-colors disabled:opacity-50 ${
                                item.primary
                                    ? 'text-primary'
                                    : 'text-text-sub-light dark:text-text-sub-dark hover:text-primary'
                            }`}
                        >
                            <span
                                className="material-symbols-outlined text-[22px]"
                                style={item.primary ? { fontVariationSettings: "'FILL' 1, 'wght' 600" } : undefined}
                            >
                                {item.icon}
                            </span>
                            <span className="text-[10px] font-semibold tracking-tight leading-none">{item.label}</span>
                        </Tag>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileLessonActions;
