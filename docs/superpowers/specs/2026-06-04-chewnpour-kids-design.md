# ChewnPour Kids Design

## Summary

ChewnPour Kids is a parent-led reading and comprehension mode for young children ages 6 and up. It lives inside the existing `stitch-app` as a separate `/kids` route family, while reusing the current ChewnPour backend, authentication, upload, extraction, generation, quiz, and progress systems where practical.

The v1 product focuses on parent-uploaded worksheets, book pages, PDFs, and images. The app extracts readable text, generates a kid-friendly reading lesson, auto-publishes it to the child's dashboard, and lets the parent hide, rename, or regenerate it afterward.

## Goals

- Give parents a controlled way to turn school reading material into child-friendly lessons.
- Give children a simple, playful reading experience with short explanations, vocabulary, story recaps, and mini quizzes.
- Reuse the existing ChewnPour infrastructure instead of creating a separate product stack.
- Avoid open-ended child chat in v1.
- Keep parent controls separate from the child learning surface.

## Non-Goals

- Teacher or classroom management.
- Child-owned standalone accounts.
- Free-form child chat.
- Social, multiplayer, or sharing features.
- Separate backend, auth system, or deployment target.
- Payment model changes.

## Architecture

ChewnPour Kids will be implemented as a route family inside `stitch-app`.

Routes:

- `/kids`: public ChewnPour Kids landing page.
- `/kids/parent`: parent dashboard.
- `/kids/child/:childId`: child home screen.
- `/kids/lesson/:lessonId`: child lesson session.

Shared systems:

- Better Auth remains the parent account system.
- Convex remains the source of truth for profiles, uploads, generated lessons, quiz results, and progress.
- Existing upload and extraction workflows should be reused for PDF/image/page processing.
- Kid-specific generation should be implemented through separate prompts and structured output validation.

The main product separation is UX and authorization, not infrastructure. Parents can upload, manage profiles, hide lessons, regenerate content, and inspect progress. Children can only view assigned lessons, complete quizzes, and use bounded help buttons.

## Parent Experience

The parent dashboard includes:

- Child profile cards with name, age, reading level, and recent activity.
- Reading level setting: beginner, growing reader, or confident reader.
- Upload flow for worksheets, book pages, PDFs, and images.
- Generated lesson list with statuses: processing, published, hidden, and failed.
- Actions for each lesson: open child view, hide, regenerate, and rename.
- Progress summary: lessons completed, quiz accuracy, and words learned.

Generated lessons auto-publish when successful. Parent review is not required before the child can see the lesson, but every published lesson remains parent-manageable.

## Child Experience

The child home is intentionally small and guided.

It includes:

- Greeting and reward/star summary.
- Today's reading card.
- Completed lessons.
- Quiz games or practice entry point.

It excludes:

- Upload controls.
- Settings.
- Billing.
- Raw source extraction details.
- Free-form chat.
- Public sharing.

## Lesson Session

Each kid lesson renders as structured content:

- Story title.
- Vocabulary cards.
- Simple explanation.
- Story-style recap.
- Mini quiz.
- Safe help buttons.

Safe help buttons:

- Explain again.
- Give me an example.
- Make it a story.
- Read it easier.

Help button responses must be generated from the approved lesson content and reading level. Children do not type arbitrary chat messages in v1.

## Reading Levels

Parents choose a reading level for each child profile.

Beginner:

- Very short sentences.
- Simple words.
- More concrete examples.
- Three-question quizzes.

Growing reader:

- Short paragraphs.
- Clear vocabulary support.
- Five-question quizzes.

Confident reader:

- Fuller explanations.
- Inference questions.
- Seven-question quizzes.

Reading level affects generation prompts, lesson length, vocabulary difficulty, quiz count, and help response complexity.

## Data Model

The implementation should store kid lessons as structured data rather than a single text blob.

Core fields:

- `title`
- `readingLevel`
- `sourceUploadId`
- `vocabulary`
- `simpleExplanation`
- `storyRecap`
- `quizQuestions`
- `helpPromptResponses`
- `status`
- `childId`
- `parentUserId`

Status values:

- `processing`
- `published`
- `hidden`
- `failed`

The exact Convex schema should follow existing naming and table patterns after inspecting the current upload, course, topic, and quiz models.

## Upload And Generation Flow

1. Parent uploads a worksheet/page/PDF/image for a child profile.
2. Backend extracts readable text through the existing extraction pipeline.
3. If extraction fails or confidence is too low, the kid lesson status becomes `failed` and does not publish.
4. Kid generation creates structured reading content based on the child's reading level.
5. Successful generated content receives `published` status and appears on the child dashboard.
6. Parent can hide, rename, or regenerate the lesson.
7. Child completes the lesson and mini quiz.
8. Quiz results update child progress.

## Safety Rules

- Children cannot upload.
- Children cannot access billing or settings.
- Children cannot use free-form chat in v1.
- Generated help responses must be tied to the approved lesson content.
- Failed or low-confidence extraction must not publish.
- Parent can hide a lesson immediately.
- Kid generation should avoid adult, scary, violent, sexual, or otherwise age-inappropriate framing.
- The system should prefer simple, encouraging, concrete explanations for ages 6+.

## Implementation Scope

In scope:

- `/kids` route family.
- Parent dashboard.
- Child profiles with reading level.
- Parent upload flow.
- Kid lesson generation from extracted text.
- Auto-published generated lessons.
- Child home screen.
- Child lesson session.
- Mini quiz tracking.
- Parent hide and regenerate controls.
- Focused regression tests for generation shape and publish safety.

Out of scope:

- Teacher/classroom mode.
- Free-form child chat.
- Separate kids backend.
- Multiplayer or social features.
- Independent child login.
- Payment changes.

## Testing Plan

Add focused regression scripts under `stitch-app/scripts/` where they fit existing patterns.

Regression coverage:

- Kid lesson generation output includes all required structured sections.
- Reading level changes lesson length, vocabulary difficulty, and quiz count.
- Failed extraction does not publish a child-visible lesson.
- Hidden lessons do not appear on the child dashboard.
- Child help prompts only return bounded preset responses tied to the lesson.

Run `npm run lint` before handoff for frontend changes. Run targeted regression scripts when generation, extraction, navigation, or kid lesson visibility logic changes.
