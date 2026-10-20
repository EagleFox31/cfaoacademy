---
name: ux-ui-best-practices
description: Modern UX/UI best practices (2025-2026) for public-facing and enterprise products. Use when designing, reviewing, or building any frontend UI — pages, components, layouts, design tokens, accessibility, dashboards, or onboarding flows. Encodes the CFAO Academy 3-tier architecture: sober homogeneous Accueil (front door), role-based Hub/Portail launcher (vitrine, not an app), and future SaaS apps (where bento + command palette + cockpit density live). No dark mode.
license: MIT
metadata:
  author: CFAO Academy
  version: "1.0.0"
  date: June 2026
  abstract: Curated, source-backed UX/UI guidance synthesizing 2025-2026 trends and standards from SaaS design leaders, Awwwards, GOV.UK / USWDS government design systems, and WCAG 2.2. Organized as actionable rules across visual design, enterprise patterns, accessibility, and motion — prioritized for a hybrid public + enterprise platform.
---

# Modern UX/UI Best Practices (2025-2026)

Curated, source-backed guidance for designing public-facing and enterprise UI.

## CFAO Academy architecture — 3 tiers (read this first)

Each tier has a *different* rubric. Don't apply app patterns to the entrance, or showcase patterns to apps.

1. **Accueil** — the public **front door**. Must be **sober, standards-compliant, and homogeneous** (GOV.UK register) so it reads cleanly for *bureaucrats AND clients*. Uniform grids are a *feature* here. **No bento, no command palette, no flashy motion.** Judge on: clarity, consistency, accessibility.
2. **Hub / Portail** — a **role-based vitrine / launcher**, **NOT an app**. A personalized landing that surfaces what the profile can access and **links out to the future apps**. Judge on: role-based relevance, clean scannable entry points, clarity. Keep it light (Nav/Footer chrome is fine — it's a vitrine, not a cockpit).
3. **Apps (future, SaaS)** — the real applications launched from the hub. **This is where bento grids, command palette (⌘K), cockpit density, dashboards, and power-user patterns live.** The `/portail/delivery` cockpit is the reference for this tier ([[feedback_cockpit_vraie_app]]).

Client constraints: **no dark mode** requested. Bilingual always ([[feedback_portal_bilingue]]).

## When to Apply

Reference this skill when:
- Building or reviewing any frontend page, component, or layout
- Defining design tokens, color palettes, typography, or dark mode
- Designing dashboards, data viz, forms, or onboarding flows
- Auditing UI against accessibility (WCAG 2.2) or government-grade clarity standards
- Deciding whether a visual trend (glassmorphism, bento, motion) fits a given surface

## Core Principles (always)

1. **Clarity > creativity.** Reduce cognitive load. Make interactions predictable via a design system. Complexity should *feel* simple and stable.
2. **Progressive disclosure.** Don't remove powerful features — *sequence* them. Simple canvas first; advanced features revealed as the user levels up.
3. **Calm interfaces.** Remove clutter, limit decisions, prioritize white space and smart defaults. End of visual theatrics.
4. **"Get in, do the task, get out."** Enterprise UX = productivity. No decorative friction on tool screens.
5. **Accessibility by default**, baked into tokens — not a final audit. (Mirrors the project's default-deny / shift-left security posture.)

## Rule Categories

| Priority | Category | Applies to | File |
|----------|----------|-----------|------|
| 1 | Accessibility & standards (WCAG 2.2) | Everything | `references/accessibility.md` |
| 2 | Enterprise / SaaS patterns | Cockpit, portail | `references/enterprise-patterns.md` |
| 3 | Visual design & trends | Vitrine + cockpit | `references/visual-trends.md` |
| 4 | Motion & micro-interactions | Everything | `references/motion.md` |
| 5 | Benchmarks & inspiration | Discovery / direction | `references/benchmarks.md` |

## Quick Decision Guide

- **Accueil (front door)?** → sober + homogeneous, hero in a glass-panel, consistent uniform grids, restrained scroll motion, GOV.UK-grade clarity. **No** bento / **no** ⌘K. See `visual-trends.md` + `accessibility.md`.
- **Hub / portail (role-based launcher)?** → personalized by profile, clean scannable entry points to apps, progressive disclosure, role-based content. It's a vitrine, not a cockpit — keep it light. See `enterprise-patterns.md`.
- **App / cockpit tool screen (future SaaS)?** → bento, command palette (⌘K), card dashboards, dense sidebar+topbar, power-user patterns. See `enterprise-patterns.md`.
- **New color or component?** → semantic token pairs that pass WCAG AA *by default*, focus visible, 44px targets. (No dark mode required by client.) See `accessibility.md`.
- **Adding motion?** → purposeful only; guide attention, give feedback, respect reduced-motion. See `motion.md`.

## Project guardrails (CFAO Academy)

- Hero text always inside a `.glass-panel`, never raw on the background.
- Glassmorphism only on nav/modals/panels — not everywhere.
- Bilingual from the start (`useLocale` + i18n) — never hardcoded FR strings.
- **No dark mode** (client decision) — single light theme.
- **Tier discipline:** Accueil = sober/homogeneous front door; Hub = role-based vitrine/launcher (not an app); bento + ⌘K + cockpit density belong to the **future apps only**.
- Real app/cockpit screens (e.g. `/portail/delivery`) get a dedicated dense shell (sidebar + topbar), not vitrine `pv-*` components.

## Sources

See `references/benchmarks.md` for the full source list (SaaS design leaders, Figma, Awwwards, GOV.UK, USWDS, W3C WCAG 2.2).
