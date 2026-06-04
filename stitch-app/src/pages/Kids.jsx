import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  EyeOff,
  FileText,
  HelpCircle,
  Home,
  LibraryBig,
  Puzzle,
  RotateCcw,
  ShieldCheck,
  Star,
  UploadCloud,
  Users,
  Wand2,
} from 'lucide-react';
import '../styles/kids.css';

const childProfiles = [
  {
    name: 'Ama',
    age: 'Age 7',
    level: 'Growing reader',
    tone: 'var(--kids-color-accent)',
    icon: BookOpen,
  },
  {
    name: 'Kojo',
    age: 'Age 6',
    level: 'Beginner',
    tone: 'var(--kids-color-cyan-soft)',
    icon: Puzzle,
  },
  {
    name: 'Add child',
    age: 'Profile',
    level: 'Set reading level',
    tone: 'var(--kids-color-mint-soft)',
    icon: Users,
  },
];

const parentStats = [
  ['4', 'lessons ready'],
  ['18', 'new words'],
  ['82%', 'quiz accuracy'],
];

const pipelineSteps = [
  ['Upload', 'reading page'],
  ['Find', 'important words'],
  ['Create', 'short lesson'],
  ['Open', 'child ready'],
];

const helpPrompts = [
  'Explain again',
  'Give example',
  'Make it a story',
  'Read it easier',
];

const ScreenCaption = ({ icon: Icon, tag, title, children }) => (
  <div className="kids-shot__caption">
    <span className="kids-shot__tag">
      <Icon aria-hidden="true" />
      {tag}
    </span>
    <h3>{title}</h3>
    <p>{children}</p>
  </div>
);

const BrandMark = () => (
  <span className="kids-nav__mark" aria-hidden="true">
    <BookOpen />
  </span>
);

const KidsNav = () => (
  <header className="kids-nav">
    <div className="kids-nav__inner">
      <a className="kids-nav__brand" href="#top" aria-label="ChewnPour Kids home">
        <BrandMark />
        <span>ChewnPour Kids</span>
      </a>
      <nav className="kids-nav__links" aria-label="ChewnPour Kids sections">
        <a className="kids-nav__link" href="#parent" aria-current="page">
          Parent
        </a>
        <a className="kids-nav__link" href="#upload">
          Upload
        </a>
        <a className="kids-nav__link" href="#child">
          Child
        </a>
        <a className="kids-nav__link" href="#lesson">
          Lesson
        </a>
      </nav>
      <div className="kids-nav__right">
        <a className="kids-btn kids-btn--small" href="#screens">
          See how it works
          <ChevronRight aria-hidden="true" />
        </a>
      </div>
    </div>
  </header>
);

const HeroSection = () => (
  <section className="kids-hero kids-reveal" id="top" style={{ '--i': 0 }}>
    <div className="kids-hero__copy">
      <span className="kids-eyebrow">For ages 6 and up</span>
      <h1>Reading pages children can use.</h1>
      <p className="kids-hero__lede">
        ChewnPour Kids keeps the adult in control and gives the child a smaller,
        warmer reading room: upload a page, prepare a lesson, then learn through
        short words, story recaps, and tiny checks.
      </p>
      <div className="kids-hero__actions">
        <a className="kids-btn" href="#parent">
          Start with parent control
          <ChevronRight aria-hidden="true" />
        </a>
        <a className="kids-btn kids-btn--soft" href="#lesson">
          See a child lesson
        </a>
      </div>
    </div>
    <div className="kids-hero__proof" aria-label="ChewnPour Kids lesson summary">
      <div className="kids-proof-card">
        <div className="kids-proof-card__row">
          <div>
            <h2 className="kids-proof-card__title">Animal habitats</h2>
            <p className="kids-proof-card__meta">Growing reader - 8 min</p>
          </div>
          <span className="kids-btn kids-btn--small kids-btn--cyan">
            Ready
          </span>
        </div>
        <div className="kids-progress" aria-label="Lesson progress">
          <span className="kids-progress__track">
            <span className="kids-progress__bar" style={{ '--value': '76%' }} />
          </span>
          <span className="kids-proof-card__meta">Vocabulary and recap ready</span>
        </div>
        <ul className="kids-word-list" aria-label="Vocabulary examples">
          <li>habitat</li>
          <li>burrow</li>
          <li>shelter</li>
        </ul>
      </div>
      <div className="kids-character" aria-label="ChewnPour Kids companion">
        <div className="kids-character__face">
          <span className="kids-character__mouth" />
        </div>
        <p>A calm reading companion that keeps the page feeling friendly.</p>
      </div>
    </div>
  </section>
);

const ParentScreen = () => (
  <article className="kids-shot kids-reveal" id="parent" style={{ '--i': 1 }}>
    <ScreenCaption icon={ShieldCheck} tag="Parent control" title="The adult dashboard stays practical.">
      Parents manage children, reading level, lesson visibility, and make-again
      controls. The child never sees upload controls or billing.
    </ScreenCaption>
    <div className="kids-screen kids-screen--parent" aria-label="Parent dashboard">
      <div className="kids-screen__top">
        <div className="kids-screen__title">
          <strong>Parent home</strong>
          <span>Three profiles - two lessons ready today</span>
        </div>
        <button type="button" className="kids-btn kids-btn--small">
          <UploadCloud aria-hidden="true" />
          Upload page
        </button>
      </div>
      <div className="kids-avatar-row">
        {childProfiles.map(({ name, age, level, tone, icon: Icon }) => (
          <div className="kids-avatar" key={name}>
            <span className="kids-avatar__mark" style={{ '--tone': tone }}>
              <Icon aria-hidden="true" />
            </span>
            <div>
              <strong>{name}</strong>
              <span>{age} - {level}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="kids-kpi-grid">
        {parentStats.map(([value, label], index) => (
          <div
            className={[
              'kids-mini-card',
              index === 0 ? 'kids-mini-card--accent' : '',
              index === 1 ? 'kids-mini-card--mint' : '',
              index === 2 ? 'kids-mini-card--coral' : '',
            ].filter(Boolean).join(' ')}
            key={label}
          >
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="kids-card-grid">
        <div className="kids-callout">
          <strong>Animal Habitats</strong>
          <span>Published automatically - Ama can open it now</span>
          <div className="kids-callout__actions">
            <button type="button" className="kids-btn kids-btn--soft kids-btn--small">
              <EyeOff aria-hidden="true" />
              Hide
            </button>
            <button type="button" className="kids-btn kids-btn--soft kids-btn--small">
              <RotateCcw aria-hidden="true" />
              Make again
            </button>
          </div>
        </div>
        <div className="kids-callout">
          <strong>Safety defaults</strong>
          <span>Preset help buttons only - no child uploads - no open chat</span>
        </div>
      </div>
    </div>
  </article>
);

const UploadScreen = () => (
  <article className="kids-shot kids-reveal" id="upload" style={{ '--i': 2 }}>
    <div className="kids-screen kids-screen--parent" aria-label="Upload reading page">
      <div className="kids-screen__top">
        <div className="kids-screen__title">
          <strong>Upload reading page</strong>
          <span>Selected child: Ama - Growing reader</span>
        </div>
        <button type="button" className="kids-btn kids-btn--soft kids-btn--small">
          Change child
        </button>
      </div>
      <div className="kids-tab-row" aria-label="Reading level options">
        <button type="button" className="kids-tab">
          <Home aria-hidden="true" />
          Beginner
        </button>
        <button type="button" className="kids-tab" aria-pressed="true">
          <BookOpen aria-hidden="true" />
          Growing
        </button>
        <button type="button" className="kids-tab">
          <LibraryBig aria-hidden="true" />
          Confident
        </button>
      </div>
      <div className="kids-upload-zone">
        <div className="kids-upload-zone__inner">
          <FileText aria-hidden="true" />
          <strong>Drop worksheet, page, PDF, or photo</strong>
          <p>The lesson appears when the page is ready and safety checks pass.</p>
          <button type="button" className="kids-btn kids-btn--small">
            Choose file
          </button>
        </div>
      </div>
      <div className="kids-pipeline" aria-label="Reading page setup steps">
        {pipelineSteps.map(([title, detail]) => (
          <div className="kids-pipeline__step" key={title}>
            <strong>{title}</strong>
            <span>{detail}</span>
          </div>
        ))}
      </div>
    </div>
    <ScreenCaption icon={UploadCloud} tag="Quick setup" title="Parents can move from page to lesson quickly.">
      ChewnPour shows what happens after upload. If the page is not ready, the
      child does not see it. If it is ready, the lesson appears with parent
      controls intact.
    </ScreenCaption>
  </article>
);

const ChildScreen = () => (
  <article className="kids-shot kids-reveal" id="child" style={{ '--i': 3 }}>
    <ScreenCaption icon={Star} tag="Child home" title="The child gets one clear next step.">
      No settings or upload controls. The child sees today&apos;s reading, rewards,
      finished lessons, and quiz games.
    </ScreenCaption>
    <div className="kids-screen kids-screen--child" aria-label="Child dashboard">
      <div className="kids-child-hero">
        <div className="kids-screen__title">
          <strong>Hi Ama</strong>
          <span>Your reading page is ready.</span>
        </div>
        <div className="kids-reward" aria-label="Reward stars">
          <strong>24</strong>
          <span>stars</span>
        </div>
      </div>
      <div className="kids-reading-grid">
        <div className="kids-lesson-panel kids-lesson-panel--primary">
          <h4>Animal Habitats</h4>
          <p>Learn three new words, read a short recap, and answer five questions.</p>
          <div className="kids-help-row">
            <button type="button" className="kids-btn kids-btn--small">
              Start reading
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="kids-lesson-panel kids-lesson-panel--soft">
          <h4>Quiz games</h4>
          <p>Two tiny checks unlocked after reading.</p>
          <button type="button" className="kids-btn kids-btn--soft kids-btn--small">
            <Puzzle aria-hidden="true" />
            Practice
          </button>
        </div>
      </div>
      <div className="kids-kpi-grid">
        <div className="kids-mini-card kids-mini-card--mint">
          <strong>3</strong>
          <span>words learned</span>
        </div>
        <div className="kids-mini-card kids-mini-card--accent">
          <strong>5</strong>
          <span>questions today</span>
        </div>
        <div className="kids-mini-card kids-mini-card--coral">
          <strong>1</strong>
          <span>story recap</span>
        </div>
      </div>
    </div>
  </article>
);

const LessonScreen = () => (
  <article className="kids-shot kids-reveal" id="lesson" style={{ '--i': 4 }}>
    <div className="kids-screen kids-screen--lesson" aria-label="Child reading lesson">
      <div className="kids-screen__top">
        <div className="kids-screen__title">
          <strong>Animal Habitats</strong>
          <span>Step 2 of 5 - Vocabulary first</span>
        </div>
        <span className="kids-shot__tag">
          <CheckCircle2 aria-hidden="true" />
          Safe help
        </span>
      </div>
      <div className="kids-lesson-panel kids-lesson-panel--soft">
        <h4>New words</h4>
        <p>These words came from the uploaded worksheet.</p>
        <div className="kids-vocab">
          <div className="kids-vocab__card">
            <strong>Habitat</strong>
            <span>An animal&apos;s home</span>
          </div>
          <div className="kids-vocab__card">
            <strong>Burrow</strong>
            <span>A small tunnel home</span>
          </div>
          <div className="kids-vocab__card">
            <strong>Shelter</strong>
            <span>A safe place</span>
          </div>
        </div>
      </div>
      <div className="kids-lesson-panel kids-lesson-panel--primary">
        <h4>Story recap</h4>
        <p>
          A habitat is where an animal lives. A fish needs water, a bird may use
          a nest, and a rabbit may hide in a burrow.
        </p>
      </div>
      <div className="kids-lesson-panel kids-lesson-panel--soft">
        <h4>Mini question</h4>
        <p>Where would a fish feel safest?</p>
        <div className="kids-quiz-row">
          <button type="button" className="kids-choice" aria-pressed="true">
            Water
          </button>
          <button type="button" className="kids-choice">
            Tree
          </button>
          <button type="button" className="kids-choice">
            Sand
          </button>
        </div>
        <div className="kids-help-row" aria-label="Safe help prompts">
          {helpPrompts.map((prompt) => (
            <button type="button" className="kids-btn kids-btn--small" key={prompt}>
              <HelpCircle aria-hidden="true" />
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
    <ScreenCaption icon={Wand2} tag="Lesson session" title="Help stays guided, not open-ended.">
      The child can ask for a simpler explanation, an example, or a story version.
      Every action stays tied to the approved reading page.
    </ScreenCaption>
  </article>
);

const Kids = () => (
  <main className="kids-page">
    <KidsNav />
    <div className="kids-shell">
      <HeroSection />
      <section className="kids-section kids-reveal" id="screens" style={{ '--i': 1 }}>
        <div className="kids-section__head">
          <h2>One family flow from upload to reading.</h2>
          <p>
            Parents choose the child and reading level, then ChewnPour turns the
            page into vocabulary, a short recap, and simple checks the child can
            complete on their own.
          </p>
        </div>
        <div className="kids-workbench">
          <ParentScreen />
          <UploadScreen />
          <ChildScreen />
          <LessonScreen />
        </div>
      </section>
      <section className="kids-parent-note kids-reveal" style={{ '--i': 5 }}>
        <h2>Built for parent-led learning.</h2>
        <p>
          Children get guided reading, preset help buttons, and short practice.
          Parents keep the upload, visibility, and make-again controls.
        </p>
      </section>
    </div>
    <footer className="kids-footer">
      <p className="kids-footer__line">A reading room guided by parents.</p>
      <div className="kids-footer__meta">
        <span>ChewnPour Kids</span>
        <span>Reading support for young learners</span>
      </div>
    </footer>
  </main>
);

export default Kids;
