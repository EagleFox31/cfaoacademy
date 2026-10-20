# Accessibility & Standards — WCAG 2.2 (Priority 1)

WCAG 2.2 — W3C Recommendation (Oct 5, 2023). Four principles: **Perceivable, Operable, Understandable, Robust**. 13 guidelines with testable success criteria. For a public + enterprise platform, target **AA** as the floor.

## Hard rules (encode in design tokens)

- **Contrast**
  - Normal text: **4.5:1** (AA), 7:1 (AAA)
  - Large text (≥24px, or ≥18.66px bold): **3:1** (AA), 4.5:1 (AAA)
  - UI components & graphical objects: **3:1**
- **Touch / click targets**: ≥ **44×44 px** (WCAG 2.5.8 target size).
- **Focus visible** (2.4.7): every interactive element shows a clear focus indicator. Don't `outline: none` without a replacement.
- **Keyboard**: full navigation with Tab / Shift+Tab / Enter / Space / Escape. No keyboard traps.
- **ARIA**: correct roles, labels, and states for screen readers — only where native semantics fall short.
- **Reduced motion**: honor `prefers-reduced-motion`.

## Tokens as accessibility policy

- Define color tokens as **semantic pairs** (background ↔ foreground) that *pass contrast by default*.
- **Block** combinations that fail contrast at the token/lint level — don't rely on a final manual audit.
- Document usage rules so designers/devs pick accessible pairings without thinking.
- Treat accessibility as a **design-system policy** (tokens, patterns, governance), not a one-off check. This mirrors the project's shift-left / default-deny philosophy.

## WCAG 2.2 deltas worth knowing

WCAG 2.2 added 9 new success criteria over 2.1, notably:
- **Focus Not Obscured** (sticky headers must not hide the focused element)
- **Dragging Movements** (provide a non-drag alternative)
- **Target Size (Minimum)** — the 24×24 floor (prefer 44px)
- **Consistent Help** and **Redundant Entry** (don't re-ask for info already given)
- **Accessible Authentication** (no cognitive-test-only logins)

## Practical checklist

- [ ] All text/background pairs pass AA contrast (light theme (no dark mode required)).
- [ ] Focus states visible everywhere.
- [ ] All actions reachable by keyboard; logical tab order.
- [ ] Targets ≥ 44px on touch.
- [ ] Forms: labels, inline error messages, clear recovery (GOV.UK pattern).
- [ ] `prefers-reduced-motion` respected.
- [ ] Images have alt text; icons-only buttons have aria-labels.

Sources: [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [TestParty — Accessibility as Design System Policy](https://testparty.ai/blog/accessibility-as-design-system-policy) · [USWDS Accessibility](https://designsystem.digital.gov/documentation/accessibility/) · [Siteimprove — WCAG 2.1 vs 2.2](https://www.siteimprove.com/blog/wcag-21-vs-wcag-22/)
