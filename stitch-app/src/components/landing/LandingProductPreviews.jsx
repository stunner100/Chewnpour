import BrandLogo from '../BrandLogo';
import AppIcon from '../AppIcon';
import { TutorAvatarMark } from '../tutor/TutorAvatar';

const NAV_ITEMS = [
  { title: 'Dashboard', icon: 'dashboard' },
  { title: 'Upload', icon: 'cloud_upload' },
  { title: 'My Materials', icon: 'folder' },
  { title: 'Lessons', icon: 'menu_book' },
  { title: 'Quizzes', icon: 'quiz' },
  { title: 'Podcasts', icon: 'headphones' },
  { title: 'Timed exams', icon: 'school' },
  { title: 'AI Tutor', icon: 'tutor' },
  { title: 'Progress', icon: 'bar_chart' },
];

const STAGE_WIDTH = 1120;
const STAGE_HEIGHT = 700;

const BrowserFrame = ({ label, children }) => (
  <figure
    className="overflow-hidden rounded-[22px] border border-[#E5E5EA] bg-white shadow-[0_40px_100px_rgba(15,23,42,0.12)] ring-1 ring-[#BFDBFE]/35"
    aria-label={label}
  >
    <div className="flex items-center gap-2 border-b border-[#E5E5EA] bg-[#F9F9F9] px-4 py-2.5">
      <span className="size-2.5 rounded-full bg-[#FF5F57]" />
      <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
      <span className="size-2.5 rounded-full bg-[#28C840]" />
      <span className="ml-3 text-xs font-medium text-[#8E8E93]">www.chewnpour.com/dashboard</span>
    </div>
    {children}
  </figure>
);

const ScaledStage = ({ children }) => (
  <div
    className="landing-product-stage relative w-full overflow-hidden bg-[#F9F9F9]"
    aria-hidden="true"
  >
    <div className="landing-product-stage__inner pointer-events-none origin-top-left font-body text-[#0A0A0A]">
      {children}
    </div>
  </div>
);

const ProductShell = ({ activeNav, children }) => (
  <div
    className="flex bg-[#F9F9F9]"
    style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
  >
    <aside className="flex w-60 shrink-0 flex-col border-r border-[#E5E5EA] bg-[#F2F2F7]">
      <div className="px-3 py-3">
        <BrandLogo size={26} decorative className="h-7 w-auto" />
      </div>
      <div className="px-3 pb-3">
        <div className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#111111] text-sm font-semibold text-white">
          <AppIcon name="auto_awesome" className="text-[16px]" />
          Generate Material
        </div>
      </div>
      <p className="px-4 pb-1 text-[11px] font-medium text-[#8E8E93]">Study</p>
      <nav className="flex-1 space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.title === activeNav;
          return (
            <div
              key={item.title}
              className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium ${
                isActive ? 'bg-[#E5E5EA] text-[#0A0A0A]' : 'text-[#6B6B70]'
              }`}
            >
              {item.icon === 'tutor' ? (
                <TutorAvatarMark className="size-4 rounded-full" />
              ) : (
                <AppIcon name={item.icon} className="text-[16px]" />
              )}
              {item.title}
            </div>
          );
        })}
      </nav>
      <div className="flex items-center gap-2 border-t border-[#E5E5EA] px-3 py-3">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[#111111] text-[11px] font-bold text-white">
          A
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[#0A0A0A]">Ama Boateng</p>
          <p className="truncate text-[11px] text-[#6B6B70]">ama@campus.edu</p>
        </div>
      </div>
    </aside>

    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#E5E5EA] bg-white px-4">
        <AppIcon name="menu" className="text-[20px] text-[#6B6B70]" />
        <div className="relative flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-[#F2F2F7] py-2 pl-10 pr-3 text-[13px] text-[#6B6B70]">
          <AppIcon name="search" className="absolute left-3 text-[#6B6B70]" />
          <span className="truncate">Search materials, lessons, or topics...</span>
          <kbd className="ml-auto rounded-md border border-[#E5E5EA] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#6B6B70]">
            ⌘K
          </kbd>
        </div>
        <span className="inline-flex h-9 w-14 items-center rounded-full border border-[#E5E5EA] bg-[#F2F2F7] p-1">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-white text-[#007AFF] shadow-sm">
            <AppIcon name="dark_mode" className="text-[14px]" />
          </span>
        </span>
        <AppIcon name="help_outline" className="text-[20px] text-[#6B6B70]" />
        <AppIcon name="notifications" className="text-[20px] text-[#6B6B70]" />
        <span className="inline-flex size-9 items-center justify-center rounded-full border border-[#E5E5EA] bg-[#F2F7FF] text-[11px] font-bold text-[#007AFF]">
          A
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  </div>
);

const StatCard = ({ label, value, icon }) => (
  <div className="rounded-[20px] border border-[#E5E5EA] bg-white px-5 py-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <p className="text-[13px] font-medium text-[#6B6B70]">{label}</p>
      <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[#F2F7FF] text-[#007AFF]">
        <AppIcon name={icon} className="text-[18px]" />
      </span>
    </div>
    <p className="mt-3 font-display text-[22px] font-bold text-[#0A0A0A]">{value}</p>
  </div>
);

const DashboardHome = () => (
  <div className="h-full bg-[#F9F9F9] px-6 py-6">
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-[13px] font-medium text-[#6B6B70]">Study home</p>
        <h2 className="mt-1 font-display text-[28px] font-bold tracking-[-0.02em] text-[#0A0A0A]">
          Good morning, Ama.
        </h2>
        <p className="mt-1 text-[14px] text-[#6B6B70]">
          Upload material, study generated lessons, practice quizzes, and ask the AI tutor.
        </p>
      </div>
      <div className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#111111] px-5 text-[13px] font-semibold text-white">
        <AppIcon name="upload" className="text-[16px]" />
        Upload material
      </div>
    </div>

    <div className="mt-5 grid grid-cols-3 gap-3">
      <StatCard label="Uploads" value="4" icon="cloud_upload" />
      <StatCard label="Courses ready" value="3" icon="menu_book" />
      <StatCard label="Next step" value="Continue lesson" icon="bolt" />
    </div>

    <div className="mt-4 grid grid-cols-[1.45fr_1fr] gap-3">
      <section className="rounded-[24px] border border-[#E5E5EA] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-[#6B6B70]">Continue learning</p>
            <h3 className="mt-1 font-display text-[20px] font-bold leading-tight text-[#0A0A0A]">
              Working memory
            </h3>
          </div>
          <span className="inline-flex items-center rounded-full bg-[#F2F2F7] px-3 py-1 text-[11px] font-semibold text-[#6B6B70]">
            In lesson
          </span>
        </div>
        <p className="mt-2 text-[13px] text-[#6B6B70]">Pick up Cognitive Psychology where you left off.</p>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-[#6B6B70]">
            <span>Overall progress</span>
            <span className="tabular-nums">42%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#F2F2F7]">
            <div className="h-full w-[42%] rounded-full bg-[#111111]" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#111111] px-4 text-[13px] font-semibold text-white">
            Continue studying
            <AppIcon name="arrow_forward" className="text-[16px]" />
          </span>
          <span className="inline-flex h-10 items-center rounded-full border border-[#E5E5EA] bg-white px-4 text-[13px] font-semibold text-[#0A0A0A]">
            Practice quiz
          </span>
          <span className="inline-flex h-10 items-center rounded-full border border-[#E5E5EA] bg-white px-4 text-[13px] font-semibold text-[#0A0A0A]">
            Ask AI tutor
          </span>
        </div>
      </section>

      <section className="flex flex-col rounded-[24px] border border-dashed border-[#E5E5EA] bg-white p-5 shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#F2F7FF] text-[#007AFF]">
          <AppIcon name="cloud_upload" className="text-[24px]" />
        </div>
        <h3 className="mt-3 text-center font-display text-[18px] font-bold text-[#0A0A0A]">Upload material</h3>
        <p className="mt-1 text-center text-[13px] text-[#6B6B70]">
          Drag and drop PDFs, docs, or slides, or browse from your device.
        </p>
        <span className="mt-auto inline-flex h-10 items-center justify-center rounded-full border border-[#E5E5EA] text-[13px] font-semibold text-[#0A0A0A]">
          Browse files
        </span>
      </section>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-3">
      <section className="rounded-[24px] border border-[#E5E5EA] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[18px] font-bold text-[#0A0A0A]">Recent materials</h3>
          <span className="text-[13px] font-semibold text-[#007AFF]">View library</span>
        </div>
        <ul className="mt-3 divide-y divide-[#E5E5EA]">
          {[
            ['Lecture 04 Memory.pdf', 'ready'],
            ['Encoding slides.pptx', 'ready'],
          ].map(([name, status]) => (
            <li key={name} className="flex min-h-12 items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#DC2626]">
                  <AppIcon name="description" className="text-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[#0A0A0A]">{name}</p>
                  <p className="text-[11px] text-[#6B6B70]">{status}</p>
                </div>
              </div>
              <span className="text-[13px] font-semibold text-[#007AFF]">Open</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[24px] border border-[#E5E5EA] bg-white p-5 shadow-sm">
        <h3 className="font-display text-[18px] font-bold text-[#0A0A0A]">Quick actions</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            ['Upload', 'cloud_upload'],
            ['Materials', 'folder'],
            ['Lessons', 'menu_book'],
            ['Quizzes', 'quiz'],
          ].map(([label, icon]) => (
            <div
              key={label}
              className="flex min-h-11 items-center gap-2 rounded-2xl bg-[#F2F2F7] px-3 text-[13px] font-semibold text-[#0A0A0A]"
            >
              <AppIcon name={icon} className="text-[18px] text-[#007AFF]" />
              {label}
            </div>
          ))}
        </div>
      </section>
    </div>
  </div>
);

const LessonHome = () => (
  <div className="flex h-full bg-[#F9F9F9]">
    <div className="min-w-0 flex-1 px-8 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] text-[#6B6B70]">Cognitive Psychology</p>
          <h2 className="mt-1 font-display text-[28px] font-bold tracking-[-0.02em] text-[#0A0A0A]">
            Working memory
          </h2>
        </div>
        <span className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111111] px-5 text-[13px] font-semibold text-white">
          <AppIcon name="quiz" className="text-[16px]" />
          Start quiz
        </span>
      </div>
      <p className="mt-4 max-w-[65ch] text-[15px] leading-7 text-[#6B6B70]">
        Working memory is the short-term store that holds information while you process it during study. It is limited, so lessons chunk ideas and ask you to retrieve them before they fade.
      </p>
      <div className="mt-6 rounded-[20px] border border-[#E5E5EA] bg-white p-5 shadow-sm">
        <p className="font-display text-[16px] font-bold text-[#0A0A0A]">Test this lesson</p>
        <p className="mt-1 text-[13px] text-[#6B6B70]">A short quiz on what you just read.</p>
        <span className="mt-4 inline-flex h-10 items-center rounded-full border border-[#E5E5EA] px-4 text-[13px] font-semibold text-[#0A0A0A]">
          Start quiz
        </span>
      </div>
    </div>
    <aside className="w-[280px] shrink-0 border-l border-[#E5E5EA] bg-white p-4">
      <div className="flex items-center gap-2">
        <TutorAvatarMark className="size-7 rounded-full" />
        <p className="text-[14px] font-semibold text-[#0A0A0A]">AI Tutor</p>
      </div>
      <p className="mt-3 text-[13px] leading-5 text-[#6B6B70]">
        Ask from this lesson, not the open web. Re-explain, quiz, or summarise the section you have open.
      </p>
      <div className="mt-4 rounded-2xl bg-[#F2F2F7] px-3 py-2 text-[12px] text-[#6B6B70]">
        Explain working memory simply
      </div>
    </aside>
  </div>
);

export const LandingDashboardPreview = () => (
  <BrowserFrame label="ChewnPour study home with continue learning, uploads, and quizzes">
    <ScaledStage>
      <ProductShell activeNav="Dashboard">
        <DashboardHome />
      </ProductShell>
    </ScaledStage>
  </BrowserFrame>
);

export const LandingLessonPreview = () => (
  <BrowserFrame label="ChewnPour lesson with Start quiz and AI Tutor">
    <ScaledStage>
      <ProductShell activeNav="Lessons">
        <LessonHome />
      </ProductShell>
    </ScaledStage>
  </BrowserFrame>
);
