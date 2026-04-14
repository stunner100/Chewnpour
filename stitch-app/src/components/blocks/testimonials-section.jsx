import React from 'react';

const testimonials = [
    {
        author: 'Prince A.',
        role: 'Engineering Student',
        image: '/chewnpour/img1.jpg',
        quote: "ChewnPour is the only AI tool that feels like a real study assistant. It prioritises what I need to revise and has saved my grades more than once.",
    },
    {
        author: 'Aisha M.',
        role: 'Medical Student',
        image: '/chewnpour/img2.jpg',
        quote: "I LOVE it. It reads every slide deck I upload, generates flashcards and quizzes automatically, and actually understands the medical jargon.",
    },
    {
        author: 'Emma Mensah',
        role: 'Business Administration',
        image: '/chewnpour/img3.jpg',
        quote: "I used to bounce between Notion, Google Docs, and Anki. Now I just upload to ChewnPour and get lessons and quizzes I actually remember.",
    },
    {
        author: 'Grace O.',
        role: 'Pre-med Student',
        image: '/chewnpour/img4.jpg',
        quote: "Having an AI tutor answer my 2AM questions before an exam is literally priceless. It keeps my writing authentic while fixing the structure.",
    },
    {
        author: 'David K.',
        role: 'Law Student',
        image: '/chewnpour/img1.jpg',
        quote: "Reading hundreds of case briefs gets exhausting. ChewnPour condenses them into digestible summaries — exactly what every rigorous student needs.",
    },
];

export function TestimonialsSection() {
    return (
        <section id="testimonials" className="relative border-t border-border/40 bg-background py-20 md:py-28">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-3xl text-center">
                    <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                        Loved by students across Ghana
                    </h2>
                    <p className="mt-4 text-base md:text-lg text-muted-foreground">
                        Real words from the learners using ChewnPour every week.
                    </p>
                </div>

                <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {testimonials.map((testimonial) => (
                        <TestimonialCard key={testimonial.author} testimonial={testimonial} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function TestimonialCard({ testimonial }) {
    return (
        <figure className="flex h-full flex-col rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
            <blockquote className="flex-1 text-base leading-relaxed text-foreground/80">
                &ldquo;{testimonial.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3 border-t border-border/50 pt-4">
                <img
                    src={testimonial.image}
                    alt={testimonial.author}
                    className="size-11 rounded-full object-cover ring-1 ring-border"
                    loading="lazy"
                />
                <div className="text-left">
                    <div className="text-sm font-semibold text-foreground">{testimonial.author}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                </div>
            </figcaption>
        </figure>
    );
}
