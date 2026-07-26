import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { capturePostHogEvent } from '../lib/posthog';
import { formatPlanPrice, normalizeTopUpOptions } from '../lib/pricingCurrency';
import BrandLogo from '../components/BrandLogo';
import AppIcon from '../components/AppIcon';

/**
 * Landing page — Slate redesign (light Apple Notes aesthetic).
 * ChewnPour copy + Free/Basic/Pro GHS pricing + auth/PostHog wiring.
 */

const BLUE = '#007AFF';
const INK = '#0A0A0A';
const PAGE = '#F9F9F9';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'Faq' },
  { href: '#how', label: 'Setup' },
];

const FEATURE_CARDS = [
  {
    icon: 'bolt',
    title: 'Quick Capture',
    body: 'Drop lecture PDFs, slides, or notes and start studying in minutes — no friction, no setup maze.',
  },
  {
    icon: 'auto_awesome',
    title: 'AI Across All Materials',
    body: 'Ask questions grounded in your uploads — not the open web. “What did the lecturer emphasise in week 3?”',
  },
  {
    icon: 'edit_note',
    title: 'Structured Lessons',
    body: 'Definitions, mechanisms, and worked examples laid out the way a great tutor would explain them.',
  },
];

const FEATURE_PREVIEWS = [
  {
    icon: 'folder',
    title: 'Courses & Topics',
    body: 'Organise every upload into courses with nested topics, tags, and progress you can resume anytime.',
  },
  {
    icon: 'sync',
    title: 'Always in Sync',
    body: 'Your materials, lessons, and quiz progress stay available across sessions — pick up where you left off.',
  },
  {
    icon: 'search',
    title: 'Search Your Syllabus',
    body: 'Find a concept, open the lesson, jump into a quiz, or ask the tutor — all from one search.',
  },
];

const WORKFLOW_TABS = [
  {
    id: 'model',
    label: 'Select your model',
    title: 'Pick Your Focus',
    body: 'Choose lesson depth, quiz intensity, or tutor chat. ChewnPour adapts explanations to how you revise — not the other way around.',
  },
  {
    id: 'capture',
    label: 'Upload Content',
    title: 'Capture Your Syllabus',
    body: 'Upload PDFs, decks, and scanned notes. We extract the structure, key concepts, and exam-shaped questions automatically.',
  },
  {
    id: 'answers',
    label: 'Get Intelligent Answers',
    title: 'Ask Across Everything',
    body: 'The AI tutor reads your materials and connects the dots — summarise, re-explain, or generate a quiz on the weak spots.',
  },
];

const AI_FEATURES = [
  { icon: 'forum', title: 'Ask', body: 'Ask anything and get answers grounded in your notes, files, and course materials.' },
  { icon: 'link', title: 'Link', body: 'Create a connected study system where every lesson adds context for the next.' },
  { icon: 'style', title: 'Save', body: 'Capture insights the moment they appear — pin weak topics and revisit them.' },
  { icon: 'upload', title: 'Upload', body: 'Import documents, images, and PDFs from wherever your material already lives.' },
];

const STEPS = [
  {
    step: '01',
    title: 'Upload and sign in',
    body: 'Create a free account and drop in a lecture PDF or slide deck. Your first structured lesson set is minutes away.',
  },
  {
    step: '02',
    title: 'Study generated lessons',
    body: 'Read clean lessons with definitions, examples, and check-ins. Organise into courses and track what stuck.',
  },
  {
    step: '03',
    title: 'Ask the AI anything',
    body: 'Open the tutor, request a re-explain or worked example, then jump straight into a quiz on the same topic.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Akosua M.',
    role: 'Medical student',
    quote:
      'ChewnPour completely transformed how I approach exams. It feels like a personal tutor on call — lessons, quizzes, and follow-ups in one place.',
  },
  {
    name: 'Kwame B.',
    role: 'Engineering student',
    quote:
      'The lesson breakdowns are spot on and the quizzes save me so much time. I focus on understanding instead of drowning in slides.',
  },
  {
    name: 'Efua O.',
    role: 'Law student',
    quote:
      'Incredibly intuitive. Upload, study, quiz, ask. I cannot imagine revising without it now.',
  },
];

const FAQS = [
  {
    q: 'How does the AI generate lessons?',
    a: 'Our model reads your uploads the way a tutor would, extracting key concepts, definitions, and worked examples, then rewrites them as a structured lesson with quizzes built in.',
  },
  {
    q: 'Can I customize the AI-generated lessons?',
    a: 'Yes. You can re-explain, change tone, dive deeper into any section, or generate quizzes focused on a specific subtopic.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes. You get free uploads with access to AI lessons, quizzes, the AI tutor, and progress tracking before deciding to upgrade.',
  },
  {
    q: 'How secure is my data?',
    a: 'Your uploads are stored securely and only used to generate your own lessons. We never sell your data or use it to train public models.',
  },
  {
    q: 'What file types work?',
    a: 'ChewnPour works with PDFs, slide decks, scanned notes, and group-chat exports — wherever your study material lives.',
  },
];

const COMPARISON_ROWS = [
  { feature: 'Uploads', free: '3 / month', basic: 'Starter pack', pro: 'Higher volume' },
  { feature: 'AI lessons', free: 'Included', basic: 'Advanced', pro: 'Full suite' },
  { feature: 'AI tutor', free: 'Included', basic: 'Included', pro: 'Priority' },
  { feature: 'Quizzes', free: 'Standard', basic: 'Premium', pro: 'Custom plans' },
  { feature: 'Progress tracking', free: 'Basic', basic: 'Real-time', pro: 'Advanced analytics' },
  { feature: 'Support', free: 'Community', basic: 'Email', pro: '24/7 priority' },
];

const PillLink = ({ to, onClick, children, className = '' }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`inline-flex items-center justify-center rounded-full bg-[#111] px-6 py-3 text-sm font-semibold text-white transition hover:bg-black ${className}`}
  >
    {children}
  </Link>
);

const SoftButton = ({ children, className = '', ...props }) => (
  <button
    type="button"
    className={`inline-flex items-center justify-center rounded-full border border-[#E5E5EA] bg-white px-5 py-2.5 text-sm font-semibold text-[#0A0A0A] shadow-sm transition hover:bg-[#F9F9F9] ${className}`}
    {...props}
  >
    {children}
  </button>
);

const CheckIcon = () => (
  <span
    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-white"
    style={{ background: BLUE }}
    aria-hidden="true"
  >
    <AppIcon name="check" className="text-[14px]" />
  </span>
);

const BlueIconTile = ({ name }) => (
  <span
    className="inline-flex size-11 items-center justify-center rounded-2xl text-white"
    style={{ background: BLUE }}
    aria-hidden="true"
  >
    <AppIcon name={name} className="text-[22px]" />
  </span>
);

const LandingPageStyles = () => (
  <style>{`
    .slate-root {
      font-family: "Plus Jakarta Sans", system-ui, sans-serif;
      color: ${INK};
      background: ${PAGE};
    }
    .slate-hero-bg {
      background:
        radial-gradient(ellipse 70% 55% at 15% 40%, rgba(147, 197, 253, 0.22), transparent 55%),
        radial-gradient(ellipse 60% 50% at 88% 55%, rgba(191, 219, 254, 0.28), transparent 50%),
        linear-gradient(180deg, #FFFFFF 0%, #F7FAFF 48%, #F3F7FC 100%);
    }
    .slate-float {
      animation: slateFloat 7s ease-in-out infinite;
    }
    .slate-float-delay {
      animation: slateFloat 8.5s ease-in-out infinite;
      animation-delay: -2s;
    }
    .slate-float-slow {
      animation: slateFloat 11s ease-in-out infinite;
      animation-delay: -4s;
    }
    @keyframes slateFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .slate-float, .slate-float-delay, .slate-float-slow { animation: none; }
    }
  `}</style>
);

const LinedNotebookPaper = ({ className = '', style, holes = 'left', tape = false }) => (
  <div
    className={`pointer-events-none ${className}`}
    style={style}
    aria-hidden="true"
  >
    <div className="relative h-full w-full overflow-hidden rounded-sm bg-white/90 shadow-[0_18px_40px_rgba(59,130,246,0.12)]">
      {/* horizontal ruled lines */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 21px, rgba(147,197,253,0.45) 21px, rgba(147,197,253,0.45) 22px)',
          backgroundPosition: '0 28px',
        }}
      />
      {/* red margin line */}
      <div
        className="absolute top-0 bottom-0 w-px"
        style={{ left: holes === 'left' ? 28 : undefined, right: holes === 'right' ? 28 : undefined, background: 'rgba(248,113,113,0.35)' }}
      />
      {/* spiral binder holes */}
      <div className={`absolute top-3 bottom-3 flex flex-col justify-between ${holes === 'left' ? 'left-2' : 'right-2'}`}>
        {Array.from({ length: 9 }).map((_, i) => (
          <span
            key={`hole-${i}`}
            className="size-2.5 rounded-full border border-[#BFDBFE] bg-[#EFF6FF]/90 shadow-[inset_0_0_0_1px_rgba(147,197,253,0.35)]"
          />
        ))}
      </div>
      {tape && (
        <span
          className="absolute -top-2 right-5 h-5 w-12 rotate-6 rounded-[2px]"
          style={{ background: 'rgba(147,197,253,0.45)', boxShadow: '0 1px 2px rgba(59,130,246,0.15)' }}
        />
      )}
    </div>
  </div>
);

const HeroDecor = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    {/* soft ambient washes */}
    <div className="absolute -left-24 top-24 h-[420px] w-[420px] rounded-full bg-[#DBEAFE]/50 blur-3xl" />
    <div className="absolute -right-16 top-40 h-[380px] w-[380px] rounded-full bg-[#BFDBFE]/45 blur-3xl" />

    {/* faint document silhouette outlines */}
    <svg className="absolute right-[8%] top-16 hidden h-40 w-32 opacity-40 lg:block" viewBox="0 0 120 150" fill="none">
      <path d="M18 18h58l26 26v88H18V18z" stroke="#93C5FD" strokeWidth="2.5" />
      <path d="M76 18v26h26" stroke="#93C5FD" strokeWidth="2.5" />
      <path d="M34 70h52M34 88h40M34 106h46" stroke="#BFDBFE" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <svg className="absolute left-[12%] top-10 hidden h-28 w-24 opacity-30 lg:block" viewBox="0 0 100 120" fill="none">
      <rect x="12" y="16" width="76" height="88" rx="6" stroke="#93C5FD" strokeWidth="2.5" />
      <path d="M28 40h44M28 56h32M28 72h38" stroke="#BFDBFE" strokeWidth="2" strokeLinecap="round" />
    </svg>

    {/* left ruled notebook sheet — peeks behind the mockup */}
    <div className="slate-float absolute left-[2%] top-[48%] z-0 hidden h-[380px] w-[230px] lg:block xl:left-[6%]">
      <LinedNotebookPaper
        holes="left"
        className="relative inset-auto h-full w-full"
        style={{ transform: 'rotate(-11deg)' }}
      />
    </div>

    {/* right ruled notebook sheet with tape */}
    <div className="slate-float-delay absolute right-[2%] top-[52%] z-0 hidden h-[340px] w-[210px] lg:block xl:right-[6%]">
      <LinedNotebookPaper
        holes="right"
        tape
        className="relative inset-auto h-full w-full"
        style={{ transform: 'rotate(8deg)' }}
      />
    </div>

    {/* floating blue confetti / post-it rectangles */}
    <span className="slate-float absolute left-[18%] top-[22%] hidden size-3 rounded-[3px] bg-[#93C5FD]/70 lg:block" />
    <span className="slate-float-delay absolute left-[8%] top-[58%] hidden size-4 rounded-[4px] bg-[#BFDBFE]/80 lg:block" />
    <span className="slate-float-slow absolute left-[22%] top-[72%] hidden h-5 w-3 rounded-[3px] bg-[#93C5FD]/55 blur-[1px] lg:block" />
    <span className="slate-float absolute right-[20%] top-[24%] hidden size-3.5 rounded-[3px] bg-[#93C5FD]/75 lg:block" />
    <span className="slate-float-delay absolute right-[12%] top-[66%] hidden h-4 w-6 rounded-[4px] bg-[#BFDBFE]/70 lg:block" />
    <span className="slate-float-slow absolute right-[28%] top-[48%] hidden size-2.5 rounded-[2px] bg-[#60A5FA]/50 lg:block" />
    <span className="slate-float absolute left-[48%] top-[18%] hidden size-2 rounded-[2px] bg-[#93C5FD]/60 lg:block" />
    <span className="slate-float-delay absolute right-[42%] top-[78%] hidden size-3 rounded-[3px] bg-[#BFDBFE]/65 blur-[0.5px] lg:block" />
  </div>
);

const LandingHeader = ({ captureLandingEvent, mobileMenuOpen, onToggleMobileMenu, onCloseMobileMenu }) => (
  <header className="sticky top-0 z-40 border-b border-[#E5E5EA]/80 bg-white/90 backdrop-blur-md">
    <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-5 sm:px-6">
      <Link to="/" className="flex items-center gap-2" aria-label="ChewnPour home">
        <BrandLogo size={28} decorative />
      </Link>
      <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href} className="text-sm font-medium text-[#6B6B70] transition hover:text-[#0A0A0A]">
            {link.label}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Link
          to="/login"
          onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'nav_login' })}
          className="hidden text-sm font-semibold text-[#0A0A0A] sm:inline"
        >
          Log in
        </Link>
        <PillLink
          to="/signup"
          onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'nav_get_started' })}
          className="!px-4 !py-2.5 text-[13px]"
        >
          Get Started
        </PillLink>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full md:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          onClick={onToggleMobileMenu}
        >
          <AppIcon name={mobileMenuOpen ? 'close' : 'menu'} />
        </button>
      </div>
    </div>
    {mobileMenuOpen && (
      <div className="border-t border-[#E5E5EA] bg-white px-5 py-4 md:hidden">
        <nav className="flex flex-col gap-3" aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={onCloseMobileMenu}
              className="py-2 text-sm font-medium text-[#0A0A0A]"
            >
              {link.label}
            </a>
          ))}
          <Link to="/login" onClick={onCloseMobileMenu} className="py-2 text-sm font-semibold">
            Log in
          </Link>
        </nav>
      </div>
    )}
  </header>
);

const HeroSection = ({ captureLandingEvent }) => (
  <section className="slate-hero-bg relative overflow-hidden px-5 pb-16 pt-14 sm:px-6 sm:pt-20">
    <HeroDecor />

    <div className="relative z-10 mx-auto max-w-[1120px]">
      <div className="max-w-2xl">
        <span className="inline-flex items-center rounded-full bg-[#F2F2F7] px-3 py-1 text-xs font-semibold text-[#6B6B70]">
          Built in Academic intelligence
        </span>
        <h1 className="mt-5 text-[clamp(2.4rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#0A0A0A]">
          AI that studies with you
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#6B6B70]">
          Upload naturally. Ask anything. ChewnPour turns your lecture slides and PDFs into lessons, quizzes, and a tutor that actually knows your material.
        </p>
        <PillLink
          to="/signup"
          onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'hero_start_free' })}
          className="mt-8"
        >
          Start your free trial
        </PillLink>
      </div>

      {/* Sized like the Slate screenshot — ~72% width so notebook papers show on both sides */}
      <div className="relative z-10 mx-auto mt-14 w-full max-w-[820px] lg:mt-16">
        <div className="overflow-hidden rounded-[20px] border border-[#E5E5EA] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.10)]">
          <div className="flex items-center gap-2 border-b border-[#E5E5EA] bg-[#F9F9F9] px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-[#FF5F57]" />
            <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="size-2.5 rounded-full bg-[#28C840]" />
            <span className="ml-3 text-xs font-medium text-[#8E8E93]">ChewnPour Study Workspace</span>
          </div>
          <picture>
            <source srcSet="/redesign/product-mockup.avif" type="image/avif" />
            <img
              src="/redesign/product-mockup.jpg"
              alt="ChewnPour study workspace with courses, notes, and lesson detail"
              className="block w-full"
              width={1600}
              height={1000}
            />
          </picture>
        </div>
      </div>
    </div>
  </section>
);

const IntroBridge = () => (
  <section className="mx-auto max-w-[760px] px-5 py-16 text-center sm:px-6 sm:py-20">
    <p className="text-[17px] leading-relaxed text-[#6B6B70] sm:text-[18px]">
      Information is everywhere. Notes, files, and lectures live across different tools.
    </p>
    <p className="mt-3 text-[20px] font-bold tracking-[-0.02em] text-[#0A0A0A] sm:text-[22px]">
      ChewnPour brings everything together into one intelligent study workspace.
    </p>
  </section>
);

const PreviewSidebar = () => (
  <div className="mx-auto w-[88%] rounded-t-2xl border border-b-0 border-[#E5E5EA] bg-white shadow-sm">
    <div className="flex items-center gap-1.5 border-b border-[#E5E5EA] bg-[#F9F9F9] px-3 py-2">
      <span className="size-1.5 rounded-full bg-[#FF5F57]" />
      <span className="size-1.5 rounded-full bg-[#FEBC2E]" />
      <span className="size-1.5 rounded-full bg-[#28C840]" />
      <span className="ml-1 text-[10px] font-semibold text-[#8E8E93]">Courses</span>
    </div>
    <div className="space-y-1.5 px-3 py-3">
      <div className="flex items-center gap-2 rounded-lg bg-[#E5F0FF] px-2 py-1.5 text-[11px] font-semibold text-[#0A0A0A]">
        <AppIcon name="star" className="text-[12px] text-[#FF9F0A]" />
        Pinned
        <span className="ml-auto text-[#8E8E93]">3</span>
      </div>
      {[
        ['folder', 'Psychology 101', '12'],
        ['folder', 'Organic Chem', '8'],
        ['description', 'Exam prep', '5'],
      ].map(([icon, label, count]) => (
        <div key={label} className="flex items-center gap-2 px-2 py-1 text-[11px] text-[#6B6B70]">
          <AppIcon name={icon} className="text-[12px]" style={{ color: BLUE }} />
          {label}
          <span className="ml-auto">{count}</span>
        </div>
      ))}
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#F2F2F7] px-2 py-1.5 text-[10px] text-[#8E8E93]">
        <AppIcon name="search" className="text-[12px]" />
        Search courses…
      </div>
    </div>
  </div>
);

const PreviewSync = () => (
  <div className="mx-auto flex w-[78%] flex-col items-center rounded-2xl border border-[#E5E5EA] bg-white px-4 py-5 shadow-sm">
    <span className="inline-flex size-10 items-center justify-center rounded-full text-white" style={{ background: BLUE }}>
      <AppIcon name="check" className="text-[20px]" />
    </span>
    <p className="mt-3 text-[12px] font-bold text-[#0A0A0A]">ChewnPour Sync</p>
    <p className="mt-1 text-center text-[10px] leading-snug text-[#6B6B70]">
      Lessons and quizzes are up to date across your devices.
    </p>
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#F2F2F7]">
      <div className="h-full w-[92%] rounded-full" style={{ background: BLUE }} />
    </div>
  </div>
);

const PreviewEditor = () => (
  <div className="mx-auto w-[90%] rounded-t-2xl border border-b-0 border-[#E5E5EA] bg-white shadow-sm">
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[#E5E5EA] px-3 py-2">
      <span className="rounded-full bg-[#F2F2F7] px-2 py-0.5 text-[10px] font-semibold text-[#0A0A0A]">Save as lesson</span>
      <span className="rounded-full bg-[#F2F2F7] px-2 py-0.5 text-[10px] font-semibold text-[#0A0A0A]">Copy</span>
      <span className="ml-auto inline-flex size-5 items-center justify-center rounded-full text-white" style={{ background: BLUE }}>
        <AppIcon name="auto_awesome" className="text-[11px]" />
      </span>
    </div>
    <div className="space-y-2 px-3 py-3">
      <p className="text-[11px] font-bold text-[#0A0A0A]">Working memory</p>
      <p className="text-[10px] leading-relaxed text-[#6B6B70]">
        Short-term store that holds information while you process it during study.
      </p>
      <div className="flex flex-wrap gap-1">
        <span className="rounded bg-[#E5F0FF] px-1.5 py-0.5 text-[9px] font-semibold" style={{ color: BLUE }}>definition</span>
        <span className="rounded bg-[#F2F2F7] px-1.5 py-0.5 text-[9px] font-semibold text-[#6B6B70]">example</span>
      </div>
    </div>
  </div>
);

const FEATURE_PREVIEW_VISUALS = {
  'Courses & Topics': PreviewSidebar,
  'Always in Sync': PreviewSync,
  'Search Your Syllabus': PreviewEditor,
};

const FeaturesSection = () => (
  <section id="features" className="mx-auto max-w-[1080px] px-5 py-8 sm:px-6 sm:py-14">
    <div className="mx-auto max-w-[560px] text-center">
      <h2 className="text-[clamp(1.75rem,3vw,2.25rem)] font-bold tracking-[-0.02em] text-[#0A0A0A]">
        Smart features for everyday study
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-[#6B6B70]">
        Everything you need to capture, organise, and master your materials — beautifully simple.
      </p>
    </div>

    <div className="mt-10 grid gap-5 md:grid-cols-3">
      {FEATURE_CARDS.map((card) => (
        <article
          key={card.title}
          className="rounded-[22px] border border-[#ECECF0] bg-white p-7 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
        >
          <BlueIconTile name={card.icon} />
          <h3 className="mt-5 text-[17px] font-bold tracking-[-0.01em] text-[#0A0A0A]">{card.title}</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6B6B70]">{card.body}</p>
        </article>
      ))}
    </div>

    <div className="mt-5 grid gap-5 md:grid-cols-3">
      {FEATURE_PREVIEWS.map((card) => {
        const Visual = FEATURE_PREVIEW_VISUALS[card.title] || PreviewSidebar;
        return (
          <article
            key={card.title}
            className="overflow-hidden rounded-[22px] border border-[#ECECF0] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
          >
            <div className="relative h-[168px] overflow-hidden bg-[#EEF3F8] pt-6">
              <div className="absolute inset-x-0 bottom-0 translate-y-2">
                <Visual />
              </div>
            </div>
            <div className="px-7 pb-7 pt-5">
              <AppIcon name={card.icon} className="text-[26px]" style={{ color: BLUE }} aria-hidden="true" />
              <h3 className="mt-3 text-[17px] font-bold tracking-[-0.01em] text-[#0A0A0A]">{card.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#6B6B70]">{card.body}</p>
            </div>
          </article>
        );
      })}
    </div>
  </section>
);

const WorkflowSection = ({ activeTab, onTabChange }) => {
  const active = WORKFLOW_TABS.find((tab) => tab.id === activeTab) || WORKFLOW_TABS[0];
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">From idea to action in seconds.</h2>
        <p className="mt-4 text-[#6B6B70]">
          Choose how you want to work. ChewnPour adapts to your workflow, not the other way around.
        </p>
      </div>

      <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-2 rounded-full bg-[#F2F2F7] p-1.5 sm:flex-row">
        {WORKFLOW_TABS.map((tab) => {
          const isActive = tab.id === active.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
                isActive ? 'bg-white text-[#0A0A0A] shadow-sm' : 'text-[#6B6B70] hover:text-[#0A0A0A]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid items-center gap-8 rounded-[28px] border border-[#E5E5EA] bg-white p-6 shadow-sm md:grid-cols-2 md:p-10">
        <div>
          <AppIcon name="auto_awesome" className="text-[28px]" style={{ color: BLUE }} aria-hidden="true" />
          <h3 className="mt-4 text-2xl font-bold tracking-[-0.02em]">{active.title}</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-[#6B6B70]">{active.body}</p>
        </div>
        <div className="rounded-[20px] border border-[#E5E5EA] bg-[#F9F9F9] p-5">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm leading-relaxed text-[#0A0A0A]">
              Summarise chapter 4 and generate five exam-style questions from my uploaded slides.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#F2F2F7] px-3 py-1 text-xs font-medium text-[#6B6B70]">lecture.pdf</span>
              <span className="rounded-full bg-[#F2F2F7] px-3 py-1 text-xs font-medium text-[#6B6B70]">notes.png</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-full border border-[#E5E5EA] bg-white px-3 py-2">
            <span className="flex-1 text-sm text-[#8E8E93]">Ask across your materials…</span>
            <span className="inline-flex size-8 items-center justify-center rounded-full text-white" style={{ background: BLUE }}>
              <AppIcon name="arrow_upward" className="text-[18px]" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

const AiSection = () => (
  <section className="mx-auto max-w-[1120px] px-5 py-10 sm:px-6 sm:py-16">
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">AI that reads your materials</h2>
      <p className="mt-4 text-[#6B6B70]">
        Not a generic chatbot. ChewnPour’s AI reads across every upload you’ve made and connects the dots for you.
      </p>
    </div>

    <div className="mt-12 overflow-hidden rounded-[24px] border border-[#E5E5EA] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2 border-b border-[#E5E5EA] bg-[#F9F9F9] px-4 py-3">
        <span className="size-3 rounded-full bg-[#FF5F57]" />
        <span className="size-3 rounded-full bg-[#FEBC2E]" />
        <span className="size-3 rounded-full bg-[#28C840]" />
      </div>
      <picture>
        <source srcSet="/redesign/product-mockup.avif" type="image/avif" />
        <img
          src="/redesign/product-mockup.jpg"
          alt="AI panel reading across study materials"
          className="block max-h-[520px] w-full object-cover object-top"
        />
      </picture>
    </div>

    <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {AI_FEATURES.map((item) => (
        <div key={item.title}>
          <BlueIconTile name={item.icon} />
          <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#6B6B70]">{item.body}</p>
        </div>
      ))}
    </div>
  </section>
);

const HowSection = ({ captureLandingEvent }) => (
  <section id="how" className="mx-auto max-w-[1120px] px-5 py-16 sm:px-6 sm:py-24">
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">Up and running in three steps</h2>
      <p className="mt-4 text-[#6B6B70]">From signup to first AI-powered lesson in under two minutes.</p>
    </div>

    <div className="relative mt-14 space-y-10">
      <div
        className="absolute bottom-8 left-[11px] top-8 hidden w-0.5 md:block"
        style={{ background: BLUE }}
        aria-hidden="true"
      />
      {STEPS.map((step) => (
        <div key={step.step} className="grid items-center gap-6 md:grid-cols-[24px_1.1fr_0.9fr] md:gap-8">
          <div className="relative z-10 hidden md:block">
            <span className="block h-0.5 w-6" style={{ background: BLUE }} />
          </div>
          <div className="rounded-[24px] bg-[#F2F2F7] p-6 sm:p-8">
            <div className="rounded-2xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: BLUE }}>
                Step {step.step}
              </p>
              <p className="mt-3 text-base font-bold">{step.title}</p>
              <div className="mt-4 space-y-2">
                <div className="h-2 w-full rounded bg-[#F2F2F7]" />
                <div className="h-2 w-5/6 rounded bg-[#F2F2F7]" />
                <div className="h-2 w-2/3 rounded bg-[#F2F2F7]" />
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide md:hidden" style={{ color: BLUE }}>
              Step {step.step}
            </p>
            <h3 className="text-xl font-bold tracking-[-0.02em]">{step.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#6B6B70]">{step.body}</p>
            <SoftButton
              className="mt-5"
              onClick={() => {
                captureLandingEvent('landing_cta_clicked', { cta_name: `how_step_${step.step}` });
                window.location.assign('/signup');
              }}
            >
              Know more
            </SoftButton>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const PricingSection = ({
  billing,
  onBillingChange,
  planCards,
  captureLandingEvent,
}) => (
  <section id="pricing" className="mx-auto max-w-[1120px] px-5 py-16 sm:px-6 sm:py-24">
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">Honest pricing, no dark patterns</h2>
      <p className="mt-4 text-[#6B6B70]">
        No hidden limits, no sudden paywalls mid-sentence. Start free, upgrade when it clicks.
      </p>
      <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-[#F2F2F7] p-1">
        <button
          type="button"
          onClick={() => onBillingChange('monthly')}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${billing === 'monthly' ? 'bg-white shadow-sm' : 'text-[#6B6B70]'}`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onBillingChange('yearly')}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${billing === 'yearly' ? 'bg-white shadow-sm' : 'text-[#6B6B70]'}`}
        >
          Billed yearly
        </button>
      </div>
    </div>

    <div className="mt-12 grid gap-5 lg:grid-cols-3">
      {planCards.map((plan) => (
        <article
          key={plan.tier}
          className={`relative flex flex-col rounded-[24px] border bg-white p-7 shadow-sm ${
            plan.popular ? 'border-[#0A0A0A]' : 'border-[#E5E5EA]'
          }`}
        >
          {plan.popular && (
            <span className="absolute right-5 top-5 rounded-full bg-[#F2F2F7] px-3 py-1 text-xs font-semibold">
              Most Popular
            </span>
          )}
          <div className="flex items-center gap-2">
            <AppIcon name={plan.icon} className="text-[22px]" style={{ color: BLUE }} aria-hidden="true" />
            <h3 className="text-lg font-bold">{plan.tier}</h3>
          </div>
          <p className="mt-5 text-4xl font-extrabold tracking-[-0.03em]">
            {plan.price}
            <span className="ml-1 text-sm font-semibold text-[#6B6B70]">/ {plan.suffix}</span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[#6B6B70]">{plan.description}</p>
          <ul className="mt-6 flex-1 space-y-3">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-[#0A0A0A]">
                <CheckIcon />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <PillLink
            to="/signup"
            onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: plan.ctaName })}
            className="mt-8 w-full"
          >
            {plan.ctaLabel}
          </PillLink>
        </article>
      ))}
    </div>

    <div className="mt-12 overflow-hidden rounded-[24px] border border-[#E5E5EA] bg-white shadow-sm">
      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 border-b border-[#E5E5EA] px-5 py-4 text-sm font-bold sm:px-8">
        <span>Feature Comparison</span>
        <span className="text-center">Free</span>
        <span className="text-center">Basic</span>
        <span className="text-center">Pro</span>
      </div>
      {COMPARISON_ROWS.map((row, index) => (
        <div
          key={row.feature}
          className={`grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 px-5 py-3.5 text-sm sm:px-8 ${
            index % 2 === 0 ? 'bg-[#F9F9F9]' : 'bg-white'
          }`}
        >
          <span className="font-semibold">{row.feature}</span>
          <span className="text-center text-[#6B6B70]">{row.free}</span>
          <span className="text-center text-[#6B6B70]">{row.basic}</span>
          <span className="text-center text-[#6B6B70]">{row.pro}</span>
        </div>
      ))}
    </div>
  </section>
);

const TestimonialsSection = ({ index, onPrev, onNext }) => {
  const item = TESTIMONIALS[index] || TESTIMONIALS[0];
  return (
    <section className="bg-[#F2F2F7] px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[720px] text-center">
        <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">What people actually say</h2>
        <p className="mt-4 text-[#6B6B70]">
          From students to founders — ChewnPour fits the way real people revise.
        </p>
        <article className="mt-10 rounded-[24px] border border-[#E5E5EA] bg-white p-8 text-left shadow-sm sm:p-10">
          <div className="flex items-center gap-3">
            <div
              className="flex size-12 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: BLUE }}
            >
              {item.name.slice(0, 1)}
            </div>
            <div>
              <p className="font-bold">{item.name}</p>
              <p className="text-sm text-[#6B6B70]">{item.role}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-1" aria-label="5 star rating">
            {Array.from({ length: 5 }).map((_, i) => (
              <AppIcon key={`star-${item.name}-${i}`} name="star" className="text-[20px] text-[#FF9F0A]" />
            ))}
          </div>
          <p className="mt-5 text-[17px] leading-relaxed text-[#0A0A0A]">“{item.quote}”</p>
        </article>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous testimonial"
            className="inline-flex size-11 items-center justify-center rounded-full border border-[#E5E5EA] bg-white shadow-sm"
          >
            <AppIcon name="chevron_left" />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next testimonial"
            className="inline-flex size-11 items-center justify-center rounded-full border border-[#E5E5EA] bg-white shadow-sm"
          >
            <AppIcon name="chevron_right" />
          </button>
        </div>
      </div>
    </section>
  );
};

const FaqSection = ({ openFaq, onToggleFaq }) => (
  <section id="faq" className="mx-auto grid max-w-[1120px] gap-10 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.9fr_1.1fr]">
    <div>
      <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">Frequently asked questions</h2>
      <p className="mt-4 text-[#6B6B70]">
        Still have questions? Reach out to us at{' '}
        <a href="mailto:info@chewnpour.com" className="font-semibold text-[#0A0A0A] underline-offset-2 hover:underline">
          info@chewnpour.com
        </a>
      </p>
    </div>
    <div className="space-y-3">
      {FAQS.map((item, index) => {
        const open = openFaq === index;
        return (
          <div key={item.q} className="rounded-[18px] border border-[#E5E5EA] bg-white shadow-sm">
            <button
              type="button"
              onClick={() => onToggleFaq(index)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-[15px] font-semibold text-[#0A0A0A]">{item.q}</span>
              <AppIcon name={open ? 'close' : 'add'} className="shrink-0 text-[#6B6B70]" />
            </button>
            <div className={`grid transition-all ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm leading-relaxed text-[#6B6B70]">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

const CtaSection = ({ captureLandingEvent }) => (
  <section className="px-5 pb-16 sm:px-6 sm:pb-24">
    <div className="relative mx-auto max-w-[1120px] overflow-hidden rounded-[28px] border border-[#E5E5EA] bg-white px-6 py-16 text-center shadow-sm sm:px-12 sm:py-20">
      <div className="pointer-events-none absolute inset-0 slate-paper opacity-50" aria-hidden="true" />
      <div className="slate-float pointer-events-none absolute left-10 top-10 hidden size-12 items-center justify-center rounded-2xl bg-[#E5F0FF] sm:flex" aria-hidden="true">
        <AppIcon name="edit" style={{ color: BLUE }} />
      </div>
      <div className="slate-float-delay pointer-events-none absolute bottom-10 right-10 hidden size-12 items-center justify-center rounded-2xl bg-[#E5F0FF] sm:flex" aria-hidden="true">
        <AppIcon name="link" style={{ color: BLUE }} />
      </div>
      <div className="relative">
        <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">Your second brain, already written</h2>
        <p className="mx-auto mt-4 max-w-xl text-[#6B6B70]">
          Everything you study, connected. Every concept you’ve covered, searchable. One prompt away from the explanation you need.
        </p>
        <PillLink
          to="/signup"
          onClick={() => captureLandingEvent('landing_cta_clicked', { cta_name: 'bottom_start_free' })}
          className="mt-8"
        >
          Start free
        </PillLink>
      </div>
    </div>
  </section>
);

const LandingFooter = () => (
  <footer className="border-t border-[#E5E5EA] bg-white">
    <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-12 sm:px-6 md:grid-cols-3">
      <div>
        <Link to="/" className="inline-flex items-center gap-2" aria-label="ChewnPour home">
          <BrandLogo size={28} decorative />
        </Link>
        <p className="mt-3 text-sm text-[#6B6B70]">The smartest study workspace.</p>
      </div>
      <div>
        <p className="font-bold">Sections</p>
        <ul className="mt-3 space-y-2 text-sm text-[#6B6B70]">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="hover:text-[#0A0A0A]">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-bold">Socials</p>
        <ul className="mt-3 space-y-2 text-sm text-[#6B6B70]">
          <li>
            <a href="https://t.me/+jIHi6XFYdl9kNDA0" target="_blank" rel="noopener noreferrer" className="hover:text-[#0A0A0A]">
              Telegram
            </a>
          </li>
          <li>
            <Link to="/privacy" className="hover:text-[#0A0A0A]">
              Privacy
            </Link>
          </li>
          <li>
            <Link to="/terms" className="hover:text-[#0A0A0A]">
              Terms
            </Link>
          </li>
        </ul>
      </div>
    </div>
    <div className="border-t border-[#E5E5EA] py-5 text-center text-xs text-[#8E8E93]">
      Copyright 2026 © ChewnPour, Inc.
    </div>
  </footer>
);

const LandingPage = () => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billing, setBilling] = useState('monthly');
  const [openFaq, setOpenFaq] = useState(0);
  const [workflowTab, setWorkflowTab] = useState('model');
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  const pricing = useMemo(
    () => ({
      freeLimit: 3,
      currency: 'GHS',
      topUpPriceMajor: 20,
      topUpCredits: 5,
      topUpOptions: normalizeTopUpOptions([
        { id: 'first-time-starter', amountMajor: 15, credits: 5, currency: 'GHS' },
        { id: 'starter', amountMajor: 20, credits: 5, currency: 'GHS' },
        { id: 'max', amountMajor: 40, credits: 12, currency: 'GHS' },
        { id: 'semester', amountMajor: 60, credits: 20, currency: 'GHS', validityDays: 120, unlimitedAiChat: true },
      ]),
      checkoutCurrencies: ['GHS'],
    }),
    [],
  );

  const topUpOptions = pricing.topUpOptions;
  const starterPlan =
    topUpOptions.find((plan) => plan.id === 'starter') ||
    topUpOptions[0] ||
    { id: 'starter', amountMajor: 20, credits: 5, currency: 'GHS' };
  const maxPlan =
    topUpOptions.find((plan) => plan.id === 'max') ||
    topUpOptions[topUpOptions.length - 1] ||
    { id: 'max', amountMajor: 40, credits: 12, currency: starterPlan.currency || 'GHS' };

  const captureLandingEvent = (eventName, properties = {}) =>
    capturePostHogEvent(eventName, {
      page: 'landing',
      pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
      ...properties,
    });

  if (user) return <Navigate to="/dashboard" replace />;

  const billingMultiplier = billing === 'yearly' ? 10 : 1;
  const planCards = [
    {
      tier: 'Free Plan',
      icon: 'groups',
      price: formatPlanPrice(0, starterPlan.currency),
      suffix: 'per month',
      description: 'For students who want smarter study without a subscription.',
      features: [
        'Basic AI-generated lessons',
        'Access to AI tutor',
        'Standard quiz library',
        '3 uploads per month',
      ],
      ctaName: 'pricing_free',
      ctaLabel: 'Get Started Free',
      popular: false,
    },
    {
      tier: 'Basic Plan',
      icon: 'workspace_premium',
      price: formatPlanPrice(starterPlan.amountMajor * billingMultiplier, starterPlan.currency),
      suffix: billing === 'yearly' ? 'per year' : 'per month',
      description: 'For students who revise every week and want more uploads.',
      features: [
        'Advanced AI-generated lessons',
        'Full access to study tools',
        'Premium quiz library',
        `${starterPlan.credits * billingMultiplier} document uploads`,
        'Real-time progress tracking',
        'Priority email support',
      ],
      ctaName: 'pricing_basic',
      ctaLabel: 'Join Basic',
      popular: false,
    },
    {
      tier: 'Pro Plan',
      icon: 'military_tech',
      price: formatPlanPrice(maxPlan.amountMajor * billingMultiplier, maxPlan.currency),
      suffix: billing === 'yearly' ? 'per year' : 'per month',
      description: 'For power users who live inside their materials and want full AI.',
      features: [
        'All features in Basic plan',
        'Dedicated study coach',
        'Custom AI revision plans',
        'Onboarding session',
        '24/7 priority support',
        'Advanced analytics & reporting',
      ],
      ctaName: 'pricing_pro',
      ctaLabel: 'Join Pro',
      popular: true,
    },
  ];

  return (
    <div className="slate-root relative min-h-screen overflow-x-hidden">
      <LandingPageStyles />
      <LandingHeader
        captureLandingEvent={captureLandingEvent}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        onToggleMobileMenu={() => setMobileMenuOpen((open) => !open)}
      />
      <main>
        <HeroSection captureLandingEvent={captureLandingEvent} />
        <IntroBridge />
        <FeaturesSection />
        <WorkflowSection activeTab={workflowTab} onTabChange={setWorkflowTab} />
        <AiSection />
        <HowSection captureLandingEvent={captureLandingEvent} />
        <PricingSection
          billing={billing}
          onBillingChange={setBilling}
          planCards={planCards}
          captureLandingEvent={captureLandingEvent}
        />
        <TestimonialsSection
          index={testimonialIndex}
          onPrev={() => setTestimonialIndex((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}
          onNext={() => setTestimonialIndex((i) => (i + 1) % TESTIMONIALS.length)}
        />
        <FaqSection openFaq={openFaq} onToggleFaq={(index) => setOpenFaq((current) => (current === index ? -1 : index))} />
        <CtaSection captureLandingEvent={captureLandingEvent} />
      </main>
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
