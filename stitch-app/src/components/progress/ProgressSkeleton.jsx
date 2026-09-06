import React from 'react';

const Block = ({ className }) => (
    <div className={`rounded-[16px] bg-surface-soft ${className}`} />
);

/**
 * Loading state mirroring the progress page's four-section layout.
 */
const ProgressSkeleton = () => (
    <div className="min-h-[calc(100dvh-4rem)] animate-pulse bg-background-light px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-3xl space-y-8">
            <div className="space-y-3">
                <Block className="h-9 w-40" />
                <Block className="h-4 w-72 max-w-full" />
            </div>
            <div className="rounded-[24px] border border-border-subtle bg-surface p-6 shadow-sm md:p-9">
                <Block className="h-6 w-28 rounded-full" />
                <Block className="mt-4 h-8 w-2/3" />
                <Block className="mt-3 h-4 w-full max-w-md" />
                <Block className="mt-5 h-2 w-full max-w-md rounded-full" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-4 rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6"
                    >
                        <Block className="size-11 shrink-0 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Block className="h-3 w-20" />
                            <Block className="h-6 w-12" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
                <Block className="h-6 w-28" />
                <div className="mt-5 space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Block key={index} className="h-16 w-full rounded-[18px]" />
                    ))}
                </div>
            </div>
            <div className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
                <Block className="h-6 w-40" />
                <div className="mt-5 space-y-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Block key={index} className="h-12 w-full" />
                    ))}
                </div>
            </div>
        </div>
    </div>
);

export default ProgressSkeleton;
