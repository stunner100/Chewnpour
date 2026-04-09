import React from 'react';
import { Button } from '../ui/button';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CommunitySection({ onCtaClick = () => {} }) {
    return (
        <section id="community" className="bg-background py-16 sm:py-20 overflow-hidden relative border-t border-border/40">
            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center">
                    
                    {/* Left side text */}
                    <div className="max-w-xl text-left z-20">
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
                            Community
                        </h2>
                        <p className="text-lg md:text-xl text-foreground/90 leading-relaxed mb-6 font-medium">
                            Students on ChewnPour are Community Vibe Leaders who connect, share past questions, and curate the best study materials.
                        </p>
                        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                            To become an active peer leader, click on the <span className="font-semibold text-primary">'Community'</span> tab on your dashboard. Connect with peers, discuss tough concepts, and conquer your exams together.
                        </p>
                        <Button asChild size="lg" className="rounded-full px-8 h-14 text-base font-semibold shadow-md active:scale-95 transition-transform">
                            <Link
                                to="/signup"
                                className="flex items-center gap-2"
                                onClick={() => onCtaClick('community_join')}
                            >
                                Join the Community <ArrowUpRight className="size-5" />
                            </Link>
                        </Button>
                    </div>

                    {/* Right side floating circles cluster */}
                    <div className="relative h-[350px] sm:h-[450px] w-full flex items-center justify-center pointer-events-auto">
                        
                        {/* Center Huge (zIndex 30) */}
                        <div className="absolute z-30 w-48 h-48 sm:w-[280px] sm:h-[280px] rounded-full overflow-hidden shadow-2xl border-8 border-background hover:scale-105 transition-transform duration-500 hover:z-50 cursor-pointer">
                            <img src="/chewnpour/img1.jpg" alt="Student" className="w-full h-full object-cover" />
                        </div>

                        {/* Top Right Medium (zIndex 20) */}
                        <div className="absolute z-20 w-32 h-32 sm:w-44 sm:h-44 rounded-full overflow-hidden shadow-xl border-8 border-background top-[5%] sm:top-[12%] right-[5%] sm:right-[10%] hover:scale-105 transition-transform duration-500 hover:z-50 cursor-pointer">
                            <img src="/chewnpour/img2.jpg" alt="Student" className="w-full h-full object-cover" />
                        </div>

                        {/* Bottom Left Medium (zIndex 20) */}
                        <div className="absolute z-20 w-36 h-36 sm:w-48 sm:h-48 rounded-full overflow-hidden shadow-xl border-8 border-background bottom-[5%] sm:bottom-[10%] left-[8%] sm:left-[15%] hover:scale-105 transition-transform duration-500 hover:z-50 cursor-pointer">
                            <img src="/chewnpour/img3.jpg" alt="Student" className="w-full h-full object-cover" />
                        </div>

                        {/* Top Left Small (zIndex 40 - popping over the center a bit) */}
                        <div className="absolute z-40 w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden shadow-lg border-[6px] border-background top-[20%] sm:top-[25%] left-[15%] sm:left-[22%] hover:scale-105 transition-transform duration-500 hover:z-50 cursor-pointer">
                            <img src="/chewnpour/img4.jpg" alt="Student" className="w-full h-full object-cover" />
                        </div>

                        {/* Bottom Right Small (zIndex 10) */}
                        <div className="absolute z-10 w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden shadow-lg border-[6px] border-background bottom-[20%] sm:bottom-[25%] right-[10%] sm:right-[15%] hover:scale-105 transition-transform duration-500 hover:z-50 cursor-pointer">
                            <img src="/chewnpour/img2.jpg" alt="Student" className="w-full h-full object-cover" />
                        </div>

                        {/* Far Bottom Center Tiny (zIndex 30) */}
                        <div className="absolute z-30 w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shadow-md border-[4px] border-background bottom-[2%] sm:bottom-[5%] left-[50%] sm:left-[55%] hover:scale-105 transition-transform duration-500 hover:z-50 cursor-pointer">
                            <img src="/chewnpour/img3.jpg" alt="Student" className="w-full h-full object-cover" />
                        </div>

                        {/* Far Top Left Tiny (zIndex 10) */}
                        <div className="absolute z-10 w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden shadow-sm border-[4px] border-background top-[5%] sm:top-[8%] left-[25%] sm:left-[30%] hover:scale-105 transition-transform duration-500 hover:z-50 cursor-pointer">
                            <img src="/chewnpour/img4.jpg" alt="Student" className="w-full h-full object-cover scale-x-[-1]" />
                        </div>
                    </div>

                </div>
            </div>
            {/* Subtle background glow to add premium feel */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none z-0" />
        </section>
    );
}
