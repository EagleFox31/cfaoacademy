# Enterprise / SaaS Patterns (Priority 2)

Applies to two distinct tiers — don't mix them:

- **Hub / portail (role-based vitrine, NOT an app):** a personalized launcher. Goal = surface the right entry points per profile and route to apps. Keep it clean and light (Nav/Footer chrome is fine). Use: role-based content, progressive disclosure, clear cards/links to apps, good empty states. **Do NOT** turn it into a dense cockpit or add ⌘K — it's a vitrine.
- **App / cockpit tool screens (future SaaS):** Goal = **productivity** — get in, do the complex task accurately, get out. Dense but calm. This is where the patterns below belong.

## Standard patterns — APP TIER ONLY (expected by 2026)

- **Command palette (⌘K)** — started in Figma/VS Code, now a *default expectation* for any **app** with 10+ features. Global search + action launcher. **Belongs in the apps, not on a blog/vitrine or the hub launcher.**
- **Role-based design** — beyond permissions: show *meaningfully different interfaces* by what the user actually does. Aligns with the project's Cerbos/RBAC. Don't just hide buttons — tailor the whole screen per role.
- **Progressive disclosure** — new users see a simple surface; advanced features appear as they level up. Sequence power, don't dump it.
- **Dashboards & data viz** — clean visualization, card-based responsive layouts, structured grids. Surface what's actionable; keep it scannable.
- **AI, transparent** — conversational output, predictive recommendations, real-time personalization — but *explainable*, never magic. Show sources/why.

## Layout & density

- Dense **sidebar + topbar** for tool screens (not showcase components). Keep the portal background.
- Persistent navigation; clear current-location indicator.
- Tables: sortable, sticky headers (mind WCAG Focus-Not-Obscured), inline actions, bulk-select.
- Empty states that teach the next action, not dead ends.

## Forms (borrow from GOV.UK)

- One thing per page for complex flows; clear question structure.
- Inline, specific error messages tied to the field; summary at top.
- Don't re-ask for info already provided (WCAG Redundant Entry).
- Smart defaults; minimize required decisions.

## Onboarding

- Simple canvas + basic tools first.
- Reveal advanced features contextually over time.
- Consistent help location across the product (WCAG Consistent Help).

Sources: [SaaSUI — 7 SaaS UI Trends 2026](https://www.saasui.design/blog/7-saas-ui-design-trends-2026) · [Fuselab — Enterprise UX Guide 2026](https://fuselabcreative.com/enterprise-ux-design-guide-2026-best-practices/) · [The Skins Factory — SaaS UI/UX 2026](https://www.theskinsfactory.com/uiux-design-blog/saas-ui-ux-design-best-practices-2026) · [GOV.UK Design System](https://design-system.service.gov.uk/)
