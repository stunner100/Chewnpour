# ChewnPour DESIGN.md

## Product Context

ChewnPour is an AI-powered study platform for students. It turns uploaded PDFs, lecture slides, notes, and course material into structured lessons, quizzes, flashcards, and AI tutor sessions.

The interface should feel like a calm study workspace, not a noisy AI tool. Students should feel that ChewnPour is intelligent, trustworthy, organized, and easy to use before exams.

## Design Inspiration Blend

ChewnPour combines four design influences:

1. Notion-inspired workspace clarity
   - Clean writing surfaces
   - Calm dashboards
   - Document organization
   - Soft cards and database-like lists
   - Minimal distractions

2. Claude-inspired AI interaction
   - Warm, thoughtful AI tutor experience
   - Editorial layouts
   - Gentle chat UI
   - Clear reasoning and explanation cards
   - Human, calm, intelligent tone

3. Khan Academy-inspired learning structure
   - Accessible educational UI
   - Clear learning progress
   - Semantic colors for success, warning, error, and active learning states
   - Strong contrast and inclusive design
   - Learning-first hierarchy

4. Quizlet-inspired study modes
   - Flashcards
   - Practice quizzes
   - Review sessions
   - Study sets and decks
   - Lightweight, focused, repeatable study flows

Do not copy any of these brands directly. Use them only as inspiration to build a unique ChewnPour design system.

---

## Brand Personality

ChewnPour should feel:

- Calm
- Smart
- Student-friendly
- Focused
- Trustworthy
- Modern
- Slightly playful, but not childish
- Academic, but not boring
- AI-powered, but not robotic

The product should feel like:

> A clean AI study desk that helps me understand my material faster.

Avoid:

- Overly corporate SaaS design
- Generic AI gradients everywhere
- Heavy dark mode as the default
- Too many glowing effects
- Overcrowded dashboards
- Loud gamification
- Confusing academic jargon

---

## Visual Direction

Use a light, calm, workspace-first design.

Preferred look:

- Off-white background
- Soft warm surfaces
- Clean cards
- Gentle borders
- Rounded corners
- Clear hierarchy
- Subtle shadows
- Strong readability
- Spacious layouts
- Organized study sections

The product should feel more like a premium learning workspace than a flashy AI chatbot.

---

## Color System

Use semantic colors. Colors should communicate purpose, not decoration.

### Core Palette

```css
--background: #FAF8F3;
--surface: #FFFFFF;
--surface-soft: #F5F1E8;
--surface-muted: #EFE8DA;

--text-primary: #1F2933;
--text-secondary: #52616B;
--text-muted: #7B8794;

--border-subtle: #E7E0D3;
--border-default: #D8CFBF;
--border-strong: #B8AD9A;
```

### Brand / Primary

Use a warm academic amber as the main ChewnPour accent.

```css
--primary: #D97706;
--primary-hover: #B45309;
--primary-soft: #FEF3C7;
--primary-subtle: #FFFBEB;
```

Primary should be used for:

- Main CTA buttons
- Active navigation
- Upload action
- Start study session
- Generate quiz
- Continue lesson

Do not overuse primary color. One primary action per surface.

### AI Tutor Accent

Use a calm terracotta tone for AI tutor elements.

```css
--ai: #B75E45;
--ai-soft: #F8E3DC;
--ai-subtle: #FFF7F4;
```

Use for:

- AI tutor messages
- Explanation blocks
- Ask AI buttons
- AI-generated content labels
- Tutor hints

### Learning Colors

```css
--success: #15803D;
--success-soft: #DCFCE7;

--warning: #D97706;
--warning-soft: #FEF3C7;

--error: #DC2626;
--error-soft: #FEE2E2;

--info: #2563EB;
--info-soft: #DBEAFE;

--mastery: #7C3AED;
--mastery-soft: #EDE9FE;
```

Use these semantically:

- Success: completed lesson, correct answer, upload finished
- Warning: incomplete generation, weak topic coverage, pending review
- Error: failed upload, unsupported file, generation failed
- Info: tips, system guidance, neutral explanations
- Mastery: progress, streaks, strong understanding, exam readiness

---

## Typography

Use a clean, readable sans-serif typeface.

Recommended stack:

```css
font-family: Inter, Satoshi, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Typography Scale

```css
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 32px;
--text-4xl: 40px;
```

### Font Weights

```css
--font-regular: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Rules

- Use bold typography for clarity, not decoration.
- Lesson pages should be highly readable.
- Quiz questions should use larger text than normal body copy.
- Avoid tiny gray text for important learning content.
- AI explanations should feel editorial and easy to scan.

---

## Spacing System

Use generous spacing.

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### Layout Rules

- Dashboard sections should breathe.
- Cards should not feel cramped.
- Use whitespace to reduce study stress.
- Group related learning actions together.
- Avoid dense admin-dashboard layouts.

---

## Radius and Shape

Use soft, modern corners.

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
--radius-2xl: 24px;
```

Recommended:

- Buttons: 12px-14px
- Cards: 16px-20px
- Large upload areas: 24px
- Modals: 24px
- Flashcards: 20px-24px

---

## Shadows and Elevation

Use shadows lightly.

```css
--shadow-sm: 0 1px 2px rgba(31, 41, 51, 0.06);
--shadow-md: 0 8px 24px rgba(31, 41, 51, 0.08);
--shadow-lg: 0 18px 45px rgba(31, 41, 51, 0.10);
```

Use shadows for:

- Active cards
- Upload panels
- Modals
- Floating AI tutor
- Flashcards

Avoid heavy shadows everywhere.

---

## Layout System

### App Shell

ChewnPour should use a workspace layout:

- Left sidebar for navigation
- Main content area for learning and study work
- Optional right panel for AI tutor, progress, or context
- Top bar for search, upload, profile, and quick actions

### Main Navigation

Recommended nav items:

1. Dashboard
2. My Materials
3. Lessons
4. Quizzes
5. Flashcards
6. AI Tutor
7. Progress
8. Settings

Use simple icons with labels. Active nav should use primary-soft background and primary text.

### Dashboard Layout

Dashboard should prioritize:

1. Continue studying
2. Recent uploads
3. Exam readiness / progress
4. Suggested next action
5. Generated study sets
6. Weak topics
7. Recent quiz performance

The dashboard should answer:

> What should I study next?

---

## Component Guidelines

### Buttons

#### Primary Button

Use for the main action only.

Examples:

- Upload material
- Generate lesson
- Start quiz
- Continue studying
- Ask AI tutor

Style:

- Primary background
- White text
- Medium or semibold weight
- Rounded 12px
- Clear hover state
- Loading state required

#### Secondary Button

Use for alternative actions.

Examples:

- Preview material
- View summary
- Save draft
- Review later

Style:

- White or soft surface
- Border
- Text primary
- Subtle hover background

#### Ghost Button

Use for low-priority actions.

Examples:

- Rename
- More options
- Copy
- Open menu

---

## Cards

### Study Material Card

Each uploaded material card should show:

- File title
- File type
- Upload date
- Processing status
- Number of lessons generated
- Number of quizzes generated
- Last studied time
- Primary action: Continue / Generate / Open

Card style:

- White surface
- Subtle border
- 16px-20px radius
- Small icon or file thumbnail
- Clear status badge

### Lesson Card

Should show:

- Lesson title
- Short summary
- Estimated study time
- Progress percentage
- Difficulty level
- CTA: Continue lesson

### Quiz Card

Should show:

- Quiz title
- Number of questions
- Difficulty
- Last score
- Status: Not started / In progress / Completed
- CTA: Start quiz or Review answers

### Flashcard Deck Card

Should show:

- Deck title
- Number of cards
- Mastery level
- Due for review count
- CTA: Review cards

---

## Upload Experience

The upload screen is one of the most important surfaces.

It should feel reassuring and simple.

### Upload Area

Design:

- Large rounded dropzone
- Dashed or soft border
- File icon
- Clear instruction text
- Supported file types
- Upload progress
- Error state

Copy examples:

- Upload your lecture slides, PDF, or notes.
- ChewnPour will turn this into lessons, quizzes, and tutor sessions.
- PDF, PPTX, DOCX, and text files supported.

### Upload States

1. Empty
2. Dragging file
3. Uploading
4. Processing
5. Completed
6. Failed
7. Unsupported file

Processing state should be calm:

- Show steps
- Avoid fake overpromising
- Explain what is happening

Example processing steps:

- Reading your material
- Finding key topics
- Building lessons
- Creating quiz questions
- Preparing AI tutor context

---

## Lesson Page

The lesson page should feel like a clean reading workspace.

### Structure

- Lesson title
- Source material reference
- Topic summary
- Key concepts
- Main explanation
- Examples
- Quick check questions
- Related flashcards
- Ask AI tutor panel

### Design Rules

- Use readable line length
- Avoid wall-of-text
- Break content into sections
- Use callout blocks for definitions
- Use examples in soft cards
- Allow students to ask follow-up questions
- Include source references where possible

### Lesson Callout Types

```txt
Definition: info-soft
Important: primary-soft
Example: surface-soft
Warning: warning-soft
Exam Tip: mastery-soft
AI Explanation: ai-subtle
```

---

## Quiz Experience

Quiz UI should be focused and low-stress.

### Quiz Question Layout

Each question should show:

- Progress indicator
- Question number
- Difficulty badge
- Question text
- Answer options
- Submit button
- Explanation after answer

### Answer States

Correct:

- Success-soft background
- Success border
- Clear explanation

Incorrect:

- Error-soft background
- Error border
- Show correct answer
- Explain why the selected answer was wrong

Partial / Review:

- Warning-soft background
- Encourage revision

### Quiz Results Page

Show:

- Score
- Strengths
- Weak topics
- Recommended revision
- Questions to retry
- CTA: Review weak topics
- CTA: Generate another quiz

Do not only show the score. Help the student know what to do next.

---

## Flashcard Experience

Flashcards should feel simple, fast, and repeatable.

### Flashcard Design

- Large centered card
- Front: question or concept
- Back: answer, explanation, example
- Flip animation should be subtle
- Keyboard shortcuts supported if possible
- Progress count visible

### Flashcard States

- New
- Learning
- Needs review
- Mastered

### Review Buttons

Use clear labels:

- Again
- Hard
- Good
- Easy

Keep the interaction fast and distraction-free.

---

## AI Tutor Experience

The AI Tutor should feel like a calm study partner.

### AI Tutor Layout

Can appear as:

1. Full AI Tutor page
2. Right-side panel inside lesson page
3. Floating helper inside quiz review
4. Contextual Ask about this card

### AI Tutor Design

- Warm AI accent
- Clear message bubbles
- Source-aware responses
- Suggested follow-up questions
- Explain simpler action
- Give example action
- Quiz me on this action

### AI Tutor Rules

The tutor should:

- Explain clearly
- Use the uploaded material as context
- Avoid sounding too robotic
- Encourage understanding
- Break complex ideas into steps
- Offer examples
- Help students revise weak areas

The tutor should not:

- Overwhelm students
- Use unnecessary jargon
- Pretend to know unsupported source content
- Make the UI feel like a generic chatbot

---

## Progress and Mastery

Progress should motivate without creating pressure.

### Progress Dashboard

Show:

- Study streak
- Materials completed
- Lessons completed
- Quiz average
- Weak topics
- Strong topics
- Exam readiness score
- Recommended next study action

### Mastery States

```txt
0-25%: Getting started
26-50%: Building understanding
51-75%: Almost ready
76-90%: Strong
91-100%: Exam ready
```

Use mastery color carefully. Avoid making low progress feel like failure.

---

## Empty States

Empty states should be useful and encouraging.

### Dashboard Empty State

Title:

Start by uploading your first study material.

Body:

ChewnPour will turn your notes, PDFs, or slides into lessons, quizzes, flashcards, and an AI tutor session.

CTA:

Upload material

### Quiz Empty State

Title:

No quizzes yet.

Body:

Generate a quiz from your uploaded material to test your understanding.

CTA:

Generate quiz

### Flashcards Empty State

Title:

No flashcards yet.

Body:

Create flashcards from your lesson topics and review them before your exam.

CTA:

Create flashcards

---

## Motion

Use subtle motion only.

Good motion:

- Card hover lift
- Flashcard flip
- Smooth panel open
- Upload progress
- AI typing indicator
- Gentle completion animation

Avoid:

- Excessive bouncing
- Distracting gradients
- Heavy animation on study pages
- Constant motion during reading

Respect reduced-motion settings.

---

## Accessibility Rules

ChewnPour must be accessible by default.

Requirements:

- Strong text contrast
- Keyboard navigable components
- Visible focus states
- Clear labels for icons
- Do not rely on color alone
- Use semantic HTML
- Provide loading and error messages
- Avoid tiny text
- Ensure quiz answers are screen-reader friendly
- Support reduced motion

Focus ring:

```css
--focus-ring: 0 0 0 3px rgba(217, 119, 6, 0.28);
```

---

## Responsive Design

### Desktop

Use:

- Sidebar navigation
- Main workspace
- Optional right AI panel

### Tablet

Use:

- Collapsible sidebar
- Two-column cards
- AI tutor as slide-over panel

### Mobile

Use:

- Bottom navigation or collapsed menu
- Single-column cards
- Full-screen AI tutor
- Large tap targets
- Sticky primary action where needed

Mobile study flows should feel natural:

- Upload
- Read lesson
- Take quiz
- Review flashcards
- Ask AI tutor

---

## Page Templates

### Student Dashboard

Sections:

1. Welcome header
2. Continue studying card
3. Upload material CTA
4. Recent materials
5. Today's recommended study action
6. Quiz performance
7. Weak topics
8. Flashcards due for review

Tone:

Helpful and focused.

### Materials Page

Sections:

1. Search and filters
2. Upload button
3. Material cards/list
4. Processing statuses
5. Empty state
6. File actions

Filters:

- All
- Processing
- Ready
- Lessons generated
- Quizzes generated
- Recently studied

### Lesson Page

Sections:

1. Lesson title
2. Source reference
3. Summary
4. Concepts
5. Explanation
6. Examples
7. Quick check
8. AI tutor panel

### Quiz Page

Sections:

1. Quiz setup
2. Question flow
3. Answer feedback
4. Results
5. Weak topic recommendations

### Flashcards Page

Sections:

1. Deck selection
2. Review mode
3. Card flip interaction
4. Mastery buttons
5. Review summary

### AI Tutor Page

Sections:

1. Tutor header
2. Material selector
3. Chat area
4. Suggested prompts
5. Source references
6. Study actions

Suggested prompts:

- Explain this in simple terms
- Give me an example
- Quiz me on this topic
- Summarize this lesson
- What should I revise next?

---

## Copywriting Rules

Use simple, direct student-friendly language.

Say:

- Upload material
- Generate quiz
- Continue studying
- Review weak topics
- Ask AI tutor
- You are almost ready

Avoid:

- Ingest document
- Leverage generated pedagogical outputs
- Initialize learning object
- Optimize assessment pipeline

Tone:

- Clear
- Encouraging
- Calm
- Practical
- Not childish

---

## UI Quality Checklist

Every generated screen should pass this checklist:

- Is the main action obvious?
- Is the page calm and readable?
- Does the student know what to do next?
- Are learning states clear?
- Is the AI tutor contextual?
- Are empty states helpful?
- Are errors explained clearly?
- Is mobile usable?
- Is the design unique to ChewnPour?
- Does it avoid directly copying Notion, Claude, Khan Academy, or Quizlet?

---

## Implementation Guidance for AI Coding Agents

When building ChewnPour UI:

1. Follow this DESIGN.md first.
2. Use reusable components.
3. Use semantic tokens instead of random colors.
4. Keep the interface calm and spacious.
5. Prioritize learning clarity over decoration.
6. Use AI features as helpers, not visual gimmicks.
7. Make every screen answer: What should the student do next?
8. Do not copy existing product layouts exactly.
9. Build with accessibility and responsiveness from the start.
10. Maintain consistent spacing, radius, typography, and component behavior across all pages.
