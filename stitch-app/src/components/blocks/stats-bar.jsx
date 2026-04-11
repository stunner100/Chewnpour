const stats = [
    { value: '10,000+', label: 'Documents processed' },
    { value: '50,000+', label: 'Lessons generated' },
    { value: '200,000+', label: 'Quiz questions created' },
];

export function StatsBar() {
    return (
        <section className="border-y border-border/60 bg-background/60">
            <div className="mx-auto max-w-6xl px-6 py-12 md:py-16 lg:px-8">
                <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-3 md:gap-12">
                    {stats.map(({ value, label }) => (
                        <div key={label}>
                            <div className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                                {value}
                            </div>
                            <div className="mt-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
                                {label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
