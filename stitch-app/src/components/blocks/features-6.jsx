import { BookOpen, Brain, Lock, Sparkles } from 'lucide-react'

export function Features() {
    return (
        <section id="features" className="py-16 md:py-32">
            <div className="mx-auto max-w-7xl space-y-12 px-6 lg:px-8">
                <div className="relative z-10 grid items-center gap-4 md:grid-cols-2 md:gap-12">
                    <h2 className="text-4xl font-semibold">
                        Everything you need to go from slides to exam-ready
                    </h2>
                    <p className="max-w-sm sm:ml-auto">
                        ChewnPour transforms your lecture materials into structured lessons, smart quizzes, and a personal AI tutor all in one place, built for university students.
                    </p>
                </div>

                {/* Three app screenshots side by side */}
                <div className="relative rounded-3xl p-3 md:-mx-8">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="relative overflow-hidden rounded-2xl border border-border shadow-lg">
                            <div className="bg-gradient-to-t from-background absolute inset-0 z-10 to-transparent" />
                            <img
                                src="/screenshots/app-dashboard.png"
                                alt="ChewnPour Dashboard"
                                className="w-full object-cover object-top"
                                width={2880}
                                height={1800}
                            />
                            <div className="absolute bottom-3 left-3 z-20">
                                <span className="text-xs font-semibold bg-white/90 dark:bg-black/60 text-gray-800 dark:text-gray-100 rounded-full px-2.5 py-1">Dashboard</span>
                            </div>
                        </div>
                        <div className="relative overflow-hidden rounded-2xl border border-border shadow-lg">
                            <div className="bg-gradient-to-t from-background absolute inset-0 z-10 to-transparent" />
                            <img
                                src="/screenshots/app-assignment.png"
                                alt="ChewnPour Assignment Helper"
                                className="w-full object-cover object-top"
                                width={2880}
                                height={1800}
                            />
                            <div className="absolute bottom-3 left-3 z-20">
                                <span className="text-xs font-semibold bg-white/90 dark:bg-black/60 text-gray-800 dark:text-gray-100 rounded-full px-2.5 py-1">Assignment Helper</span>
                            </div>
                        </div>
                        <div className="relative overflow-hidden rounded-2xl border border-border shadow-lg">
                            <div className="bg-gradient-to-t from-background absolute inset-0 z-10 to-transparent" />
                            <img
                                src="/screenshots/app-community.png"
                                alt="ChewnPour Community"
                                className="w-full object-cover object-top"
                                width={2880}
                                height={1800}
                            />
                            <div className="absolute bottom-3 left-3 z-20">
                                <span className="text-xs font-semibold bg-white/90 dark:bg-black/60 text-gray-800 dark:text-gray-100 rounded-full px-2.5 py-1">Community</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative mx-auto grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-8 lg:grid-cols-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <BookOpen className="size-4" />
                            <h3 className="text-sm font-medium">Instant Lessons</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            Upload any PDF or lecture slide and get structured lessons generated in seconds.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Brain className="size-4" />
                            <h3 className="text-sm font-medium">Smart Quizzes</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            AI creates exam-style practice questions from your actual course material.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-4" />
                            <h3 className="text-sm font-medium">AI Tutor</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            Ask anything about your material and get clear, personalized explanations instantly.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Lock className="size-4" />
                            <h3 className="text-sm font-medium">Private & Secure</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            Your documents and study data stay private — we never train on your content.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
