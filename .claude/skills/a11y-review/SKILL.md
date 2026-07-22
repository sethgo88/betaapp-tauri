---
name: a11y-review
description: Deep, on-demand WCAG 2.2 accessibility review. Opens the real dev server in Chromium via Playwright, runs axe-core against the live DOM, and does an LLM-driven read for judgment-based criteria axe-core can't catch (focus order, dialog behavior, meaningful sequence). Use when asked to review, audit, or check accessibility/WCAG for a view, component, or the whole app — not for routine lint (Biome's `a11y` rules already run on every `pnpm lint`).
---

# /a11y-review

This skill is the deep, on-demand half of the project's accessibility workflow (the other half is the
Biome `a11y` lint rule block in `biome.json`, which runs automatically on every `pnpm lint` and catches
static/structural issues only). Reach for this skill when static linting isn't enough — anything that
requires actually rendering the page and reasoning about behavior: focus order, dialog semantics, contrast
as rendered, keyboard operability, screen-reader announcement of dynamic content.

Target: **WCAG 2.2 Level AA is required.** Note AAA criteria in findings too, but label them as stretch —
see `docs/accessibility.md` for the full criteria table, per-criterion effort/rationale, and which AAA
items are worth doing anyway.

## Two modes

**Targeted** (default, fast) — review one view or one component in context, e.g. "run /a11y-review on
ConfirmDeleteDialog" or "check AddClimbView." Use after making UI changes, before opening a PR that
touches `src/components` or `src/views`.

**Full-sweep** (slow, periodic) — walk every primary view and every modal/sheet in the app. Use for the
initial baseline audit, before a release, or when asked for a full accessibility audit.

## How to run it

### 1. Get a live page to inspect

Check whether the dev server is already running (`curl -s -o /dev/null -w '%{http_code}' http://localhost:1420/`).
If not, start it in the background: `pnpm dev` (binds `--host`, serves at `http://localhost:1420`,
independent of the Android WebView shell — this is a real browser target).

### 2. Drive Chromium with Playwright, reusing the shared axe helper

Do not run `playwright install` — a browser is pre-installed and `axe-helper.mjs` in this skill's
directory already resolves the correct executable path. Write a short one-off Node script (ESM) per
review, since the interaction needed (open a modal, submit a form with an error, tab through fields)
differs per component/view and can't be captured in one static script. Example:

```js
import { launchChromium, runAxe } from "./.claude/skills/a11y-review/axe-helper.mjs";

const browser = await launchChromium();
const page = await browser.newPage();
await page.goto("http://localhost:1420/", { waitUntil: "networkidle" });

// Drive the app into the state you're reviewing, e.g.:
// await page.getByRole("button", { name: "Delete" }).click();  // open ConfirmDeleteDialog
// await page.keyboard.press("Tab");                             // check focus order

const report = await runAxe(page); // { violationCount, violations: [{ id, impact, level, wcagSc, help, targets }], ... }
console.log(JSON.stringify(report, null, 2));
await browser.close();
```

Run it with `node <script>.mjs` from the repo root (needed for module resolution) — put throwaway
scripts in your scratchpad, not the repo.

`runAxe()` returns each violation's WCAG level (`A`/`AA`/`AAA`/`best-practice`) and SC number(s) derived
from axe-core's tags, plus the CSS selector(s) of affected nodes and a `helpUrl`. Treat `best-practice`
findings (e.g. `landmark-one-main`, `page-has-heading-one`) as real but non-WCAG — note them separately.

Some views require auth or specific app state to reach (most of this app is behind login). If you can't
get a view into the target state without real credentials, say so explicitly in the report rather than
skipping it silently — fall back to a static code read of that component/view instead.

### 3. Do the judgment-based read axe-core can't automate

axe-core catches maybe 30–40% of WCAG issues — the structural/computable ones (missing alt text, invalid
ARIA, contrast ratios of rendered text). It does **not** catch:

- Whether focus order matches visual/reading order (2.4.3)
- Whether a modal actually traps focus and returns it on close (2.1.2, 2.4.3)
- Whether dynamic content (toasts, validation errors) is announced without moving focus (4.1.3)
- Whether error messages are specific enough to be useful (3.3.1, 3.3.3)
- Whether the tab/interaction sequence is "meaningful" for a screen-reader user (1.3.2)

For these, read the component/view source directly and reason through the criteria manually — this is
where the LLM pass adds value beyond the axe scan. Cross-reference against the WCAG 2.2 AA table in
`docs/accessibility.md`.

## Output format

For each finding:

```
[WCAG 2.2 SC #.#.# Name] — Level A/AA/AAA — <file(s)>
Status: fail | needs-review
<one-line description of the problem>
Proposed fix: <concrete change, e.g. "add role=dialog + aria-modal to Sheet.tsx:42">
```

Group findings by file/component. End with a one-line summary count (e.g. "6 AA fails, 2 AAA stretch
notes, 1 best-practice"). Do not silently fix anything found during a review — report first; fixes happen
as a separate, explicit step (this mirrors the project's PR/issue workflow in `CLAUDE.md`).

## Reference

- `docs/accessibility.md` — WCAG 2.2 AA criteria table (required), AAA stretch table (effort + rationale),
  and validated color-contrast ratios for the design tokens in `src/components/README.md`.
- Components already doing this right, useful as in-repo reference patterns: `CompassPicker.tsx`,
  `StarRating.tsx` (custom ARIA widgets with keyboard support), `ClimbImageGallery.tsx` (dialog semantics).
