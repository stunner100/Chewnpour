## Summary

Introduces 10 new animated UI components inspired by Watermelon UI (a shadcn/ui registry), built with the project's existing `motion` dependency and `cn` utility. No new dependencies added.

## New Components (all in `src/components/watermelon/`)

| Component | What it does |
|---|---|
| `WatermelonTabs` | Tab bar with spring-animated sliding indicator using `layoutId` |
| `WatermelonSonner` | Global toast system (success/error/warning/info), auto-dismiss, stacked with `AnimatePresence` |
| `WatermelonChoiceChips` | Selectable filter pill buttons with icons, single/multi-select |
| `WatermelonDisclosure` | Collapsible sections with animated height + chevron rotation |
| `WatermelonDialog` | Modal overlay with scale-in entrance, backdrop blur, Escape to close |
| `WatermelonCarousel` | Slide container with auto-play, prev/next arrows, pagination dots |
| `WatermelonWidgets` | Dashboard stat cards with hover lift and accent-colored gradient glow |
| `WatermelonScheduler` | Visual timeline with time-grouped items, priority dots, status icons |
| `WatermelonFilters` | Filter bar with grouped pill options, count badges, clear-all action |
| `WatermelonCombobox` | Searchable dropdown with keyboard navigation, autocomplete |

## Integrations

- **TopicDetail** — study mode selector upgraded to `WatermelonTabs` (Full, Summary, Quiz, Flashcards, Podcast)
- **DashboardLayout** — `WatermelonToaster` mounted globally; `WatermelonCombobox` "Quick jump" in sidebar
- **DashboardSearch (Library)** — `WatermelonChoiceChips` for file type filtering; `WatermelonFilters` bar with counts + clear-all
- **CourseFoldersSection** — folder expand/collapse upgraded to `WatermelonDisclosure`
- **DashboardAnalysis** — delete confirmation modal replaced with `WatermelonDialog`; `WatermelonCarousel` shows recently studied courses
- **ProgressSnapshot** — stat tiles replaced with `WatermelonWidgets` (Streak, Podcasts, Mastered, Uploads)
- **TodayStudyPlan** — visual timeline via `WatermelonScheduler` added below the existing list
- **Toast.jsx** — legacy toast shim now renders `WatermelonToaster`

## Testing

- `npm run lint` passes
- `npm run build` succeeds
- `dashboard-library-regression.test.mjs` passes
- `dashboard-processing-lazy-recovery-regression.test.mjs` passes
- `landing-page-redesign-regression.test.mjs` passes (33/33)
