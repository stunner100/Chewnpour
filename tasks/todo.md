# Landing + Dashboard Redesign (Slate system)

Rebuild marketing landing and student dashboard to match `/redesign` (light Apple Notes / Slate aesthetic).

## Confirmed decisions
1. Scope: landing page **and** dashboard shell/home
2. Keep Free / Basic / Pro + GHS pricing, restyled to Slate Free/Pro card look
3. Bottom CTA: Start free / signup (not Download App)

## Checklist
- [x] Shared Slate tokens (white/off-white, black pills, blue #007AFF)
- [x] Public mockup assets from redesign/
- [x] Rewrite LandingPage.jsx section-by-section
- [x] Restyle DashboardLayout + AppSidebar + StudentDashboard
- [x] Update regression test for hard cutover
- [x] Lint (touched files) + verify + commit/push

## Review
Hard-cutover from dark teal landing + amber dashboard accents to Slate light system.
Landing mirrors screenshot sections; dashboard home uses Notes-like cards, pill CTAs, and blue accents.
Regression: `node scripts/landing-page-redesign-regression.test.mjs` — 31 passed.
