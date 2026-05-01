import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { capturePostHogEvent } from '../lib/posthog';
import { formatPlanPrice, normalizeTopUpOptions } from '../lib/pricingCurrency';

/**
 * Landing page styled to the NajmAI design specification (Outfit font, rgb(16,17,18) background,
 * rgb(39,40,41) cards, rgb(145,75,241) accent, grain texture, glossy purple swirl). Copy and product
 * wiring (Convex pricing, PostHog events, auth redirects, CTAs to /signup, /login) are ChewnPour's.
 */

const PAGE_BG = 'rgb(16, 17, 18)';
const CARD_BG = 'rgb(39, 40, 41)';
const HERO_BG = 'rgb(30, 31, 32)';
const FOOTER_BG = 'rgb(20, 20, 19)';
const ACCENT = 'rgb(145, 75, 241)';
const SUBTEXT = 'rgb(163, 163, 163)';
const VIDEO_BTN = 'rgb(255, 38, 0)';

// ── Content (ChewnPour copy on NajmAI structure) ───────────────────────────
const HOW_CARDS = [
    {
        icon: 'upload',
        title: 'Upload Notes',
        body: 'Share your lecture slides, PDFs, or scanned notes and let our AI grasp the syllabus.',
    },
    {
        icon: 'auto_awesome',
        title: 'Generate Lessons',
        body: 'Watch as ChewnPour crafts structured lessons and quizzes tailored to your material.',
    },
    {
        icon: 'rocket_launch',
        title: 'Master the Topic',
        body: 'Refine your understanding with the AI tutor and progress tracking that keeps you sharp.',
    },
];

const FEATURE_ROWS = [
    {
        title: 'High-Resolution Lessons',
        body: 'Turn dense lecture material into clean, structured lessons suitable for revision and exam prep. Every concept laid out the way a great tutor would explain it.',
        side: 'right',
        mockup: 'files',
    },
    {
        title: 'Real-Time Study Companion',
        body: 'Chat with the AI tutor as you read. Ask follow-up questions, request worked examples, and get explanations rephrased until they finally click.',
        side: 'left',
        mockup: 'collab',
    },
    {
        title: 'Turn Slides into a Podcast',
        body: 'Listen to your lecture material on the go. ChewnPour converts your slides and PDFs into a natural-sounding two-speaker podcast so you can revise on the bus, at the gym, or between lectures.',
        side: 'right',
        mockup: 'podcast',
    },
];

const TRANSFORM_CARDS = [
    {
        body: 'Dive into AI-assisted study where every chapter is broken down, every weak spot surfaced, and every revision session built around what you actually need.',
        title: 'Witness the Future',
    },
    {
        body: 'Step beyond cramming. ChewnPour reorganises material the way working memory actually absorbs it — with practice and recall built in from day one.',
        title: 'Visualize the Impossible',
    },
    {
        body: 'Experience the perfect blend of clarity and depth. Our AI ensures every lesson is not just easy to read, but built around the questions exams actually ask.',
        title: 'Synergy and Style',
    },
    {
        body: 'Embrace the elegance of meticulously crafted study guides. ChewnPour polishes every detail to bring exam-ready quality to your everyday revision.',
        title: 'Timeless Precision',
    },
];

const TESTIMONIALS = [
    { name: 'Akosua M.', quote: 'Using ChewnPour completely transformed the way I approach exams. It is like having a personal tutor on call 24/7. Highly recommend it!' },
    { name: 'Kwame B.', quote: 'The lesson breakdowns are spot on and the quizzes save me so much time. I can focus on understanding rather than getting bogged down in details.' },
    { name: 'Efua O.', quote: 'This tool is a game-changer. It is incredibly intuitive and the results are always impressive. I cannot imagine studying without it now.' },
    { name: 'Yaw A.', quote: 'I was sceptical at first, but ChewnPour exceeded all my expectations. It is easy to use and turns my notes into proper study material effortlessly.' },
    { name: 'Abena D.', quote: 'What an amazing tool. The AI understands my course perfectly and helps me revise stunning amounts of content in no time. My productivity has doubled.' },
    { name: 'Kofi A.', quote: 'I love how ChewnPour blends technology and learning. It is a must-have for any student looking to streamline revision and produce top-notch results.' },
];

const FAQS = [
    { q: 'How does the AI generate lessons?', a: 'Our model reads your uploads the way a tutor would — extracting key concepts, definitions, and worked examples — then rewrites them as a structured lesson with quizzes built in.' },
    { q: 'Can I customize the AI-generated lessons?', a: 'Yes. You can re-explain, change tone, dive deeper into any section, or generate quizzes focused on a specific subtopic.' },
    { q: 'What support options are available?', a: 'Reach us on Telegram or email and a real human will get back to you. We are students-turned-builders and we read every message.' },
    { q: 'Is there a free trial available?', a: 'You get 3 free uploads with full access to AI lessons, quizzes, the AI tutor, and progress tracking before deciding to upgrade.' },
    { q: 'How secure is my data?', a: 'Your uploads are stored securely and only used to generate your own lessons. We never sell your data or use it to train public models.' },
    { q: 'What integrations are available?', a: 'ChewnPour works with PDFs, slide decks, scanned notes, and group-chat exports — wherever your study material lives, we meet it there.' },
];

const BLOG_POSTS = [
    {
        date: 'Apr 22, 2026',
        read: '6 min read',
        title: 'How to revise a 200-page lecture deck in one evening',
        excerpt: 'A practical playbook for turning a giant slide pack into a focused study session — what to skim, what to memorise, and how ChewnPour shortens the loop.',
        tone: 'rgb(180, 130, 255)',
        author: 'The ChewnPour Team',
        body: [
            { type: 'p', text: 'Every semester ends the same way. Three weeks of warning, two weeks of half-trying, and one panicked evening with a 200-page slide deck and a single highlighter. The good news is that the problem is rarely the volume. It is the order in which you tackle it.' },
            { type: 'h2', text: 'Step 1 — Triage before you read' },
            { type: 'p', text: 'Open the deck and skim every single slide for thirty seconds. You are not reading; you are mapping. Mark the slides that have diagrams, definitions, or anything your lecturer described as "important" in class. That is your real syllabus. Everything else is supporting prose.' },
            { type: 'h2', text: 'Step 2 — Convert, do not transcribe' },
            { type: 'p', text: 'Drop the deck into ChewnPour and let it produce a structured lesson. The point is not to replace reading — it is to give you a clean spine: definitions on top, mechanisms in the middle, worked examples at the bottom. From there you decide what needs deeper attention.' },
            { type: 'h2', text: 'Step 3 — Quiz yourself before you feel ready' },
            { type: 'p', text: 'This is the step everyone skips. Generate a short quiz on the first third of the material before you finish reading the rest. The questions you get wrong tell you what to focus on for the next two hours. Re-reading without testing is the slowest way to learn — your brain rewards retrieval, not recognition.' },
            { type: 'h2', text: 'Step 4 — Sleep, then recall' },
            { type: 'p', text: 'If you have any time at all the next morning, do one final pass: cover the lesson, write down everything you remember, then check. Twenty minutes of recall beats two hours of re-reading. Walk into the exam knowing what you know.' },
        ],
    },
    {
        date: 'Apr 8, 2026',
        read: '5 min read',
        title: 'Listen, do not just read — why podcast revision actually works',
        excerpt: 'The science behind audio learning and how converting your slides into a two-speaker podcast helps concepts stick on the bus, at the gym, or between lectures.',
        tone: 'rgb(145, 75, 241)',
        author: 'The ChewnPour Team',
        body: [
            { type: 'p', text: 'Most students think learning has to happen at a desk with a textbook. That assumption is the single biggest reason revision feels miserable. The truth is that your brain is happy to absorb structured material from your ears — sometimes more so than from your eyes.' },
            { type: 'h2', text: 'Why audio sticks' },
            { type: 'p', text: 'When you read a paragraph, your eyes move ahead of your understanding. When you listen, the pace is set for you, and your brain has to follow in real time. That gentle constraint forces deeper processing. It is the same reason a good lecturer can make a hard concept feel obvious — pace, tone, and the rhythm of explanation matter.' },
            { type: 'h2', text: 'Why two speakers beat one' },
            { type: 'p', text: 'A monologue is fine. A dialogue is better. When a tutor explains a concept and a student asks a clarifying question right after, you get both the answer and the misunderstanding modelled for you. ChewnPour generates podcasts in this two-speaker format on purpose: you hear the question you would have asked, and the answer lands harder.' },
            { type: 'h2', text: 'How to actually use it' },
            { type: 'p', text: 'Generate the podcast the night before. Listen on the bus to campus, while cooking, between lectures, on your evening walk. Aim for two passes per topic — the first is exposure, the second is recall. By the time you sit down to revise properly, the structure is already in your head.' },
            { type: 'h2', text: 'A note on attention' },
            { type: 'p', text: 'Audio works when you are doing something low-stakes with your hands. It does not work when you are scrolling, replying to messages, or driving in heavy traffic. Pair it with movement, not multitasking.' },
        ],
    },
    {
        date: 'Mar 27, 2026',
        read: '7 min read',
        title: 'The active recall playbook every Ghanaian student should steal',
        excerpt: 'Why re-reading your notes is the slowest way to learn, and how to design quizzes that mirror the questions actually showing up on UG, KNUST, and UCC exams.',
        tone: 'rgb(120, 60, 220)',
        author: 'The ChewnPour Team',
        body: [
            { type: 'p', text: 'Walk into any library on a Sunday evening and you will see the same scene: students underlining their notes, copying definitions into fresh notebooks, re-reading chapters they already half-know. It looks like work. It feels like work. It is barely work at all.' },
            { type: 'h2', text: 'The problem with re-reading' },
            { type: 'p', text: 'When you re-read familiar material, your brain confuses fluency with mastery. The words look familiar, so you assume you understand them. Then the exam asks you to apply a concept you have only ever seen, never used, and the recall is not there. Active recall — pulling information out of your head instead of letting your eyes pass over it — is the cure.' },
            { type: 'h2', text: 'Build your own question bank' },
            { type: 'p', text: 'After every lecture, write five questions about what was taught. Not summaries — questions. The harder you make them, the more you learn. Tomorrow morning, answer them from memory. Next week, answer them again. The questions you keep getting wrong are your real syllabus.' },
            { type: 'h2', text: 'Mirror the format' },
            { type: 'p', text: 'University exams have patterns. UG essays reward structured arguments with cited examples. KNUST engineering papers reward clean derivations with units. UCC nursing exams reward clinical scenarios with prioritisation. Whatever your course, your practice questions should mirror the format of the real thing — same length, same depth, same vibe.' },
            { type: 'h2', text: 'Use AI to scale, not replace' },
            { type: 'p', text: 'ChewnPour can generate hundreds of practice questions from your slides in seconds. The leverage is not in the volume — it is in the variation. Different angles on the same concept reveal where your understanding is shallow. Treat the AI as a sparring partner, not a tutor: it asks, you answer, you learn what you actually know.' },
            { type: 'h2', text: 'Sleep is part of the protocol' },
            { type: 'p', text: 'Recall consolidates during sleep. A short session before bed and a short session in the morning will outperform a single long session every time. This is not a productivity hack — it is how human memory works.' },
        ],
    },
];

const FOOTER_NAV = ['How it Works', 'Features', 'Pricing', 'Blog', 'FAQs', 'Contact'];

// ── Visual primitives ───────────────────────────────────────────────────────

const HexLogo = ({ size = 28 }) => (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} aria-hidden="true">
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-white" fill="none">
            <polygon points="50,6 90,28 90,72 50,94 10,72 10,28" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" fill="none" />
        </svg>
        <img
            src="/logonew.jpeg"
            alt=""
            className="relative block object-contain rounded-full"
            style={{ width: size * 0.55, height: size * 0.55 }}
        />
    </span>
);

// Hero visual — uses the rendered photo at /chewnpour/hero.png (study desk with laptop +
// floating notes lit in violet) instead of the SVG swirl.
const PurpleSwirl = ({ className = '' }) => (
    <img
        src="/chewnpour/hero.png"
        alt="ChewnPour AI study assistant on a laptop with floating lesson cards above an open textbook"
        className={`block object-cover object-center ${className}`}
        loading="eager"
        decoding="async"
    />
);

// Minimal monochrome wordmark for the partner strip (placeholder marks, ChewnPour-friendly)
const PartnerMark = ({ icon, label }) => (
    <div className="flex items-center gap-2 text-white/85" aria-hidden="true">
        <span className="material-symbols-outlined text-[26px]">{icon}</span>
        <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>
            {label}
        </span>
    </div>
);

const PARTNERS = [
    { icon: 'all_inclusive', label: 'Unlimited Learning Support' },
    { icon: 'menu_book', label: 'PDF & Slide Uploads' },
    { icon: 'deployed_code', label: 'Structured Lessons' },
    { icon: 'radio_button_unchecked', label: 'Smart Quizzes' },
    { icon: 'groups', label: 'For African Students' },
    { icon: 'bolt', label: 'Fast AI Explanations' },
];

// Sub-mockups are declared at module scope so React doesn't see a fresh
// component identity on every render of FeatureMockup (lint rule
// `react-hooks/static-components`).
const FilesMock = () => (
        <div className="rounded-xl bg-white shadow-2xl p-4 w-[78%] text-[#0A0A0A]">
            <div className="flex items-center justify-between text-[11px] font-semibold mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
                <span className="text-[#0A0A0A]/55">File Type</span>
                <span className="px-2 py-0.5 rounded-full text-white text-[10px]" style={{ background: ACCENT }}>Total</span>
            </div>
            {[['PDF', '237 KB'], ['DOC', '560 KB'], ['Slides', '257 KB'], ['Notes', '137 KB']].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1.5 text-[12px] border-b border-[#0A0A0A]/8 last:border-0" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <span className="font-semibold">{k}</span>
                    <span className="text-[#0A0A0A]/60">{v}</span>
                </div>
            ))}
            <div className="mt-3 rounded-lg p-2.5" style={{ background: 'rgba(145,75,241,0.08)' }}>
                <p className="text-[11px] font-semibold text-[#0A0A0A]/65" style={{ fontFamily: 'Inter, sans-serif' }}>Mastery</p>
                <svg viewBox="0 0 200 50" className="w-full h-10 mt-1">
                    <defs>
                        <linearGradient id="mockArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.45" />
                            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d="M0 38 L20 32 L45 35 L70 22 L95 26 L120 12 L150 18 L180 6 L200 12 L200 50 L0 50 Z" fill="url(#mockArea)" />
                    <path d="M0 38 L20 32 L45 35 L70 22 L95 26 L120 12 L150 18 L180 6 L200 12" stroke={ACCENT} strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-white text-[10px] font-bold mt-1" style={{ background: ACCENT }}>100k mastery</span>
            </div>
        </div>
    );

const CollabMock = () => (
    <div className="rounded-xl bg-white shadow-2xl p-4 w-[80%] text-[#0A0A0A]">
        <div className="flex items-center justify-between text-[11px] font-semibold mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
            <span className="text-[#0A0A0A]/55">Collaborators</span>
            <span className="material-symbols-outlined text-[16px] text-[#0A0A0A]/55">chevron_right</span>
        </div>
        <div className="flex items-center gap-2 mb-4">
            {['A', 'K', 'E', 'Y', 'B'].map((initial, i) => (
                <div key={i} className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white" style={{ background: ['#7C3AED', '#22C55E', '#F59E0B', '#EC4899', '#3B82F6'][i] }}>
                    {initial}
                </div>
            ))}
        </div>
        <div className="rounded-lg p-3" style={{ background: '#F4F1FE' }}>
            <p className="text-[11px] font-bold text-[#0A0A0A] mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>Building Study Group Notes</p>
            <div className="space-y-1.5">
                {[60, 80, 45].map((w, i) => (
                    <div key={i} className="h-1.5 rounded-full bg-white overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${w}%`, background: ACCENT }} />
                    </div>
                ))}
            </div>
            <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-white text-[10px] font-bold" style={{ background: ACCENT }}>Live</div>
        </div>
    </div>
);

const ScheduleMock = () => (
    <div className="rounded-xl bg-white shadow-2xl p-4 w-[80%] text-[#0A0A0A]">
        <div className="flex items-center justify-between mb-3 text-xs font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
            <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>calendar_today</span>
                <span className="material-symbols-outlined text-[16px] text-[#0A0A0A]/55">person</span>
                <span className="material-symbols-outlined text-[16px] text-[#0A0A0A]/55">play_arrow</span>
                <span className="material-symbols-outlined text-[16px] text-[#0A0A0A]/55">place</span>
            </div>
        </div>
        <div className="text-center text-xs font-bold mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>April 2026</div>
        <div className="grid grid-cols-7 gap-1 text-[10px]" style={{ fontFamily: 'Inter, sans-serif' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <div key={`h-${i}`} className="text-center text-[#0A0A0A]/55 font-semibold">{d}</div>
            ))}
            {Array.from({ length: 21 }).map((_, i) => {
                const isActive = i === 9;
                const isStudy = [3, 6, 9, 12, 15, 18].includes(i);
                return (
                    <div
                        key={i}
                        className={`h-7 rounded flex items-center justify-center font-semibold ${
                            isActive ? 'text-white' : isStudy ? 'text-[color:rgb(145,75,241)]' : 'text-[#0A0A0A]/65'
                        }`}
                        style={{
                            background: isActive ? ACCENT : isStudy ? 'rgba(145,75,241,0.12)' : 'transparent',
                        }}
                    >
                        {i + 5}
                    </div>
                );
            })}
        </div>
    </div>
);

const PodcastMock = () => (
    <div className="rounded-xl bg-white shadow-2xl p-4 w-[80%] text-[#0A0A0A]">
        <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: ACCENT }}>
                <span className="material-symbols-outlined text-white" style={{ fontSize: 24 }}>headphones</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-[#0A0A0A] truncate" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Biochem · Enzyme Kinetics
                </p>
                <p className="text-[10px] text-[#0A0A0A]/55" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Two-speaker dialogue · 12 min
                </p>
            </div>
        </div>
        <div className="flex items-end gap-[3px] h-10 mb-2">
            {[6, 14, 22, 16, 28, 34, 24, 32, 38, 28, 22, 30, 36, 26, 32, 24, 18, 26, 30, 22, 16, 24, 28, 18, 12, 8, 14, 20, 12, 8].map((h, i) => (
                <span
                    key={i}
                    className="flex-1 rounded-full"
                    style={{
                        height: h,
                        background: i < 12 ? ACCENT : 'rgba(145,75,241,0.22)',
                    }}
                />
            ))}
        </div>
        <div className="flex items-center justify-between text-[10px]" style={{ color: 'rgba(10,10,10,0.55)', fontFamily: 'Inter, sans-serif' }}>
            <span>3:42</span>
            <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px]">replay_10</span>
                <span
                    className="material-symbols-outlined inline-flex items-center justify-center w-7 h-7 rounded-full text-white"
                    style={{ background: ACCENT, fontSize: 16 }}
                >
                    pause
                </span>
                <span className="material-symbols-outlined text-[18px]">forward_10</span>
            </div>
            <span>11:58</span>
        </div>
        <div className="flex items-center gap-2 mt-3">
            <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                style={{ background: ACCENT, fontFamily: 'Inter, sans-serif' }}
            >
                <span className="w-1.5 h-1.5 rounded-full bg-white" /> Tutor
            </span>
            <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: 'rgba(145,75,241,0.12)', color: ACCENT, fontFamily: 'Inter, sans-serif' }}
            >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} /> Student
            </span>
        </div>
    </div>
);

const FeatureMockup = ({ kind }) => {
    const Card = kind === 'podcast' ? PodcastMock : kind === 'collab' ? CollabMock : kind === 'schedule' ? ScheduleMock : FilesMock;
    return (
        <div className="relative aspect-[5/4] rounded-2xl overflow-hidden border border-white/5">
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #4A1AA0 0%, #7C3AED 45%, #A259FF 100%)' }} />
            <div
                className="absolute inset-0 opacity-70 mix-blend-screen"
                style={{
                    background:
                        'repeating-linear-gradient(115deg, rgba(255,255,255,0.18) 0 6px, transparent 6px 30px), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.45) 0%, transparent 35%)',
                    filter: 'blur(1px)',
                }}
            />
            <div className="absolute inset-0 flex items-center justify-center p-6">
                <Card />
            </div>
        </div>
    );
};

const FaqItem = ({ q, a, open, onToggle }) => (
    <div className="border-b" style={{ borderColor: 'rgba(217,217,217,0.15)' }}>
        <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-6 py-5 text-left" aria-expanded={open}>
            <span className="text-[16px] font-semibold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>{q}</span>
            <span className={`material-symbols-outlined text-white/70 text-[22px] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>expand_more</span>
        </button>
        <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100 pb-5' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
                <p className="text-[15px] leading-relaxed" style={{ color: SUBTEXT, fontFamily: 'Outfit, sans-serif' }}>{a}</p>
            </div>
        </div>
    </div>
);

// ── Page ──────────────────────────────────────────────────────────────────

const LandingPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [billing, setBilling] = useState('monthly');
    const [openFaq, setOpenFaq] = useState(0);
    const [activePost, setActivePost] = useState(null);

    // Lock body scroll while the blog modal is open, and let Esc close it.
    useEffect(() => {
        if (!activePost) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e) => { if (e.key === 'Escape') setActivePost(null); };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [activePost]);

    const pricing = useQuery(api.subscriptions.getPublicTopUpPricing, {});
    const topUpOptions = useMemo(() => normalizeTopUpOptions(pricing?.topUpOptions), [pricing?.topUpOptions]);
    const starterPlan = topUpOptions.find((p) => p.id === 'starter') || topUpOptions[0] || { id: 'starter', amountMajor: 20, credits: 5, currency: 'GHS' };
    const maxPlan = topUpOptions.find((p) => p.id === 'max') || topUpOptions[topUpOptions.length - 1] || { id: 'max', amountMajor: 40, credits: 12, currency: starterPlan.currency || 'GHS' };
    const captureLandingEvent = (eventName, properties = {}) =>
        capturePostHogEvent(eventName, { page: 'landing', pathname: typeof window !== 'undefined' ? window.location.pathname : '/', ...properties });

    useEffect(() => {
        if (user) navigate('/dashboard', { replace: true });
    }, [user, navigate]);

    const billingMultiplier = billing === 'yearly' ? 10 : 1;

    const planCards = [
        {
            tier: 'FREE',
            price: formatPlanPrice(0, starterPlan.currency),
            suffix: 'Free forever',
            features: ['Basic AI-generated lessons', 'Access to AI tutor', 'Standard quiz library', '3 uploads per month'],
            ctaName: 'pricing_free',
        },
        {
            tier: 'BASIC',
            price: formatPlanPrice(starterPlan.amountMajor * billingMultiplier, starterPlan.currency),
            suffix: billing === 'yearly' ? 'Billed yearly' : 'Billed monthly',
            features: [
                'Advanced AI-generated lessons',
                'Full access to study tools',
                'Premium quiz library',
                `${starterPlan.credits * billingMultiplier} document uploads`,
                'Real-time progress tracking',
                'Priority email support',
            ],
            ctaName: 'pricing_basic',
        },
        {
            tier: 'PRO',
            price: formatPlanPrice(maxPlan.amountMajor * billingMultiplier, maxPlan.currency),
            suffix: billing === 'yearly' ? 'Billed yearly' : 'Billed monthly',
            features: [
                'All features in Basic plan',
                'Dedicated study coach',
                'Custom AI revision plans',
                'Onboarding session',
                '24/7 priority support',
                'Advanced analytics & reporting',
                'Secure cloud storage',
            ],
            ctaName: 'pricing_pro',
        },
    ];

    const heading = (white, accent, trailing = '') => (
        <>
            {white}{' '}
            <span style={{ color: ACCENT }}>{accent}</span>
            {trailing && <span> {trailing}</span>}
        </>
    );

    return (
        <div
            className="landing-root relative min-h-screen overflow-x-hidden"
            style={{ background: PAGE_BG, color: '#fff', fontFamily: '"Outfit", "Inter", system-ui, sans-serif' }}
        >
            <style>{`
                .landing-root { font-family: 'Outfit', 'Inter', system-ui, sans-serif; }
                .landing-root .font-mono { font-family: 'Outfit', 'Inter', system-ui, sans-serif !important; }
                .landing-root h1, .landing-root h2, .landing-root h3, .landing-root h4 { font-family: 'Outfit', sans-serif; letter-spacing: -0.025em; }
                .landing-root .ui-text { font-family: 'Inter', sans-serif; }
                .grain { position: relative; isolation: isolate; }
                .grain::before {
                    content: ''; position: absolute; inset: 0; pointer-events: none;
                    border-radius: inherit; opacity: 0.5; mix-blend-mode: overlay;
                    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
                    background-size: 180px 180px; z-index: 0;
                }
                .grain > * { position: relative; z-index: 1; }
                @keyframes marqueeRight { from { transform: translateX(0) } to { transform: translateX(-50%) } }
                @keyframes marqueeLeft { from { transform: translateX(-50%) } to { transform: translateX(0) } }
                .marquee-right { animation: marqueeRight 35s linear infinite; }
                .marquee-left { animation: marqueeLeft 35s linear infinite; }

                /* Hero card — exact NajmAI dimensions */
                .hero-section {
                    display: flex;
                    justify-content: center;
                    padding: 16px 12px 40px;
                }
                .hero-card {
                    width: 100%;
                    max-width: 1200px;
                    height: 580px;
                    border-radius: 40px;
                    background: ${CARD_BG};
                    padding: 0 0 0 40px;
                }
                .hero-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    align-items: center;
                    gap: 16px;
                }
                .hero-copy { padding-right: 16px; }
                .hero-title { font-size: 62px; }
                .hero-sub { margin-top: 24px; max-width: 520px; font-size: 17px; }
                .hero-visual {
                    position: relative;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    overflow: hidden;
                }
                /* Hero / CTA photo — contain so nothing crops, then feather the edges
                   into the dark card background with a radial mask so it reads as if
                   the violet glow seamlessly bleeds out of the card itself. */
                .hero-swirl,
                .cta-swirl {
                    width: 100%;
                    height: 100%;
                    max-width: none;
                    object-fit: cover;
                    object-position: center right;
                    -webkit-mask-image: radial-gradient(ellipse 75% 80% at 65% 50%, #000 35%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.4) 75%, transparent 100%);
                    mask-image: radial-gradient(ellipse 75% 80% at 65% 50%, #000 35%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.4) 75%, transparent 100%);
                }
                .hero-visual,
                .cta-visual { overflow: visible; }

                /* Transforming Study cards — exact NajmAI grid */
                .transform-grid {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    grid-auto-rows: 324px;
                    gap: 20px;
                    width: 100%;
                }
                .transform-card {
                    position: relative;
                    background: ${CARD_BG};
                    border-radius: 20px;
                    padding: 20px;
                    height: 324px;
                    overflow: hidden;
                }
                @media (max-width: 809px) {
                    .transform-grid {
                        grid-template-columns: 1fr;
                        grid-auto-rows: 280px;
                    }
                    .transform-card { grid-column: span 1 !important; height: 280px; }
                }

                /* Arrow circle states — invert on hover for non-highlight cards,
                   stay white-with-purple-arrow always for highlight cards */
                .arrow-pill { background: ${ACCENT}; }
                .arrow-pill .arrow-icon { color: #fff; }
                .arrow-pill.is-highlight { background: #fff; }
                .arrow-pill.is-highlight .arrow-icon { color: ${ACCENT}; }
                .transform-card:hover .arrow-pill { background: #fff; }
                .transform-card:hover .arrow-pill .arrow-icon { color: ${ACCENT}; }

                /* Lift the whole card slightly on hover for tactile feedback */
                .transform-card { transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1); }
                .transform-card:hover { transform: translateY(-4px); }

                /* Testimonial carousel — auto-scrolling marquee, pauses on hover */
                @keyframes testimonialScroll {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
                }
                .testimonials-viewport {
                    position: relative;
                    overflow: hidden;
                    /* Subtle edge fades so cards dissolve in/out instead of clipping hard */
                    -webkit-mask-image: linear-gradient(to right, transparent, #000 5%, #000 95%, transparent);
                    mask-image: linear-gradient(to right, transparent, #000 5%, #000 95%, transparent);
                }
                .testimonials-track {
                    display: flex;
                    gap: 20px;
                    width: max-content;
                    animation: testimonialScroll 50s linear infinite;
                }
                .testimonials-viewport:hover .testimonials-track { animation-play-state: paused; }
                .testimonial-card {
                    flex: 0 0 auto;
                    width: clamp(280px, 32vw, 420px);
                    border-radius: 16px;
                    padding: 20px;
                    min-height: 260px;
                }
                @media (min-width: 810px) {
                    .testimonial-card { padding: 28px; min-height: 280px; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .testimonials-track { animation: none; }
                }

                /* Tablet */
                @media (max-width: 1279px) and (min-width: 810px) {
                    .hero-card { padding: 60px 0 0 40px; }
                    .hero-title { font-size: 52px; }
                }

                /* Mobile */
                @media (max-width: 809px) {
                    .hero-section { padding: 8px 12px 24px; }
                    .hero-card {
                        height: auto;
                        min-height: min-content;
                        padding: 32px 20px 220px;
                        border-radius: 28px;
                    }
                    .hero-grid {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }
                    .hero-copy { padding-right: 0; }
                    .hero-title { font-size: 36px; line-height: 1.08; }
                    .hero-sub { font-size: 15px; max-width: 100%; margin-top: 16px; }
                    .hero-visual {
                        position: absolute;
                        right: -30px;
                        bottom: -30px;
                        height: 240px;
                        width: 280px;
                        max-width: 72%;
                    }
                    .hero-swirl { width: 100%; margin-right: 0; }
                }
                @media (max-width: 380px) {
                    .hero-card { padding: 28px 18px 200px; }
                    .hero-title { font-size: 32px; }
                    .hero-visual { height: 200px; width: 240px; }
                }
            `}</style>

            {/* ── 1. NAVIGATION ── */}
            <header className="sticky top-0 z-50" style={{ background: PAGE_BG }}>
                <div className="mx-auto max-w-[1200px] px-5 sm:px-6 lg:px-12 py-3 md:py-5 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2.5 text-white">
                        <HexLogo size={28} />
                        <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 20 }}>ChewnPour</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <a href="#features" className="hidden md:inline text-sm text-white ui-text hover:opacity-80 transition-opacity">More Features</a>
                        <button
                            onClick={() => setMobileMenuOpen((o) => !o)}
                            className="inline-flex items-center justify-center w-11 h-11 rounded-lg"
                            style={{ background: CARD_BG }}
                            aria-label="Open menu"
                            aria-expanded={mobileMenuOpen}
                        >
                            <span className="material-symbols-outlined text-white text-[22px]">{mobileMenuOpen ? 'close' : 'menu'}</span>
                        </button>
                    </div>
                </div>
                {mobileMenuOpen && (
                    <div className="mx-auto max-w-[1200px] px-6 lg:px-12 pb-4">
                        <div className="rounded-2xl p-4 grain" style={{ background: CARD_BG }}>
                            <nav className="flex flex-col gap-1">
                                {['How it Works', 'Features', 'Pricing', 'FAQs', 'Contact'].map((label, i) => (
                                    <a
                                        key={label}
                                        href={['#how', '#features', '#pricing', '#faq', '#contact'][i]}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="py-2.5 px-3 rounded-lg text-sm font-semibold text-white hover:opacity-80 ui-text"
                                    >
                                        {label}
                                    </a>
                                ))}
                                <Link
                                    to="/login"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="py-2.5 px-3 rounded-lg text-sm font-semibold text-white hover:opacity-80 ui-text"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    to="/signup"
                                    onClick={() => { setMobileMenuOpen(false); captureLandingEvent('landing_cta_clicked', { cta_name: 'mobile_signup' }); }}
                                    className="mt-2 inline-flex items-center justify-center h-10 rounded-lg text-sm font-bold text-white"
                                    style={{ background: ACCENT }}
                                >
                                    Get Started Free
                                </Link>
                            </nav>
                        </div>
                    </div>
                )}
            </header>

            <main className="relative z-10">
                {/* ── 2. HERO ── */}
                <section className="hero-section">
                    <div className="hero-card grain relative overflow-hidden border border-white/5">
                        <div className="hero-grid h-full">
                            <div className="hero-copy">
                                <h1 className="hero-title" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, lineHeight: 1.05 }}>
                                    Your AI-Powered<br />
                                    <span style={{ color: ACCENT }}>Study</span> Assistant
                                </h1>
                                <p className="hero-sub" style={{ color: SUBTEXT, fontFamily: 'Outfit, sans-serif', lineHeight: 1.55 }}>
                                    Unlock your learning potential. Seamlessly turn slides and PDFs into structured lessons,
                                    quizzes, and an always-on tutor — built for African students.
                                </p>
                                <div className="mt-7 flex flex-wrap items-center gap-3">
                                    <Link
                                        to="/signup"
                                        onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'hero_get_started' })}
                                        className="inline-flex items-center justify-center h-11 px-6 rounded-lg text-white text-sm font-bold ui-text"
                                        style={{ background: ACCENT }}
                                    >
                                        Get Started Free
                                    </Link>
                                </div>
                            </div>
                            <div className="hero-visual">
                                <PurpleSwirl className="hero-swirl" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 3. PARTNER MARQUEE ── */}
                <section className="py-10 md:py-14">
                    <div className="relative overflow-hidden">
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10" style={{ background: `linear-gradient(to right, ${PAGE_BG}, transparent)` }} />
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10" style={{ background: `linear-gradient(to left, ${PAGE_BG}, transparent)` }} />
                        <div className="flex marquee-right gap-16 whitespace-nowrap w-max">
                            {[...PARTNERS, ...PARTNERS].map((p, i) => (
                                <PartnerMark key={`${p.label}-${i}`} icon={p.icon} label={p.label} />
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 4. UNLEASH YOUR CREATIVITY ── */}
                <section id="how" className="mx-auto max-w-[1200px] px-6 lg:px-12 py-16 md:py-24">
                    <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 'clamp(34px, 4.5vw, 48px)', lineHeight: 1.1 }}>
                        {heading('Unleash Your', 'Creativity')}
                    </h2>
                    <p className="mt-5 max-w-[680px]" style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55 }}>
                        Discover how ChewnPour transforms your lecture material into a study system that actually
                        sticks. Follow these simple steps to turn your notes into mastery.
                    </p>
                    <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
                        {HOW_CARDS.map((card) => (
                            <div key={card.title} className="grain rounded-[16px] p-7 flex flex-col min-h-[260px]" style={{ background: CARD_BG }}>
                                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full" style={{ background: ACCENT }}>
                                    <span className="material-symbols-outlined text-white text-[24px]">{card.icon}</span>
                                </span>
                                <h3 className="mt-auto pt-12 text-white" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 26 }}>
                                    {card.title}
                                </h3>
                                <p className="mt-2" style={{ color: SUBTEXT, fontSize: 15, lineHeight: 1.55 }}>
                                    {card.body}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── 5. FEATURE ROWS ── */}
                <section id="features" className="mx-auto max-w-[1200px] px-5 sm:px-6 lg:px-12 py-12 md:py-20 space-y-12 md:space-y-28">
                    {FEATURE_ROWS.map((row) => (
                        <div key={row.title} className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                            <div className={row.side === 'right' ? 'lg:order-1' : 'lg:order-2'}>
                                <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 'clamp(28px, 3.5vw, 38px)', lineHeight: 1.1 }}>
                                    {row.title}
                                </h3>
                                <p className="mt-5 max-w-[460px]" style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55 }}>
                                    {row.body}
                                </p>
                                <Link
                                    to="/signup"
                                    onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: `feature_${row.title}` })}
                                    className="inline-flex items-center justify-center mt-7 h-11 px-6 rounded-lg text-sm font-bold ui-text transition-colors"
                                    style={{ background: ACCENT, color: '#fff' }}
                                >
                                    Try it Free
                                </Link>
                            </div>
                            <div className={row.side === 'right' ? 'lg:order-2' : 'lg:order-1'}>
                                <FeatureMockup kind={row.mockup} />
                            </div>
                        </div>
                    ))}
                </section>

                {/* ── 6. TRANSFORMING IMAGINATION ── */}
                <section className="mx-auto max-w-[1200px] px-6 lg:px-12 py-16 md:py-24">
                    <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 'clamp(34px, 4.5vw, 48px)', lineHeight: 1.1 }}>
                        Transforming Study<br />
                        into <span style={{ color: ACCENT }}>Reality</span>
                    </h2>
                    <p className="mt-5 max-w-[760px]" style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55 }}>
                        Unlock the full potential of your study time with ChewnPour. Explore new dimensions of
                        revision — from focused lessons to timeless craftsmanship — and witness how AI can turn
                        your hardest courses into mastered material.
                    </p>
                    <div className="transform-grid mt-10">
                        {TRANSFORM_CARDS.map((card, i) => {
                            const isHighlight = i === 0 || i === 3;
                            const span = i === 0 || i === 3 ? 2 : 3;
                            return (
                                <a
                                    key={card.title}
                                    href="#features"
                                    className="transform-card grain group relative overflow-hidden block"
                                    style={{ gridColumn: `span ${span}` }}
                                >
                                    <div
                                        className={`absolute inset-0 transition-opacity duration-500 ease-out ${
                                            isHighlight ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                        style={{ background: ACCENT, zIndex: 0 }}
                                    />
                                    <div className="relative z-[1] flex items-start justify-between gap-4">
                                        <p
                                            style={{
                                                color: 'rgb(217, 217, 217)',
                                                fontFamily: 'Outfit, sans-serif',
                                                fontSize: 16,
                                                fontWeight: 400,
                                                lineHeight: '19.2px',
                                                width: span === 2 ? 248 : 437,
                                                maxWidth: '100%',
                                            }}
                                        >
                                            {card.body}
                                        </p>
                                        <span
                                            className={`shrink-0 inline-flex items-center justify-center transition-colors duration-300 arrow-pill ${isHighlight ? 'is-highlight' : ''}`}
                                            style={{ width: 71, height: 71, borderRadius: 333 }}
                                        >
                                            <span className="material-symbols-outlined arrow-icon" style={{ fontSize: 34 }}>
                                                arrow_outward
                                            </span>
                                        </span>
                                    </div>
                                    <h4
                                        className="relative z-[1] text-white"
                                        style={{
                                            fontFamily: 'Outfit, sans-serif',
                                            fontWeight: 500,
                                            fontSize: 28,
                                            lineHeight: '33.6px',
                                            position: 'absolute',
                                            left: 20,
                                            right: 20,
                                            bottom: 20,
                                        }}
                                    >
                                        {card.title}
                                    </h4>
                                </a>
                            );
                        })}
                    </div>
                </section>

                {/* ── 7. PRICING ── */}
                <section id="pricing" className="mx-auto max-w-[1200px] px-6 lg:px-12 py-16 md:py-24">
                    <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 'clamp(34px, 4.5vw, 48px)', lineHeight: 1.1 }}>
                        Affordable Plans for <span style={{ color: ACCENT }}>Every Student</span>
                    </h2>
                    <p className="mt-5 max-w-[680px]" style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55 }}>
                        Choose the perfect plan for your studies, from first-year survival to final-year exams.
                        Pricing is in {starterPlan.currency || 'GHS'} and tuned for student budgets.
                    </p>

                    <div className="flex justify-center items-center gap-4 mt-10 mb-10">
                        <span className="ui-text text-sm font-semibold" style={{ color: billing === 'monthly' ? '#fff' : SUBTEXT }}>Monthly</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={billing === 'yearly'}
                            onClick={() => setBilling((b) => (b === 'monthly' ? 'yearly' : 'monthly'))}
                            className="relative inline-flex h-7 w-14 items-center rounded-full transition-colors"
                            style={{ background: ACCENT }}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${billing === 'yearly' ? 'translate-x-8' : 'translate-x-1'}`}
                            />
                        </button>
                        <span className="ui-text text-sm font-semibold" style={{ color: billing === 'yearly' ? '#fff' : SUBTEXT }}>Yearly</span>
                    </div>

                    <div className="grid gap-5 md:grid-cols-3 items-end">
                        {planCards.map((plan, idx) => {
                            const isFeatured = idx === 1;
                            const subColor = isFeatured ? 'rgba(255,255,255,0.85)' : SUBTEXT;
                            return (
                                <div
                                    key={plan.tier}
                                    className="grain rounded-[20px] p-7 flex flex-col"
                                    style={{
                                        background: isFeatured ? ACCENT : CARD_BG,
                                        marginTop: isFeatured ? -24 : 0,
                                        paddingTop: isFeatured ? 36 : 28,
                                        paddingBottom: isFeatured ? 36 : 28,
                                    }}
                                >
                                    <p className="ui-text font-semibold uppercase tracking-widest" style={{ color: subColor, fontSize: 13 }}>{plan.tier}</p>
                                    <div className="mt-3 flex items-baseline gap-1.5">
                                        <span className="text-white" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 48, lineHeight: 1 }}>{plan.price}</span>
                                        <span className="ui-text" style={{ color: subColor, fontSize: 16 }}>/{billing === 'yearly' ? 'yr' : 'm'}</span>
                                    </div>
                                    <p className="mt-2 ui-text" style={{ color: subColor, fontSize: 14 }}>{plan.suffix}</p>
                                    <div className="my-5 h-px" style={{ background: isFeatured ? 'rgba(255,255,255,0.25)' : 'rgba(217,217,217,0.15)' }} />
                                    <ul className="space-y-3 flex-1">
                                        {plan.features.map((f) => (
                                            <li key={f} className="flex items-start gap-2.5 text-white" style={{ fontSize: 14, fontFamily: 'Outfit, sans-serif' }}>
                                                <span className="material-symbols-outlined text-[18px] mt-[1px] flex-shrink-0" style={{ color: isFeatured ? '#fff' : ACCENT }}>check_circle</span>
                                                <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <Link
                                        to="/signup"
                                        onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: plan.ctaName })}
                                        className="mt-7 inline-flex items-center justify-center h-11 rounded-lg ui-text text-sm font-bold transition-colors"
                                        style={
                                            isFeatured
                                                ? { background: '#fff', color: '#0A0A0A' }
                                                : { background: 'transparent', color: ACCENT, border: `1px solid ${ACCENT}` }
                                        }
                                    >
                                        Get Started
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ── 8. SEAMLESS TOOL INTEGRATION ── */}
                <section className="mx-auto max-w-[1200px] px-6 lg:px-12 py-16 md:py-24">
                    <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 'clamp(34px, 4.5vw, 48px)', lineHeight: 1.1 }}>
                        Seamless Tool <span style={{ color: ACCENT }}>Integration</span>
                    </h2>
                    <p className="mt-5 max-w-[680px]" style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55 }}>
                        ChewnPour offers seamless integration with the materials and tools you already use, so your
                        existing study workflow keeps moving — just smarter.
                    </p>

                    <div className="mt-10 grain rounded-[16px] p-8 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 items-center" style={{ background: CARD_BG }}>
                        <div>
                            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 32, lineHeight: 1.1 }}>
                                Connect your<br />
                                <span style={{ color: ACCENT }}>study stack</span>
                            </h3>
                            <p className="mt-4 max-w-[360px]" style={{ color: SUBTEXT, fontSize: 15, lineHeight: 1.55 }}>
                                Works with the materials and tools you already use — slides, PDFs, scanned notes, and group chats.
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-y-6 gap-x-6 place-items-center">
                            {PARTNERS.slice(0, 9).map((p, i) => (
                                <span key={`int-${i}`} className="material-symbols-outlined text-white/85" style={{ fontSize: 44 }}>
                                    {p.icon}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 9. CUSTOMER SUCCESS STORIES ── */}
                <section className="mx-auto max-w-[1200px] px-6 lg:px-12 py-16 md:py-24">
                    <div className="flex items-end justify-between gap-6 flex-wrap">
                        <div className="max-w-[680px]">
                            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 'clamp(34px, 4.5vw, 48px)', lineHeight: 1.1 }}>
                                Student <span style={{ color: ACCENT }}>Success</span> Stories
                            </h2>
                            <p className="mt-5" style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55 }}>
                                Discover how ChewnPour has helped students master tough courses effortlessly.
                                Hear directly from people who actually use it.
                            </p>
                        </div>
                    </div>

                    <div className="mt-10 testimonials-viewport">
                        <div className="testimonials-track">
                            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                                <div key={`${t.name}-${i}`} className="grain testimonial-card" style={{ background: CARD_BG }}>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div
                                            className="rounded-full text-white flex items-center justify-center font-bold flex-shrink-0"
                                            style={{ background: ACCENT, fontFamily: 'Inter, sans-serif', fontSize: 22, width: 56, height: 56 }}
                                        >
                                            {t.name.charAt(0)}
                                        </div>
                                        <p className="text-white" style={{ fontSize: 22, fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                                            {t.name}
                                        </p>
                                    </div>
                                    <p style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55, fontFamily: 'Outfit, sans-serif' }}>
                                        “{t.quote}”
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 10. FAQ ── */}
                <section id="faq" className="mx-auto max-w-[1200px] px-6 lg:px-12 py-16 md:py-24">
                    <div className="grain rounded-[16px] p-8 md:p-12 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-16" style={{ background: CARD_BG }}>
                        <div>
                            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 'clamp(34px, 4.5vw, 48px)', lineHeight: 1.1 }}>
                                Frequently Asked<br />
                                <span style={{ color: ACCENT }}>Questions</span>
                            </h2>
                            <p className="mt-5 max-w-[420px]" style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55 }}>
                                Have questions about ChewnPour? Find answers to the most common ones and learn how
                                we help students study smarter.
                            </p>
                        </div>
                        <div>
                            {FAQS.map((item, i) => (
                                <FaqItem key={item.q} q={item.q} a={item.a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 11. BLOG ── */}
                <section className="mx-auto max-w-[1200px] px-6 lg:px-12 py-16 md:py-24">
                    <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 'clamp(34px, 4.5vw, 48px)', lineHeight: 1.1 }}>
                        Stay Inspired with Our<br />
                        Latest <span style={{ color: ACCENT }}>Insights</span>
                    </h2>
                    <p className="mt-5 max-w-[680px]" style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55 }}>
                        Dive into the ChewnPour blog for the latest study tips, revision tactics, and insights into how AI
                        is reshaping how students learn.
                    </p>

                    <div className="mt-10 grid gap-5 md:grid-cols-3">
                        {BLOG_POSTS.map((post) => (
                            <button
                                key={post.title}
                                type="button"
                                onClick={() => {
                                    setActivePost(post);
                                    captureLandingEvent('landing_blog_opened', { post_title: post.title });
                                }}
                                className="grain rounded-[16px] overflow-hidden text-left transition-transform hover:-translate-y-1"
                                style={{ background: CARD_BG }}
                            >
                                <div className="aspect-[5/3] relative">
                                    <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 60% 50%, ${post.tone} 0%, rgba(20,20,20,0.9) 75%)` }} />
                                    <div className="absolute inset-0 mix-blend-screen opacity-70" style={{ background: 'repeating-linear-gradient(120deg, rgba(255,255,255,0.18) 0 6px, transparent 6px 28px)', filter: 'blur(1px)' }} />
                                </div>
                                <div className="p-5">
                                    <div className="flex items-center justify-between ui-text" style={{ color: SUBTEXT, fontSize: 12 }}>
                                        <span>{post.date}</span>
                                        <span>{post.read}</span>
                                    </div>
                                    <h3 className="mt-3 text-white" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 18, lineHeight: 1.3 }}>
                                        {post.title}
                                    </h3>
                                    {post.excerpt && (
                                        <p className="mt-2" style={{ color: SUBTEXT, fontSize: 13, lineHeight: 1.5, fontFamily: 'Outfit, sans-serif' }}>
                                            {post.excerpt}
                                        </p>
                                    )}
                                    <span
                                        className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold"
                                        style={{ color: ACCENT, fontFamily: 'Inter, sans-serif' }}
                                    >
                                        Read article
                                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="mt-10 flex justify-center">
                        <button
                            type="button"
                            onClick={() => {
                                setActivePost(BLOG_POSTS[0]);
                                captureLandingEvent('landing_blog_opened', { post_title: BLOG_POSTS[0].title, source: 'read_more' });
                            }}
                            className="inline-flex items-center justify-center h-11 px-7 rounded-full text-white text-sm font-bold ui-text"
                            style={{ background: ACCENT }}
                        >
                            Read More
                        </button>
                    </div>
                </section>

                {/* ── 12. CTA BANNER ── */}
                <section className="flex justify-center px-3 pb-16">
                    <div
                        className="grain relative overflow-hidden border border-white/5"
                        style={{
                            background: CARD_BG,
                            width: '100%',
                            maxWidth: 1200,
                            height: 480,
                            borderRadius: 40,
                            paddingLeft: 40,
                        }}
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 items-center h-full pr-0">
                            <div className="py-10 lg:py-0">
                                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.05 }}>
                                    Start Your Study<br />
                                    <span style={{ color: ACCENT }}>Journey</span> Today
                                </h2>
                                <p className="mt-5 max-w-[480px]" style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55 }}>
                                    Sign up now and experience the power of AI-driven studying — no commitment, no
                                    credit card.
                                </p>
                                <Link
                                    to="/signup"
                                    onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'final_cta' })}
                                    className="inline-flex items-center justify-center mt-7 h-11 px-7 rounded-lg text-white text-sm font-bold ui-text"
                                    style={{ background: ACCENT }}
                                >
                                    Get Started Free
                                </Link>
                            </div>
                            <div className="relative h-full hidden lg:flex items-center justify-end overflow-hidden">
                                <PurpleSwirl className="cta-swirl" />
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* ── Blog post modal ── */}
            {activePost && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
                    style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
                    onClick={() => setActivePost(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="post-title"
                >
                    <div
                        className="grain relative w-full max-w-[760px] max-h-[88vh] overflow-y-auto rounded-[24px]"
                        style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.08)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Hero strip */}
                        <div className="aspect-[5/2] relative">
                            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 60% 50%, ${activePost.tone} 0%, rgba(20,20,20,0.9) 75%)` }} />
                            <div className="absolute inset-0 mix-blend-screen opacity-70" style={{ background: 'repeating-linear-gradient(120deg, rgba(255,255,255,0.18) 0 6px, transparent 6px 28px)', filter: 'blur(1px)' }} />
                            <button
                                type="button"
                                onClick={() => setActivePost(null)}
                                className="absolute top-4 right-4 inline-flex items-center justify-center w-10 h-10 rounded-full text-white"
                                style={{ background: 'rgba(0,0,0,0.55)' }}
                                aria-label="Close article"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        <article className="px-7 sm:px-10 py-8 sm:py-10">
                            <div className="flex items-center gap-3 ui-text" style={{ color: SUBTEXT, fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
                                <span>{activePost.date}</span>
                                <span aria-hidden="true">·</span>
                                <span>{activePost.read}</span>
                                {activePost.author && (
                                    <>
                                        <span aria-hidden="true">·</span>
                                        <span>{activePost.author}</span>
                                    </>
                                )}
                            </div>
                            <h2
                                id="post-title"
                                className="mt-3 text-white"
                                style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 'clamp(28px, 4vw, 36px)', lineHeight: 1.15, letterSpacing: '-0.02em' }}
                            >
                                {activePost.title}
                            </h2>
                            {activePost.excerpt && (
                                <p
                                    className="mt-4"
                                    style={{ color: 'rgba(255,255,255,0.78)', fontSize: 17, lineHeight: 1.55, fontFamily: 'Outfit, sans-serif' }}
                                >
                                    {activePost.excerpt}
                                </p>
                            )}

                            <div className="mt-8 space-y-5">
                                {activePost.body?.map((block, i) =>
                                    block.type === 'h2' ? (
                                        <h3
                                            key={i}
                                            className="text-white"
                                            style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 22, letterSpacing: '-0.02em', marginTop: 24 }}
                                        >
                                            {block.text}
                                        </h3>
                                    ) : (
                                        <p
                                            key={i}
                                            style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.65, fontFamily: 'Outfit, sans-serif' }}
                                        >
                                            {block.text}
                                        </p>
                                    )
                                )}
                            </div>

                            <div className="mt-10 pt-6 flex items-center justify-between gap-4 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <Link
                                    to="/signup"
                                    onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'blog_modal_signup' })}
                                    className="inline-flex items-center justify-center h-11 px-6 rounded-full text-white text-sm font-bold ui-text"
                                    style={{ background: ACCENT }}
                                >
                                    Try ChewnPour Free
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setActivePost(null)}
                                    className="text-sm font-semibold text-white/70 hover:text-white transition-colors ui-text"
                                >
                                    Close
                                </button>
                            </div>
                        </article>
                    </div>
                </div>
            )}

            {/* ── 13. FOOTER ── */}
            <footer id="contact" style={{ background: FOOTER_BG }}>
                <div className="mx-auto max-w-[1200px] px-6 lg:px-12 py-10">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <Link to="/" className="flex items-center gap-2.5 text-white">
                            <HexLogo size={28} />
                            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 20 }}>ChewnPour</span>
                        </Link>
                        <nav className="flex flex-wrap items-center gap-6 ui-text text-sm">
                            {FOOTER_NAV.map((label, i) => (
                                <a key={label} href={['#how', '#features', '#pricing', '#', '#faq', '#contact'][i]} className="text-white hover:opacity-80 transition-opacity">
                                    {label}
                                </a>
                            ))}
                        </nav>
                    </div>
                    <div className="mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 ui-text text-xs" style={{ borderTop: '1px solid rgba(217,217,217,0.12)', color: SUBTEXT }}>
                        <p>Copyright 2026 © ChewnPour, Inc.</p>
                        <div className="flex items-center gap-5">
                            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                            <Link to="/terms" className="hover:text-white transition-colors">Terms &amp; Conditions</Link>
                            <a href="https://t.me/+jIHi6XFYdl9kNDA0" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Telegram</a>
                        </div>
                    </div>
                </div>
            </footer>

        </div>
    );
};

export default LandingPage;
