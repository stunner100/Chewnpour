import React, { useCallback, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
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
  ShieldCheck,
  Star,
  UploadCloud,
  Users,
  Wand2,
} from 'lucide-react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/kids.css';

const readingLevels = [
  { id: 'beginner', label: 'Beginner', icon: Home },
  { id: 'growing', label: 'Growing', icon: BookOpen },
  { id: 'confident', label: 'Confident', icon: LibraryBig },
];

const helpPrompts = [
  'Explain again',
  'Give example',
  'Make it a story',
  'Read it easier',
];

const acceptedKidsFileTypes = '.pdf,.docx,.png,.jpg,.jpeg,.webp,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const maxKidsFileSizeBytes = 25 * 1024 * 1024;

const stripExtension = (fileName) =>
  String(fileName || 'Reading page').replace(/\.(pdf|docx|png|jpe?g|webp)$/i, '');

const resolveKidsFileType = (file) => {
  const mimeType = String(file?.type || '').toLowerCase();
  const extension = String(file?.name || '').split('.').pop()?.toLowerCase() || '';
  if (mimeType.includes('pdf') || extension === 'pdf') return 'pdf';
  if (mimeType.includes('word') || extension === 'docx') return 'docx';
  if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(extension)) return 'image';
  return '';
};

const formatLevel = (level) => {
  const match = readingLevels.find((item) => item.id === level);
  return match?.label || 'Growing';
};

const BrandMark = () => (
  <span className="kids-nav__mark" aria-hidden="true">
    <BookOpen />
  </span>
);

const KidsNav = () => (
  <header className="kids-nav">
    <div className="kids-nav__inner">
      <Link className="kids-nav__brand" to="/kids" aria-label="ChewnPour Kids home">
        <BrandMark />
        <span>ChewnPour Kids</span>
      </Link>
      <nav className="kids-nav__links" aria-label="ChewnPour Kids sections">
        <Link className="kids-nav__link" to="/kids/parent">Parent</Link>
        <Link className="kids-nav__link" to="/kids/upload">Upload</Link>
        <Link className="kids-nav__link" to="/kids/child">Child</Link>
      </nav>
      <div className="kids-nav__right">
        <Link className="kids-btn kids-btn--small" to="/kids/upload">
          Add page
          <ChevronRight aria-hidden="true" />
        </Link>
      </div>
    </div>
  </header>
);

const KidsShell = ({ children }) => (
  <main className="kids-page">
    <KidsNav />
    <div className="kids-shell">{children}</div>
  </main>
);

const SignedOutKids = () => (
  <KidsShell>
    <section className="kids-hero kids-reveal" id="top" style={{ '--i': 0 }}>
      <div className="kids-hero__copy">
        <span className="kids-eyebrow">For ages 6 and up</span>
        <h1>Reading pages children can use.</h1>
        <p className="kids-hero__lede">
          ChewnPour Kids keeps parents in control while children read a calmer,
          smaller lesson made from the pages families already have.
        </p>
        <div className="kids-hero__actions">
          <Link className="kids-btn" to="/signup">
            Start ChewnPour Kids
            <ChevronRight aria-hidden="true" />
          </Link>
          <Link className="kids-btn kids-btn--soft" to="/login">Sign in</Link>
        </div>
      </div>
      <div className="kids-hero__proof" aria-label="ChewnPour Kids lesson summary">
        <div className="kids-proof-card">
          <div className="kids-proof-card__row">
            <div>
              <h2 className="kids-proof-card__title">Animal habitats</h2>
              <p className="kids-proof-card__meta">Growing reader - 8 min</p>
            </div>
            <span className="kids-btn kids-btn--small kids-btn--cyan">Ready</span>
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
  </KidsShell>
);

const LoadingPanel = () => (
  <div className="kids-screen kids-screen--parent" aria-label="Loading ChewnPour Kids">
    <div className="kids-upload-zone">
      <div className="kids-upload-zone__inner">
        <BookOpen aria-hidden="true" />
        <strong>Opening ChewnPour Kids</strong>
        <p>Your family reading room will appear in a moment.</p>
      </div>
    </div>
  </div>
);

const EmptyKidsState = () => (
  <div className="kids-callout">
    <strong>No lessons yet</strong>
    <span>Add a child profile, upload a reading page, and the first lesson will appear here.</span>
    <div className="kids-callout__actions">
      <Link className="kids-btn kids-btn--small" to="/kids/upload">
        Upload reading page
        <ChevronRight aria-hidden="true" />
      </Link>
    </div>
  </div>
);

const CreateProfilePanel = ({ onCreated }) => {
  const createProfile = useMutation(api.kids.createProfile);
  const [name, setName] = useState('');
  const [age, setAge] = useState('6');
  const [readingLevel, setReadingLevel] = useState('growing');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      await createProfile({
        name,
        age: Number(age),
        readingLevel,
      });
      setName('');
      setAge('6');
      setReadingLevel('growing');
      onCreated?.();
    } catch (err) {
      setError(String(err?.data?.message || err?.message || 'Could not create child profile.'));
    } finally {
      setIsSaving(false);
    }
  }, [age, createProfile, name, onCreated, readingLevel]);

  return (
    <form className="kids-callout" onSubmit={handleSubmit}>
      <strong>Add a child</strong>
      <span>Create a profile and choose the reading level parents want ChewnPour to use.</span>
      <div className="kids-form-grid">
        <label className="kids-field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ama" />
        </label>
        <label className="kids-field">
          <span>Age</span>
          <input value={age} onChange={(event) => setAge(event.target.value)} inputMode="numeric" />
        </label>
      </div>
      <div className="kids-tab-row" aria-label="Reading level options">
        {readingLevels.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            className="kids-tab"
            aria-pressed={readingLevel === id}
            key={id}
            onClick={() => setReadingLevel(id)}
          >
            <Icon aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="kids-error" role="alert">{error}</p> : null}
      <button type="submit" className="kids-btn kids-btn--small" disabled={isSaving}>
        <Users aria-hidden="true" />
        {isSaving ? 'Adding child' : 'Add child'}
      </button>
    </form>
  );
};

const ProfileCards = ({ profiles = [] }) => (
  <div className="kids-avatar-row">
    {profiles.map((profile) => {
      const Icon = profile.readingLevel === 'beginner' ? Puzzle : profile.readingLevel === 'confident' ? LibraryBig : BookOpen;
      return (
        <div className="kids-avatar" key={profile._id}>
          <span className="kids-avatar__mark" style={{ '--tone': 'var(--kids-color-accent)' }}>
            <Icon aria-hidden="true" />
          </span>
          <div>
            <strong>{profile.name}</strong>
            <span>Age {profile.age} - {formatLevel(profile.readingLevel)} reader</span>
          </div>
        </div>
      );
    })}
  </div>
);

const ParentLessonCard = ({ lesson }) => {
  const setLessonVisibility = useMutation(api.kids.setLessonVisibility);
  const [isSaving, setIsSaving] = useState(false);
  const toggleVisibility = useCallback(async () => {
    setIsSaving(true);
    try {
      await setLessonVisibility({
        lessonId: lesson._id,
        visibleToChild: !lesson.visibleToChild,
      });
    } finally {
      setIsSaving(false);
    }
  }, [lesson._id, lesson.visibleToChild, setLessonVisibility]);

  return (
    <div className="kids-callout">
      <strong>{lesson.title}</strong>
      <span>
        {lesson.visibleToChild ? 'Visible to child' : 'Hidden from child'} - {formatLevel(lesson.readingLevel)} reader
      </span>
      <div className="kids-callout__actions">
        <button type="button" className="kids-btn kids-btn--soft kids-btn--small" onClick={toggleVisibility} disabled={isSaving}>
          <EyeOff aria-hidden="true" />
          {lesson.visibleToChild ? 'Hide' : 'Show'}
        </button>
        <Link className="kids-btn kids-btn--soft kids-btn--small" to={`/kids/lesson/${lesson._id}`}>
          <BookOpen aria-hidden="true" />
          Open
        </Link>
      </div>
    </div>
  );
};

export const KidsParentHome = () => {
  const { user } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const profiles = useQuery(api.kids.listProfiles, isAuthenticated ? {} : 'skip');
  const parentLessons = useQuery(api.kids.listParentLessons, isAuthenticated ? {} : 'skip');

  if (!user) return <SignedOutKids />;

  const profileList = profiles || [];
  const lessons = parentLessons || [];
  const isLoading = profiles === undefined || parentLessons === undefined;

  return (
    <KidsShell>
      <article className="kids-shot kids-reveal" id="parent" style={{ '--i': 1 }}>
        <div className="kids-shot__caption">
          <span className="kids-shot__tag">
            <ShieldCheck aria-hidden="true" />
            Parent control
          </span>
          <h3>Manage your children and reading pages.</h3>
          <p>
            Parents choose reading levels, add pages, and decide what the child can see.
          </p>
        </div>
        {isLoading ? (
          <LoadingPanel />
        ) : (
          <div className="kids-screen kids-screen--parent" aria-label="Parent dashboard">
            <div className="kids-screen__top">
              <div className="kids-screen__title">
                <strong>Parent home</strong>
                <span>{profileList.length} profiles - {lessons.length} lessons</span>
              </div>
              <Link to="/kids/upload" className="kids-btn kids-btn--small">
                <UploadCloud aria-hidden="true" />
                Upload page
              </Link>
            </div>
            {profileList.length > 0 ? <ProfileCards profiles={profileList} /> : <CreateProfilePanel />}
            <div className="kids-kpi-grid">
              <div className="kids-mini-card kids-mini-card--accent">
                <strong>{lessons.filter((lesson) => lesson.visibleToChild).length}</strong>
                <span>visible lessons</span>
              </div>
              <div className="kids-mini-card kids-mini-card--mint">
                <strong>{lessons.reduce((total, lesson) => total + lesson.vocabulary.length, 0)}</strong>
                <span>new words</span>
              </div>
              <div className="kids-mini-card kids-mini-card--coral">
                <strong>{profileList.length}</strong>
                <span>children</span>
              </div>
            </div>
            <div className="kids-card-grid">
              {lessons.length > 0 ? lessons.slice(0, 2).map((lesson) => (
                <ParentLessonCard lesson={lesson} key={lesson._id} />
              )) : <EmptyKidsState />}
              {profileList.length > 0 ? <CreateProfilePanel /> : null}
            </div>
          </div>
        )}
      </article>
    </KidsShell>
  );
};

export const KidsUpload = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const profiles = useQuery(api.kids.listProfiles, isAuthenticated ? {} : 'skip');
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const createUpload = useMutation(api.uploads.createUpload);
  const createMaterialFromUpload = useMutation(api.kids.createMaterialFromUpload);
  const createStarterLesson = useMutation(api.kids.createStarterLesson);
  const fileInputRef = useRef(null);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [readingLevel, setReadingLevel] = useState('growing');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const profileList = profiles || [];
  const activeChildId = selectedChildId || profileList[0]?._id || '';

  const openFilePicker = useCallback(() => {
    if (!isUploading && activeChildId) fileInputRef.current?.click();
  }, [activeChildId, isUploading]);

  const handleFile = useCallback(async (file) => {
    if (!file || !activeChildId) return;
    setError('');
    const fileType = resolveKidsFileType(file);
    if (!fileType) {
      setError('Upload a PDF, Word document, or image page.');
      return;
    }
    if (file.size > maxKidsFileSizeBytes) {
      setError('File must be smaller than 25MB.');
      return;
    }
    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: file.type ? { 'Content-Type': file.type } : undefined,
        body: file,
      });
      if (!result.ok) throw new Error(`Storage responded with ${result.status}`);
      const { storageId } = await result.json();
      const uploadId = await createUpload({
        fileName: file.name,
        fileType,
        fileSize: file.size,
        storageId,
      });
      const materialId = await createMaterialFromUpload({
        childId: activeChildId,
        uploadId,
        readingLevel,
      });
      const lessonId = await createStarterLesson({ materialId });
      navigate(`/kids/lesson/${lessonId}`);
    } catch (err) {
      setError(String(err?.data?.message || err?.message || 'Could not upload this reading page.'));
    } finally {
      setIsUploading(false);
    }
  }, [activeChildId, createMaterialFromUpload, createStarterLesson, createUpload, generateUploadUrl, navigate, readingLevel]);

  if (!user) return <SignedOutKids />;

  return (
    <KidsShell>
      <article className="kids-shot kids-reveal" id="upload" style={{ '--i': 2 }}>
        <div className="kids-screen kids-screen--parent" aria-label="Upload reading page">
          <div className="kids-screen__top">
            <div className="kids-screen__title">
              <strong>Upload reading page</strong>
              <span>{activeChildId ? 'Choose a child and reading level' : 'Add a child profile first'}</span>
            </div>
            <Link className="kids-btn kids-btn--soft kids-btn--small" to="/kids/parent">Parent home</Link>
          </div>
          {profileList.length === 0 ? (
            <CreateProfilePanel />
          ) : (
            <>
              <div className="kids-form-grid">
                <label className="kids-field">
                  <span>Child</span>
                  <select value={activeChildId} onChange={(event) => setSelectedChildId(event.target.value)}>
                    {profileList.map((profile) => (
                      <option value={profile._id} key={profile._id}>{profile.name}</option>
                    ))}
                  </select>
                </label>
                <label className="kids-field">
                  <span>Page title</span>
                  <input value={stripExtension(fileInputRef.current?.files?.[0]?.name || '')} placeholder="Chosen after upload" readOnly />
                </label>
              </div>
              <div className="kids-tab-row" aria-label="Reading level options">
                {readingLevels.map(({ id, label, icon: Icon }) => (
                  <button
                    type="button"
                    className="kids-tab"
                    aria-pressed={readingLevel === id}
                    key={id}
                    onClick={() => setReadingLevel(id)}
                  >
                    <Icon aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
              <div className="kids-upload-zone" role="button" tabIndex={0} onClick={openFilePicker} onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openFilePicker();
                }
              }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptedKidsFileTypes}
                  onChange={(event) => handleFile(event.target.files?.[0])}
                  className="hidden"
                  disabled={isUploading}
                />
                <div className="kids-upload-zone__inner">
                  <FileText aria-hidden="true" />
                  <strong>Drop worksheet, page, PDF, or photo</strong>
                  <p>The lesson appears when the page is ready and safety checks pass.</p>
                  <button type="button" className="kids-btn kids-btn--small" disabled={isUploading}>
                    {isUploading ? 'Preparing lesson' : 'Choose file'}
                  </button>
                </div>
              </div>
            </>
          )}
          {error ? <p className="kids-error" role="alert">{error}</p> : null}
          <div className="kids-pipeline" aria-label="Reading page setup steps">
            {[
              ['Upload', 'reading page'],
              ['Find', 'important words'],
              ['Create', 'short lesson'],
              ['Open', 'child ready'],
            ].map(([title, detail]) => (
              <div className="kids-pipeline__step" key={title}>
                <strong>{title}</strong>
                <span>{detail}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="kids-shot__caption">
          <span className="kids-shot__tag">
            <UploadCloud aria-hidden="true" />
            Quick setup
          </span>
          <h3>Parents can move from page to lesson quickly.</h3>
          <p>If the page is not ready, the child does not see it. If it is ready, the lesson appears with parent controls intact.</p>
        </div>
      </article>
    </KidsShell>
  );
};

export const KidsChildHome = () => {
  const { user } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const profiles = useQuery(api.kids.listProfiles, isAuthenticated ? {} : 'skip');
  const childLessons = useQuery(api.kids.listChildLessons, isAuthenticated ? {} : 'skip');
  const activeProfile = profiles?.[0];
  const nextLesson = childLessons?.[0];

  if (!user) return <SignedOutKids />;

  return (
    <KidsShell>
      <article className="kids-shot kids-reveal" id="child" style={{ '--i': 3 }}>
        <div className="kids-shot__caption">
          <span className="kids-shot__tag">
            <Star aria-hidden="true" />
            Child home
          </span>
          <h3>The child gets one clear next step.</h3>
          <p>No settings or upload controls. The child sees today&apos;s reading, rewards, finished lessons, and quiz games.</p>
        </div>
        <div className="kids-screen kids-screen--child" aria-label="Child dashboard">
          <div className="kids-child-hero">
            <div className="kids-screen__title">
              <strong>Hi {activeProfile?.name || 'reader'}</strong>
              <span>{nextLesson ? 'Your reading page is ready.' : 'Ask a parent to add a reading page.'}</span>
            </div>
            <div className="kids-reward" aria-label="Reward stars">
              <strong>{childLessons?.length || 0}</strong>
              <span>lessons</span>
            </div>
          </div>
          {nextLesson ? (
            <div className="kids-reading-grid">
              <div className="kids-lesson-panel kids-lesson-panel--primary">
                <h4>{nextLesson.title}</h4>
                <p>Learn {nextLesson.vocabulary.length} new words, read a short recap, and answer {nextLesson.questions.length} questions.</p>
                <div className="kids-help-row">
                  <Link className="kids-btn kids-btn--small" to={`/kids/lesson/${nextLesson._id}`}>
                    Start reading
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </div>
              </div>
              <div className="kids-lesson-panel kids-lesson-panel--soft">
                <h4>Quiz games</h4>
                <p>Tiny checks unlock after reading.</p>
                <Link className="kids-btn kids-btn--soft kids-btn--small" to={`/kids/lesson/${nextLesson._id}`}>
                  <Puzzle aria-hidden="true" />
                  Practice
                </Link>
              </div>
            </div>
          ) : <EmptyKidsState />}
        </div>
      </article>
    </KidsShell>
  );
};

export const KidsLesson = () => {
  const { lessonId } = useParams();
  const { user } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const lesson = useQuery(api.kids.getLesson, isAuthenticated && lessonId ? { lessonId } : 'skip');
  const recordHelpRequest = useMutation(api.kids.recordHelpRequest);
  const [helpMessage, setHelpMessage] = useState('');

  const requestHelp = useCallback(async (prompt) => {
    if (!lesson?._id) return;
    await recordHelpRequest({ lessonId: lesson._id, prompt });
    setHelpMessage(`${prompt} is ready for this lesson.`);
  }, [lesson?._id, recordHelpRequest]);

  if (!user) return <SignedOutKids />;
  if (lesson === null) return <Navigate to="/kids/child" replace />;

  return (
    <KidsShell>
      <article className="kids-shot kids-reveal" id="lesson" style={{ '--i': 4 }}>
        <div className="kids-screen kids-screen--lesson" aria-label="Child reading lesson">
          {!lesson ? <LoadingPanel /> : (
            <>
              <div className="kids-screen__top">
                <div className="kids-screen__title">
                  <strong>{lesson.title}</strong>
                  <span>{formatLevel(lesson.readingLevel)} reader - {lesson.estimatedMinutes} min</span>
                </div>
                <span className="kids-shot__tag">
                  <CheckCircle2 aria-hidden="true" />
                  Safe help
                </span>
              </div>
              <div className="kids-lesson-panel kids-lesson-panel--soft">
                <h4>New words</h4>
                <p>These words came from the reading page.</p>
                <div className="kids-vocab">
                  {lesson.vocabulary.map((item) => (
                    <div className="kids-vocab__card" key={item.term}>
                      <strong>{item.term}</strong>
                      <span>{item.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="kids-lesson-panel kids-lesson-panel--primary">
                <h4>Story recap</h4>
                <p>{lesson.recap}</p>
              </div>
              <div className="kids-lesson-panel kids-lesson-panel--soft">
                <h4>Mini question</h4>
                <p>{lesson.questions[0]?.prompt || 'What did you learn?'}</p>
                <div className="kids-quiz-row">
                  {(lesson.questions[0]?.options || []).map((option) => (
                    <button type="button" className="kids-choice" aria-pressed={option === lesson.questions[0]?.correctOption} key={option}>
                      {option}
                    </button>
                  ))}
                </div>
                <div className="kids-help-row" aria-label="Safe help prompts">
                  {helpPrompts.map((prompt) => (
                    <button type="button" className="kids-btn kids-btn--small" key={prompt} onClick={() => requestHelp(prompt)}>
                      <HelpCircle aria-hidden="true" />
                      {prompt}
                    </button>
                  ))}
                </div>
                {helpMessage ? <p className="kids-help-message" role="status">{helpMessage}</p> : null}
              </div>
            </>
          )}
        </div>
        <div className="kids-shot__caption">
          <span className="kids-shot__tag">
            <Wand2 aria-hidden="true" />
            Lesson session
          </span>
          <h3>Help stays guided, not open-ended.</h3>
          <p>The child can ask for a simpler explanation, an example, or a story version. Every action stays tied to the approved reading page.</p>
        </div>
      </article>
    </KidsShell>
  );
};

const Kids = KidsParentHome;

export default Kids;
