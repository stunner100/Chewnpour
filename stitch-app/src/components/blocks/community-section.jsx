import React from 'react';
import { Button } from '../ui/button';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const communityPhotos = [
    { src: '/chewnpour/img1.jpg', alt: 'ChewnPour student studying with peers' },
    { src: '/chewnpour/img2.jpg', alt: 'ChewnPour student sharing notes' },
    { src: '/chewnpour/img3.jpg', alt: 'ChewnPour student smiling at camera' },
    { src: '/chewnpour/img4.jpg', alt: 'ChewnPour student reviewing materials' },
];

export function CommunitySection({ onCtaClick = () => {} }) {
    return (
        <section id="community" className="relative overflow-hidden border-t border-border/40 bg-background py-20 md:py-28">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">

                    <div className="max-w-xl">
                        <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                            Join a community of curious students
                        </h2>
                        <p className="mt-4 text-base md:text-lg text-muted-foreground">
                            Connect with peers across Ghana, share past questions, and work through
                            tough concepts together. The ChewnPour community is where learners help
                            each other cross the finish line.
                        </p>
                        <div className="mt-8 flex flex-col items-start gap-3">
                            <Button
                                asChild
                                size="lg"
                                className="group h-14 rounded-xl px-8 text-base font-semibold shadow-md transition-transform active:scale-95"
                            >
                                <Link
                                    to="/signup"
                                    className="flex items-center gap-2"
                                    onClick={() => onCtaClick('community_join')}
                                >
                                    Join the Community
                                    <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-0.5" />
                                </Link>
                            </Button>
                            <p className="text-sm text-foreground/60">
                                2,000+ students in our Telegram already.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:gap-5">
                        {communityPhotos.map(({ src, alt }) => (
                            <div
                                key={src}
                                className="aspect-square overflow-hidden rounded-2xl border border-border/60 bg-foreground/5 shadow-md"
                            >
                                <img
                                    src={src}
                                    alt={alt}
                                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>

                </div>
            </div>
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />
        </section>
    );
}
