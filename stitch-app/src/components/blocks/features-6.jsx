import { BookOpen, Brain, Sparkles } from 'lucide-react'

const features = [
    {
        icon: BookOpen,
        title: 'Instant Lessons',
        description: 'Upload any PDF or lecture slide and get structured lessons generated in seconds.',
        screenshot: '/screenshots/app-dashboard.png',
        screenshotAlt: 'ChewnPour dashboard showing a structured lesson view',
    },
    {
        icon: Brain,
        title: 'Smart Quizzes',
        description: 'AI creates exam-style practice questions from your actual course material.',
        screenshot: '/screenshots/app-assignment.png',
        screenshotAlt: 'ChewnPour assignment helper with practice questions',
    },
    {
        icon: Sparkles,
        title: 'AI Tutor',
        description: 'Ask anything about your material and get clear, personalized explanations instantly.',
        screenshot: '/screenshots/app-community.png',
        screenshotAlt: 'ChewnPour AI tutor conversation view',
    },
]

export function Features() {
    return (
        <section id="features" className="py-20 md:py-28">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-3xl text-center">
                    <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
                        Everything you need to go from slides to exam-ready
                    </h2>
                    <p className="mt-4 text-base md:text-lg text-muted-foreground">
                        ChewnPour transforms your lecture materials into structured lessons,
                        smart quizzes, and a personal AI tutor — all in one place, built for
                        university students.
                    </p>
                </div>

                <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
                    {features.map((feature) => {
                        const IconComponent = feature.icon;
                        return (
                            <div key={feature.title} className="flex flex-col">
                            <div className="relative overflow-hidden rounded-2xl border border-border shadow-lg">
                                <div className="bg-gradient-to-t from-background/30 absolute inset-0 z-10 to-transparent" />
                                <img
                                    src={feature.screenshot}
                                    alt={feature.screenshotAlt}
                                    className="w-full object-cover object-top"
                                    width={2880}
                                    height={1800}
                                />
                            </div>
                            <div className="mt-5 flex items-center gap-2">
                                <IconComponent className="size-5 text-primary" />
                                <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                            </div>
                            <p className="mt-2 text-sm text-foreground/70">
                                {feature.description}
                            </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    )
}
