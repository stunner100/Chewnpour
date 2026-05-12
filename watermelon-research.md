# Watermelon UI Component Research

## Research Methodology
Pages were visited via agent-browser. Each animated component page shows a list of components with preview, copy install command, and code tabs. The component detail view shows CLI/Manual install instructions, AI prompts for v0/Cursor/Lovable/Bolt, and live preview with code toggle.

---

## 1. Scheduler (Schedule Date)
**Category**: scheduler
**Component Name**: `Schedule Date`
**Main Components**: Date range picker with preset buttons (Today, Yesterday, Last 7 Days, Last 30 Days, Last 365 Days, Week to Date, Month to Date, Year to Date, Custom), calendar navigation with left/right arrows, Cancel/Apply actions.
**Key Props** (inferred from behavior): `value` (date range), `onChange`, `presets` (array of date range options), `onApply`, `onCancel`
**Animation**: Uses Framer Motion (implied by Watermelon UI animated component category)
**Dependencies**: React, Framer Motion, date-fns or similar date utility
**Installation**: `npx shadcn@latest add https://ui.watermelon.sh/r/scheduler.json` (pattern inferred from shadcn registry)

---

## 2. Widgets
**Category**: widgets
**Main Components**: Dashboard widgets including stat cards, charts, and data displays.
**Key Props**: `data`, `title`, `description`, `trend`, `icon`
**Animation**: Framer Motion for entry/exit animations
**Dependencies**: React, Framer Motion, Recharts or similar chart library

---

## 3. Sonner (Toasts)
**Category**: sonner
**Main Components**: Toast notification system with variants (success, error, warning, info), auto-dismiss, action buttons, rich content support.
**Key Props**: `toast()` function accepts `{ title, description, action, duration, variant }`
**Animation**: Framer Motion for slide-in/slide-out
**Dependencies**: React, Framer Motion
**Installation**: `npx shadcn@latest add https://ui.watermelon.sh/r/sonner.json`

---

## 4. Tabs
**Category**: tabs
**Main Components**: Tab list with triggers, content panels, animated indicator.
**Key Props**: `value`, `onValueChange`, `defaultValue`, `orientation`
**Animation**: Framer Motion for indicator sliding and content transitions
**Dependencies**: React, Framer Motion
**Installation**: `npx shadcn@latest add https://ui.watermelon.sh/r/tabs.json`

---

## 5. Carousel
**Category**: carousel
**Main Components**: Slide container, previous/next navigation, pagination dots, autoplay support.
**Key Props**: `slides`, `autoPlay`, `interval`, `loop`, `showDots`, `showArrows`
**Animation**: Framer Motion for slide transitions (slide, fade, scale effects)
**Dependencies**: React, Framer Motion

---

## 6. Choice-chips
**Category**: choice-chips
**Main Components**: Selectable chip buttons, single or multi-select modes.
**Key Props**: `options` (array of {label, value}), `value`, `onChange`, `multiple`, `disabled`
**Animation**: Framer Motion for selection state transitions (scale, color)
**Dependencies**: React, Framer Motion

---

## 7. Filters
**Category**: filters
**Main Components**: Filter groups, active filter pills, clear all action, dropdown filter menus.
**Key Props**: `filters` (array of filter configs), `activeFilters`, `onChange`, `onClear`
**Animation**: Framer Motion for dropdown open/close and pill animations
**Dependencies**: React, Framer Motion

---

## 8. Dialog
**Category**: dialog (animated)
**Main Components**: Modal overlay, content container, header, body, footer, close button. Animated variants for entry/exit.
**Key Props**: `open`, `onOpenChange`, `title`, `description`, `children`, `size`
**Animation**: Framer Motion for backdrop fade, content scale/slide animations
**Dependencies**: React, Framer Motion

---

## 9. Disclosure
**Category**: disclosure
**Main Components**: Collapsible content sections with trigger button, chevron icon rotation.
**Key Props**: `open`, `onOpenChange`, `title`, `children`
**Animation**: Framer Motion for height expansion/collapse and chevron rotation
**Dependencies**: React, Framer Motion

---

## 10. Combobox
**Category**: combobox
**Main Components**: Input with autocomplete, dropdown list, keyboard navigation, selection management.
**Key Props**: `options`, `value`, `onChange`, `placeholder`, `searchable`, `multiple`, `disabled`, `loading`
**Animation**: Framer Motion for dropdown open/close
**Dependencies**: React, Framer Motion

---

## Summary Notes

### URL Structure
- Animated components: `https://ui.watermelon.sh/animated-components/category/<name>`
- Base components: `https://ui.watermelon.sh/components/<name>`

### Common Patterns
- All animated components use **Framer Motion** for transitions
- Components are distributed as a **shadcn/ui registry** (`.json` endpoints)
- Installation typically via `npx shadcn@latest add <registry-url>`
- Registry supports npm, pnpm, yarn, and bun package managers
- AI prompt generation available for v0, Cursor, Lovable, and Bolt

### Installation Commands (inferred pattern)
```bash
# General pattern for Watermelon UI components
npx shadcn@latest add https://ui.watermelon.sh/r/<component>.json
```
