import React from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../AppIcon';

const EMPTY_ARRAY = [];

const MobileLessonActions = ({ items = EMPTY_ARRAY }) => {
    if (items.length === 0) return null;
    return (
        <nav
            className="lg:hidden fixed inset-x-0 bottom-0 z-40 safe-area-bottom border-t border-border-subtle bg-surface/95 backdrop-blur-xl"
            aria-label="Lesson actions"
            data-cp-bottom-chrome="lesson"
        >
            <div className="mx-auto grid h-14 max-w-md grid-cols-5">
                {items.slice(0, 5).map((item) => {
                    const Tag = item.href ? Link : 'button';
                    const tagProps = item.href ? { to: item.href, reloadDocument: item.reloadDocument } : { type: 'button', onClick: item.onClick };
                    return (
                        <Tag
                            key={item.id}
                            {...tagProps}
                            disabled={item.disabled}
                            className={`flex min-h-11 flex-col items-center justify-center gap-0.5 transition-colors disabled:opacity-50 ${
                                item.primary
                                    ? 'text-primary'
                                    : 'text-text-secondary hover:text-primary'
                            }`}
                        >
                            <AppIcon name={item.icon} className="text-[22px]" />
                            <span className="text-caption font-semibold leading-none tracking-tight">{item.label}</span>
                        </Tag>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileLessonActions;
