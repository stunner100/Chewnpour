import React from 'react';

const testimonials = [
  {
    author: "Prince A.",
    role: "Engineering Student",
    image: "/chewnpour/img1.jpg",
    content: (
        <>
            The biggest benefit for me in using ChewnPour is the <strong>Proactive AI</strong>. Staying on top of heavy engineering course loads is challenging, and so far, <strong>ChewnPour is the only AI-based tool that truly feels like a personal study assistant</strong>. Many AI tools can summarize notes, but it's still manual to ask for quizzes and track performance over time.<br/><br/>
            ChewnPour automatically does this and helps <strong>prioritize what topics to focus on</strong>, highlighting important formulas from my uploaded slides. It saves a lot of "friction" from jumping between different tools when you can just talk to an AI tutor. <br/><br/>
            <strong>It's saved my grades many times</strong>, bringing concepts to my attention that I completely forgot about.
        </>
    )
  },
  {
    author: "Aisha M.",
    role: "Medical Student",
    image: "/chewnpour/img2.jpg",
    content: (
        <>
            <strong>I LOVE IT.</strong> It's just insane how efficient it is. The premium tier is just amazingly awesome. It:<br/><br/>
            <ul className="list-disc pl-4 space-y-2 text-foreground/80 mt-2 mb-2">
                <li>Reads <strong>EVERY</strong> bit of information you give it (slide decks, PDFs) and understands the complex medical jargon extremely well.</li>
                <li>Everything you upload lands into a structured "Course" space where you can sort materials easily.</li>
                <li>For each new slide deck, AI automatically generates intelligent flashcards and interactive quizzes.</li>
                <li>AI Chat is just <strong>too smart</strong> and too aware of everything you upload to it.</li>
            </ul>
            The feedback loop is efficient. While studying, I can just ask the AI to save relevant bits of information straight to my notes.
        </>
    )
  },
  {
    author: "Emma Mensah",
    role: "Business Administration",
    image: "/chewnpour/img3.jpg",
    content: (
        <>
            I used to bounce between Notion, Google Docs, and Anki. <strong>But now it is ChewnPour.</strong><br/><br/>
            Past: Read interesting textbook chapters → take notes → leave them there forever and forget them before finals.<br/><br/>
            Now: Read chapters → upload to ChewnPour → AI structures them into actionable lessons and quizzes → <strong>easily recall all knowledge I studied.</strong>
        </>
    )
  },
  {
    author: "Grace O.",
    role: "Pre-med Student",
    image: "/chewnpour/img4.jpg",
    content: (
        <>
            The AI Humanizer tool is a game changer for assignments. <strong>It keeps my writing sounding authentic</strong> while fixing structure. And having an AI tutor answer my 2AM questions before an exam is literally priceless!
        </>
    )
  },
  {
    author: "David K.",
    role: "Law Student",
    image: "/chewnpour/img1.jpg",
    content: (
        <>
            Reading hundreds of case briefs gets exhausting. <strong>ChewnPour condenses cases into instantly digestible summaries.</strong> It's exactly the kind of tool every rigorous student needs to survive.
        </>
    )
  }
];

export function TestimonialsSection() {
    return (
        <section id="testimonials" className="bg-background py-24 sm:py-32 relative border-t border-border/40">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl font-['Outfit',sans-serif]">
                        Loved by
                    </h2>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Students, Lecturers, & Lifelong Learners
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {/* First Column */}
                    <div className="flex flex-col gap-8">
                        <TestimonialCard testimonial={testimonials[0]} />
                        <TestimonialCard testimonial={testimonials[3]} />
                    </div>

                    {/* Second Column */}
                    <div className="flex flex-col gap-8">
                        <TestimonialCard testimonial={testimonials[1]} />
                    </div>

                    {/* Third Column */}
                    <div className="flex flex-col gap-8">
                        <TestimonialCard testimonial={testimonials[2]} />
                        <TestimonialCard testimonial={testimonials[4]} />
                    </div>
                </div>
            </div>
        </section>
    );
}

function TestimonialCard({ testimonial }) {
    return (
        <div className="flex flex-col items-center bg-background p-2 rounded-2xl border border-transparent">
            {/* Avatar, Name, Title, horizontal line, text */}
            <img 
                src={testimonial.image} 
                alt={testimonial.author} 
                className="w-16 h-16 rounded-full object-cover mb-4 ring-1 ring-border shadow-sm hover:scale-105 transition-transform cursor-pointer"
            />
            <h3 className="text-lg font-bold text-foreground">
                {testimonial.author}
            </h3>
            <p className="text-sm italic text-muted-foreground mb-6">
                {testimonial.role}
            </p>
            
            <div className="w-full border-t border-border/60 mb-6"></div>
            
            <div className="text-base text-foreground/80 leading-relaxed text-left w-full">
                {testimonial.content}
            </div>
        </div>
    );
}
