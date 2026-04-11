const schools = [
    'University of Ghana',
    'KNUST',
    'University of Cape Coast',
    'Ashesi University',
    'University of Professional Studies',
    'Valley View University',
    'Methodist University',
    'Central University',
];

export function SchoolsMarquee() {
    const items = [...schools, ...schools];

    return (
        <section className="border-y border-border bg-background py-12 md:py-16 overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <p className="text-center text-sm font-semibold uppercase tracking-widest text-foreground/70">
                    Trusted by students at Ghana's top universities
                </p>
            </div>

            <div className="relative mt-8 overflow-hidden">
                <div className="pointer-events-none absolute left-0 top-0 h-full w-24 z-10 bg-gradient-to-r from-background to-transparent" />
                <div className="pointer-events-none absolute right-0 top-0 h-full w-24 z-10 bg-gradient-to-l from-background to-transparent" />

                <div className="flex animate-marquee gap-16 whitespace-nowrap w-max">
                    {items.map((school, i) => (
                        <span
                            key={i}
                            className="text-base font-semibold text-foreground/70 hover:text-foreground transition-colors duration-200 cursor-default"
                        >
                            {school}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}
