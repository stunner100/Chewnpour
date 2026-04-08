const schools = [
    'University of Ghana',
    'KNUST',
    'University of Cape Coast',
    'Ashesi University',
    'University of Education, Winneba',
    'Ghana Institute of Management',
    'University for Development Studies',
    'Central University',
    'Valley View University',
    'Methodist University',
    'Regent University',
    'University of Professional Studies',
];

export function SchoolsMarquee() {
    // Duplicate list so the loop is seamless
    const items = [...schools, ...schools];

    return (
        <div className="border-y border-border bg-background py-5 overflow-hidden">
            <div className="flex items-center gap-0">
                {/* Fixed left label */}
                <div className="shrink-0 pl-6 pr-8 z-10 bg-background border-r border-border">
                    <p className="text-sm font-medium leading-snug text-foreground max-w-[160px]">
                        ChewnPour helped<br />
                        <span className="text-primary font-semibold">students in</span>
                    </p>
                </div>

                {/* Scrolling track */}
                <div className="relative flex-1 overflow-hidden">
                    {/* Left fade */}
                    <div className="pointer-events-none absolute left-0 top-0 h-full w-16 z-10 bg-gradient-to-r from-background to-transparent" />
                    {/* Right fade */}
                    <div className="pointer-events-none absolute right-0 top-0 h-full w-16 z-10 bg-gradient-to-l from-background to-transparent" />

                    <div className="flex animate-marquee gap-12 whitespace-nowrap w-max">
                        {items.map((school, i) => (
                            <span
                                key={i}
                                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-default"
                            >
                                {school}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
