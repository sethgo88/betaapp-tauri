# Accessibility

## Overview

BetaApp targets **WCAG 2.2 Level AA** as the required conformance level, across both the Android WebView
build and the browser-based web target (`feat/web-platform-support`, see `docs/web-feasibility.md`) — the
same React components render on both, so a fix made once covers both platforms. Level AAA criteria are
tracked separately as stretch goals: worth doing where cheap, documented with effort and rationale where
not, but not required to ship.

Maintained via three layers (tracked in issue #237):

1. **Static, automatic** — the explicit `a11y` rule block in `biome.json` runs on every `pnpm lint`. Catches
   structural issues: missing alt text, invalid ARIA, non-semantic interactive elements, missing button
   types, etc.
2. **On-demand, deep, browser-based** — the `/a11y-review` skill (`.claude/skills/a11y-review/`). Opens the
   real dev server (`pnpm dev`, `localhost:1420`) in Chromium via Playwright, runs axe-core against the live
   DOM, and does an LLM-driven WCAG 2.2 read for judgment-based criteria axe-core can't catch (focus order,
   dialog behavior, meaningful sequence). Run it after UI changes and before releases.
3. **This document** — the criteria table below is the shared reference both layers check against.

A `PostToolUse` hook (`.claude/hooks/a11y-lint.sh`) also runs Biome's `a11y` rules on every `.tsx` edit and
surfaces violations back into the session immediately — non-blocking (hooks can't undo an edit that already
happened), just fast feedback without waiting for `pnpm lint`.

**Caveat on this pass:** the live-browser layer (`/a11y-review`, axe-core) requires `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` (see `.env.example`) to boot past the auth check — without them the app throws on
load and every route renders blank, which axe-core would misreport as missing landmarks/headings rather than
a real finding. That happened during this pass; those two rows are marked `needs-review`, not `fail`, until
someone with real (or local Supabase) credentials re-runs the skill against a fully-booted app. Most routes
also require an authenticated session (`beforeLoad: requireAuth`) to reach at all — only `/profile`,
`/settings`, `/reset-password`, and `/auth/callback` are reachable unauthenticated. The status table below is
therefore built mainly from direct source review (see issue #237's linked research), not a full live sweep;
re-running `/a11y-review` with real credentials is the natural next step to convert `needs-review` rows below
to `pass`/`fail`.

## WCAG 2.2 Level A & AA criteria (required)

Status reflects what's known as of the initial foundation pass (2026-07-22) — `pass` means broadly
satisfied by existing patterns, `partial` means satisfied in some places but not others, `fail` means a
known gap, `needs-review` means not yet verified. See issue #237 and its sub-issues for tracked remediation.

### Perceivable

| SC | Name | Level | Status | Notes |
|---|---|---|---|---|
| 1.1.1 | Non-text Content | A | partial | Biome's `useAltText`/`noRedundantAlt` enforce this on new code; sweep existing images/icons in full audit |
| 1.2.1–1.2.5 | Audio/video alternatives, captions | A/AA | n/a | No audio/video content in the app today |
| 1.3.1 | Info and Relationships | A | pass | `FormField` uses real `label htmlFor`; modals now have `aria-labelledby`/`aria-label` (issue #242, fixed) |
| 1.3.2 | Meaningful Sequence | A | needs-review | Verify via `/a11y-review` per view |
| 1.3.3 | Sensory Characteristics | A | needs-review | Check instructions don't rely solely on color/shape ("the green button") |
| 1.3.4 | Orientation | AA | pass | No orientation lock; Android + web both support rotation |
| 1.3.5 | Identify Input Purpose | AA | pass | `autoComplete` wired on all email/password inputs in `ProfileView`/`ResetPasswordView` (`email`, `current-password`, `new-password`) |
| 1.4.1 | Use of Color | A | needs-review | Status badges (`text-sent`/`text-project`/`text-todo`) — confirm not color-only |
| 1.4.2 | Audio Control | A | n/a | No auto-playing audio |
| 1.4.3 | Contrast (Minimum) | AA | partial | `text-text-tertiary` and `border-border-input` fixed; white button text on `bg-accent-primary`/`bg-accent-secondary` still fails — needs a design decision (color vs. weight/size), see [Contrast validation](#contrast-validation) below, issue #245 |
| 1.4.4 | Resize Text | AA | pass | Tailwind rem-based sizing, no viewport zoom lock |
| 1.4.5 | Images of Text | AA | pass | No images of text used for UI copy |
| 1.4.10 | Reflow | AA | needs-review | Verify no horizontal scroll at 320px width on web target |
| 1.4.11 | Non-text Contrast | AA | pass | `border-border-input` darkened to `#9d8366` (3.32:1); `border-border-default` left as-is — used decoratively, not as a required UI-component boundary (issue #245, fixed) |
| 1.4.12 | Text Spacing | AA | needs-review | Verify no clipping when user overrides line-height/letter-spacing |
| 1.4.13 | Content on Hover or Focus | AA | needs-review | Check tooltips/popovers (`SiblingDropdown`, popover pins in `ClimbImageViewer`) are dismissible/hoverable |

### Operable

| SC | Name | Level | Status | Notes |
|---|---|---|---|---|
| 2.1.1 | Keyboard | A | pass | Modal/sheet focus trap added via `useDialogA11y` (issue #242, fixed); custom widgets (`CompassPicker`, `StarRating`) already keyboard-operable — use as reference |
| 2.1.2 | No Keyboard Trap | A | pass | `useDialogA11y`'s trap is exitable via Escape (calls `onClose`), not a hard trap |
| 2.1.4 | Character Key Shortcuts | A | n/a | No single-character keyboard shortcuts in the app |
| 2.2.1 | Timing Adjustable | A | n/a | No session/content timeouts requiring user action |
| 2.2.2 | Pause, Stop, Hide | A | pass | No auto-updating content except `Toast` (auto-dismiss, non-essential) |
| 2.3.1 | Three Flashes or Below Threshold | A | pass | No flashing content |
| 2.4.1 | Bypass Blocks | A | n/a | Single-view SPA per route, no repeated block of nav links to skip |
| 2.4.2 | Page Titled | A | needs-review | Title is static (`<title>BetaApp</title>`); verify it updates per route once web target ships |
| 2.4.3 | Focus Order | A | needs-review | Verify via `/a11y-review` per view, especially forms (`ClimbForm`) |
| 2.4.4 | Link Purpose (In Context) | A | pass | Route/beta links use descriptive text, not "click here" |
| 2.4.5 | Multiple Ways | AA | n/a | Not applicable to this app's flat, task-focused navigation |
| 2.4.6 | Headings and Labels | AA | needs-review | Re-run `/a11y-review` against a fully-booted app (see caveat below) to check landmark/heading structure per view |
| 2.4.7 | Focus Visible | AA | needs-review | No custom focus-ring overrides found (relies on browser default) — verify it's not suppressed anywhere |
| 2.4.11 | Focus Not Obscured (Minimum) | AA | needs-review | Check bottom sheets/toasts don't cover a focused element |
| 2.5.1 | Pointer Gestures | A | pass | No multi-point/path-based gestures required (drag-to-draw in `TopoBuilder` has no simple-pointer alternative — flag as needs-review, admin-only feature) |
| 2.5.2 | Pointer Cancellation | A | needs-review | Verify tap actions fire on `up`, not `down`, so accidental taps can be aborted |
| 2.5.3 | Label in Name | A | pass | Visible button/icon labels match their `aria-label`s where checked (`StarRating`, `CompassPicker`) |
| 2.5.4 | Motion Actuation | A | n/a | No device-motion-triggered actions |
| 2.5.7 | Dragging Movements | AA | needs-review | `TopoBuilder` draw mode is drag-based, admin-only — evaluate a tap-based alternative |
| 2.5.8 | Target Size (Minimum) | AA | pass | `Button` enforces `min-h-[48px] min-w-[48px]`, exceeding the 24×24 CSS px minimum |

### Understandable

| SC | Name | Level | Status | Notes |
|---|---|---|---|---|
| 3.1.1 | Language of Page | A | pass | `index.html` sets `<html lang="en">`; Biome's `useHtmlLang` now enforces this going forward |
| 3.1.2 | Language of Parts | AA | n/a | No mixed-language content |
| 3.2.1 | On Focus | A | partial | Intentional `autoFocus` on a few search inputs (`SubRegionView`, `RegionView`, `CragView`, `EditableDescription`) is a conscious UX tradeoff — confirm it doesn't unexpectedly shift context |
| 3.2.2 | On Input | A | pass | No unexpected context changes on input, per component read |
| 3.2.3 | Consistent Navigation | AA | pass | `NavBar`/`AppLayout` consistent across views |
| 3.2.4 | Consistent Identification | AA | pass | Shared atoms/molecules used consistently (`Button`, `ConfirmDeleteDialog`, etc.) |
| 3.2.6 | Consistent Help | AA | n/a | No help mechanism yet to be consistent about |
| 3.3.1 | Error Identification | A | pass | `Input` sets `aria-invalid`; `FormField` clones its child with `aria-invalid`/`aria-describedby` pointing at the error message (issue #243, fixed) |
| 3.3.2 | Labels or Instructions | A | pass | `FormField` always renders a real `<label>` |
| 3.3.3 | Error Suggestion | AA | needs-review | Check Zod error messages are specific enough to act on |
| 3.3.4 | Error Prevention (Legal, Financial, Data) | AA | pass | `ConfirmDeleteDialog` required for all destructive deletes per `CLAUDE.md` |
| 3.3.7 | Redundant Entry | AA | pass | No multi-step flows re-requesting the same data |
| 3.3.8 | Accessible Authentication (Minimum) | AA | needs-review | Verify password field allows paste/password managers (no copy-block) |

### Robust

| SC | Name | Level | Status | Notes |
|---|---|---|---|---|
| 4.1.2 | Name, Role, Value | A | pass | `Sheet`, `ConfirmDeleteDialog`, `AddLinkModal`, `Drawer`, `TopoModal` now have `role="dialog"`/`aria-modal` (issue #242, fixed); `Sheet` covers 6 further consumers (`LogClimbSheet`, `RouteDataModal`, `RoutePickerSheet`, `SunShadeSheet`, `ImportBetaSheet`, `TopoBuilder`) automatically |
| 4.1.3 | Status Messages | AA | pass | `Toast` now has `role="status"`/`"alert"` + `aria-live` (issue #244, fixed) |

(4.1.1 Parsing is obsolete as of WCAG 2.2 and omitted.)

## Level AAA (stretch — not required)

Not required for release, but listed with effort and rationale so they can be picked up opportunistically.
Media-specific AAA criteria (1.2.6, 1.2.7, 1.2.8, 1.2.9 — sign language, extended audio description, etc.)
are omitted as not applicable (no audio/video content).

| SC | Name | Effort | Why it might be worth it |
|---|---|---|---|
| 1.4.6 | Contrast Enhanced (7:1) | Low | `text-text-primary` already passes at 14–15:1; only `text-text-tertiary` and status colors would need adjusting once fixed for AA anyway |
| 1.4.8 | Visual Presentation | Medium | User-controlled line spacing/width for long text (route descriptions, beta notes) — genuinely useful for climbers reading beta outdoors in bright light |
| 1.4.9 | Images of Text (No Exception) | Low | Already satisfied — no images of text in use |
| 2.1.3 | Keyboard (No Exception) | Medium | Depends on fixing `TopoBuilder`'s drag-only drawing (2.5.7) — same underlying work |
| 2.2.3 | No Timing | Low | No timing-dependent content exists; keep this true as features are added |
| 2.4.8 | Location | Low | Breadcrumb/"you are here" in location drill-down (`RegionView` → `CragView` → `WallView`) — climbers navigating deep hierarchies would benefit |
| 2.4.9 | Link Purpose (Link Only) | Low | Likely already true given descriptive link text found in review |
| 2.4.10 | Section Headings | Low | Natural fit once 2.4.6 (Headings and Labels) is fixed at the AA level |
| 2.4.13 | Focus Appearance | Medium | Stronger focus-ring styling (thicker, higher contrast) than browser default — worth it if 2.4.7 review finds the default insufficient |
| 2.5.5 | Target Size Enhanced (44×44) | Low | `Button`'s existing `min-h-[48px]` already clears this bar; mainly relevant for icon-only buttons (close buttons, etc.) — audit those specifically |
| 3.1.3–3.1.6 | Unusual words, abbreviations, reading level, pronunciation | High | Climbing grade/route terminology is domain jargon by nature; low value for a niche app used by climbers who already know the vocabulary |
| 3.3.5 | Help | Medium | No contextual help system exists yet; worth revisiting once the app has enough surface area to need it |
| 3.3.6 | Error Prevention (All) | Medium | Extends 3.3.4 to all data-entry forms, not just legal/financial/deletion — natural follow-on once `ConfirmDeleteDialog` coverage is confirmed complete |
| 3.3.9 | Accessible Authentication (Enhanced) | Low | Depends on Supabase auth flow specifics — revisit if magic-link auth (planned) changes the login flow |

## Contrast validation

Computed from the hex values in `src/components/README.md` using the WCAG relative-luminance formula.
Required: **4.5:1** for normal text, **3:1** for large text (≥18pt / ≥14pt bold) and non-text UI component
boundaries (SC 1.4.11).

| Pair | Ratio | AA normal text | AA large text / UI |
|---|---|---|---|
| `text-text-primary` (`#2a2420`) on `bg-surface-page` (`#faf6f1`) | 14.23:1 | Pass | Pass |
| `text-text-primary` on `bg-surface-card` (`#ffffff`) | 15.31:1 | Pass | Pass |
| `text-text-primary` on `bg-surface-nav` (`#f5efe8`) | 13.41:1 | Pass | Pass |
| `text-on-light` (`#1a1a1a`) on `bg-surface-page` | 16.18:1 | Pass | Pass |
| `text-text-tertiary` (was `#a8a29e`, now `#6b6460`) on `bg-surface-page` | 5.40:1 | Pass | Pass |
| `text-text-tertiary` on `bg-surface-card` | 5.81:1 | Pass | Pass |
| `text-text-tertiary` on `bg-surface-hover` | 4.82:1 (worst case) | Pass | Pass |
| **White text on `bg-accent-primary` (teal-600, `#0d9488`)** | **3.74:1** | **Fail** | **Pass** |
| **White text on `bg-accent-secondary` (amber-600, `#d97706`)** | **3.19:1** | **Fail** | **Pass** |
| `text-sent` (`#3e6d40`) on `bg-surface-page` | 5.63:1 | Pass | Pass |
| `text-project` (`#b8482a`) on `bg-surface-page` | 4.88:1 | Pass | Pass |
| `text-todo` (`#1f72a6`) on `bg-surface-page` | 4.86:1 | Pass | Pass |
| `border-border-input` (was `#d4c9bc`, now `#9d8366`) on `bg-surface-page` | 3.32:1 | n/a | Pass (1.4.11) |
| `border-border-default` (`#e0d6ca`) on `bg-surface-page` | 1.33:1 | n/a | Not required — decorative divider, not a UI-component boundary |

**Fixed (issue #245):**
- `text-text-tertiary` darkened from `#a8a29e` to `#6b6460` (same warm-gray hue, same lightness family) — passes 4.5:1+ against every background it's used on. Applied to the active `.light` theme in `src/App.css`; the currently-unused dark theme block has the same underlying issue and should get the equivalent fix if/when a dark preset ships.
- `border-border-input` darkened from `#d4c9bc` to `#9d8366` — passes 3:1 against form-input backgrounds (SC 1.4.11 applies to it as a UI-component boundary). `border-border-default` was left unchanged — it's used for decorative dividers/card borders, not boundaries needed to identify a UI component, so 1.4.11 doesn't apply to it the same way.

**Still open — needs a design decision, not just a recompute:**
- White button text on `bg-accent-primary`/`bg-accent-secondary` fails AA for normal text (3.74:1 / 3.19:1, need 4.5:1). Checked against `Button.tsx`: sizes are `text-sm`/`text-base`/`text-lg` (14/16/18px) at `font-semibold` (600 weight) — none of these clear the WCAG "large text" bar (18pt/24px regular, or 14pt/18.66px **bold**/700), so the 3:1 exemption doesn't apply and this is a confirmed failure, not just a maybe. Two ways to fix it, both with real design impact:
  1. Darken `--accent-primary`/`--accent-secondary` themselves (e.g. to `#0c847a`/`#b26105`, which reach ~4.56:1) — changes the brand's primary/secondary color everywhere they're used (buttons, active nav, checkboxes, badges), not just on button backgrounds.
  2. Bump button text to `font-bold` and ensure size ≥18.66px — no color change, but changes button typography app-wide.
  Left for a human call in issue #245 rather than silently recoloring the brand palette.

## Reference

- `/a11y-review` skill — `.claude/skills/a11y-review/SKILL.md`
- Biome `a11y` lint rules — `biome.json`
- Design tokens — `src/components/README.md`
- In-repo reference components already doing this right: `CompassPicker.tsx`, `StarRating.tsx` (custom ARIA
  widgets with full keyboard support), `ClimbImageGallery.tsx` (dialog semantics)
