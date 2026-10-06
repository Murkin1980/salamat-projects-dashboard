# UI-SKILLS EXPERIMENT — mobile usability & data resilience

Decision: `EXPERIMENT` (New Idea Filter). Owner-authorized bounded run inside the
existing `salamat-projects-dashboard` repository.

This is **not** a checkpoint. `ROADMAP.md` and `PROJECT_STATUS.md` were
deliberately not modified: no checkpoint was invented and no scope/order
changed. This document is the evidence record for the owner to accept or reject.

Status: **PASS** (scope: mobile usability + hostile-data resilience only).

---

## 1. Phase 0 — repository audit (no code modified)

Baseline git SHA: `0ba585a470a1d17dc8112ba51a9cb19530899d1d`
Implementation commit: `c499c64` · branch `arena/23bb92f8-salamat-projects-dashboard` · PR #31
Production: `https://projects.salamat-mebel.kz` (Cloudflare Pages, static, no backend).

Read: `AGENTS.md`, `docs/governance/SCOPE-CHANGE-CONTROL.md`, `README.md`,
`FOUNDATION.md`, `ARCHITECTURE.md`, `TRIAGE_RULES.md`, `CHECKPOINTS.md`,
`PROJECT_STATUS.md`, `ROADMAP.md`, `docs/VISUAL_SYSTEM.md`,
`docs/MOBILE_NODES_VIEW.md`, `.github/workflows/*`.

| Aspect | Finding |
|---|---|
| Framework | React 19 + TypeScript 5.9 + Vite 7, no UI component library |
| Styling | One hand-written stylesheet, `src/styles.css` (634 lines before this change, 737 after), CSS custom properties as tokens in `:root` |
| Design tokens | `--bg/--panel/--text/--muted/--border/--accent/--focus`, seven semantic `--status-*` pairs, `--radius-s/m/l` (`docs/VISUAL_SYSTEM.md` §5) |
| Breakpoints in use | `max-width: 1100px`, `760px`, `640px`, `420px` |
| Component structure | `DashboardApp` shell + `NodesView`/`NodeView`/`MobileNodesView`, `ReportView`, `DiscoveryView`, `ProjectDetailView`, shared `status-badges`, `history-parts` |
| Mobile-specific behavior already present | `useMediaQuery('(max-width: 760px)')` picks a dedicated `MobileNodesView` branch so React Flow is never mounted on a phone (`docs/MOBILE_NODES_VIEW.md`); sidebar collapses to a horizontal scroller; grids collapse to 1–2 columns |
| Existing tests | 216 assertions in 20 files under `tests/`, run by `tsx --test tests/**/*.test.ts`. Two DOM harnesses (jsdom + stubbed `matchMedia`) already render the real shell at 1440px and 390px |
| Existing visual/E2E tests | **None.** There is no browser-driven or screenshot test anywhere in the repository |
| Build / CI | `tsc -b && vite build`; `validate.yml` runs `npm ci`, `npm test`, `verify:snapshot`, `sync:discovery`, `npm run build` |

---

## 2. Verification method — and its hard limitation

**This sandbox has no usable browser.** Only `registry.npmjs.org` and
`github.com` are reachable; `deb.debian.org`, `storage.googleapis.com` and
Playwright's CDN are all blocked. Chromium was obtained via the npm package
`@sparticuz/chromium` and made to launch by compiling shim `libnss3`/`libnspr4`
libraries for its 44 undefined NSS symbols, but Chrome's network service crashes
against the shim, so no page could be loaded. **No pixel measurement, screenshot
or real-viewport check was possible.**

The audit therefore used a deterministic **static cascade analyzer** run outside
the repository (not committed): it parses the shipped `src/styles.css`, resolves
every rendered element's effective declarations at a given viewport width using
real cascade order (source order, later wins, `max-width` blocks only when the
viewport satisfies them) plus inheritance for inherited properties, and walks
the real rendered DOM produced by the real components in jsdom.

It reports five defect classes:

| Class | Meaning |
|---|---|
| `DECLARED_MIN_WIDTH` | declared `min-width` larger than the viewport's 292px content box with no scrollable ancestor |
| `UNBREAKABLE_NO_WRAP` | text contains a run with **no** line-break opportunity and the element (or an ancestor) has no `overflow-wrap`/`word-break` |
| `NOWRAP_NO_SCROLLER` | `white-space: nowrap` whose estimated text width exceeds the content box with no scrollable ancestor |
| `TOUCH_TARGET` | `button`/`a[href]`/`input`/`select`/`role=tab` whose resolved height (min-height, else padding + content) is under 44px |
| `HOVER_ONLY_INFO` | a `title` attribute whose content is not present in the element's text |
| `SMALL_TYPE` | resolved `font-size` below 11px on text-bearing elements |

`UNBREAKABLE_NO_WRAP` splits on whitespace **and** on `/`, `-` and `·`, because
UAX#14 allows a break there — so `Murkin1980/grand-mebel-document-control` is
correctly *not* treated as unbreakable. An earlier version of the analyzer split
on whitespace only and produced three false positives in the Experiments view;
those were removed before the baseline was recorded.

**Consequence:** every number below is a static-cascade result, not a rendered
measurement. `docs/MOBILE_NODES_VIEW.md` already states that real-device
acceptance is authoritative; that still applies and is the first thing to
confirm after this change ships.

---

## 3. Phase 1 — baseline mobile audit

Audited screens (all rendered by the real `App`): Triage `#/`, Portfolio
`#/portfolio`, Experiments `#/experiments`, Attention `#/attention`, Nodes
`#/nodes`, History & Reports `#/reports`, Discovery `#/discovery`, Project
Detail `#/project/<id>`.

Viewports: **320px, 360px, 390px, 430px** (plus 1440px as the desktop control).

Datasets: the committed runtime snapshot (`public/project-state.json`, 15
projects), one project, sixty projects, and the hostile set of §4.

Findings were **identical at 320/360/390/430px** — every defect below is caused
by a missing declaration, not by a threshold, so it reproduces at all four
widths.

### BLOCKER

**B1 — source-controlled text with no resilient wrapping widens the page.**
These elements render values taken straight from the snapshot and had no
`overflow-wrap`, while their siblings already did (`.project-meta dd.meta-repo`,
`.meta-blocker`, `.detail-row dd`, `.history-timeline article`,
`.mobile-node-card-body strong`). A single unbroken token therefore forces the
box, and with it the page, wider than the viewport:

| Element | Renders |
|---|---|
| `.project-body h2` / `p` | project name / summary (card, Triage + Portfolio) |
| `.project-meta dd` | Текущий этап / Следующее действие |
| `.attention-row strong` / `p` | project name / attention label (blocker text) |
| `.page-header h1` | project name in the detail page title (32px) |
| `.detail-head-body h2` / `p` | project name / summary in the detail head |
| `.reports-heading h2` | project name in History & Reports |

### HIGH

**H2 — primary actions below any practical touch target.** Resolved heights at
320px: `.history-timeline a` (Evidence) **14px**, `.mobile-detail-card a`
**17px**, `.detail-events a` / `.detail-history a` **16–17px**,
`.evidence-links a` **25px**, `.experiment-links a` **18px**.

**H3 — header controls crammed into one row.** `.header-actions` stays
`flex-direction: row` at every width, so at 320px the sync-state pill and the
search field share 292px (≈140px each) instead of stacking.

**H4 — provenance reachable only by hover.** `.history-provenance` shows a
7-character SHA and keeps the full 40-character evidence id only in `title`;
`.project-footer .project-source` keeps the whole source hint (the `sourceId`,
or the UNKNOWN/CONFLICT reason) only in `title`. `title` never appears on a
touch screen. `FOUNDATION.md` requires every status to be explainable from its
source evidence.

### MEDIUM

- **M1** filter/navigation controls under 44px: `.triage-tabs button` 40px,
  `.type-filters button` / `.clear-filters` / `.graph-filters select` 36px,
  `.history-filters button` 36px, `.nav-list button` 42px,
  `.sync-state button` 33px.
- **M2** iOS zoom-on-focus: `.search-box input` 14px,
  `.report-project-select select` 13px (both below the 16px threshold).
- **M3** 8–9px text on a phone: `.freshness-chip`, `.session-indicator`,
  `.mobile-node-status`, `.mobile-edge-endpoint small` (8px),
  `.mobile-detail-meta dt`, `.mobile-detail-card code`, `.detail-event-gap`,
  `.report-metrics small`, `.discovery-table td small`,
  `.nodes-project-tab small` (already reduced to 9px by the 760px block).
- **M4** `.page-header h1` stays 32px at 320px — about nine characters per line
  — while CP-16 already shrinks `.detail-head-body h2` below 760px.
- **M5** the mobile nav is `position: static`, so after scrolling a long
  portfolio the view switcher is off-screen.
- **M6** the Discovery crawler table declares `min-width: 620px` inside
  `.discovery-table-wrap { overflow-x: auto }`: no page overflow, but at 320px
  it is a horizontal-scroll island whose `td small` is 9px. **Not fixed** — see §7.

### LOW

- **L1** `.evidence-links a` keeps `sourceId` in `title`; the label is visible
  and the full provenance is on the Project Detail page.
- **L2** the disabled Roadmap/Settings buttons carry their explanation only in
  `title` — and `.nav-list button:disabled { display: none }` at ≤760px, so on a
  phone they are not rendered at all. Not a real mobile defect.
- **L3** `.empty-state` keeps `padding: 42px 20px` on a 320px screen.

### Explicitly checked and NOT found

- **No hover-only functionality.** Every `:hover` rule (`.project-card`,
  `.nodes-project-tab`, `.detail-return button`, `.triage-tabs button`,
  `.evidence-links a`) is a decorative border/background change. Every action is
  reachable by tap; the whole project card is a real `<a>` (`.project-card-open`)
  with evidence links kept clickable above it.
- **No dialogs or drawers exist** to fit or not fit: CP-10 removed the Task
  Packet modal, and `tests/dashboard-monitoring-boundary.test.ts` asserts
  `.task-packet-modal` and `.modal-backdrop` counts are 0.
- **No tables in the four target sections.** The only table is Discovery's (§M6).
- **No overlapping controls** other than the H3 density problem.

---

## 4. Phase 2 — data stress test

Fixtures live in `tests/hostile-portfolio.ts` and are pushed through the **real**
`parseProjectRegistry` before they are returned, so no fixture reaches a view by
weakening the contract. `tests/mobile-resilience.test.ts` re-parses the result to
prove it.

Covered: 220-char unbroken project name; 300-char mixed Russian/Kazakh/English
unbroken summary; 240-char unbroken blocker and next action; 180/160-char
unbroken stage/checkpoint; `owner/repo` with 60- and 90-character segments;
`999999998 из 999999999` progress; three-way source `CONFLICT` with a 140-char
unbroken reason and 40-char SHA source ids; 120-char evidence label over a
200-char URL; a project with **every** optional value null and all activity
`UNAVAILABLE`; zero progress; a project carrying **four** simultaneous warnings
(BLOCKER + APPROVAL_PENDING + STALE + ACTION_NOW); 160-char unbroken history
summaries with full 40-char provenance ids; one project; sixty projects; empty
filtered result.

### Contract-level impossibilities (recorded, not faked)

The audit brief asked for `total = 0`, an empty list and an unknown status. The
domain contract forbids all three, so they were **not** manufactured — the
schema was verified to reject them instead:

| Requested case | Contract result |
|---|---|
| `progress.total = 0` | rejected — `total` is `z.number().int().positive()` |
| empty portfolio | rejected — `projects: z.array(...).min(1)` |
| unknown status `MAYBE` | rejected — `TriageStateSchema` is a closed enum |
| `progress.sourceId` | rejected — `progress` is `.strict()` |

`triageState: null` is the contract's honest "unknown status", reached via
`triageSource.status = 'UNKNOWN' | 'CONFLICT'`; that is what the fixtures use.

### UI failures found (all with real data, not just hostile)

`UNBREAKABLE_NO_WRAP` fired on 12 element/view pairs — exactly the B1 list — and
on nothing else once `/` and `-` were treated as break opportunities. Every other
defect in §3 reproduces with the committed snapshot alone.

---

## 5. Phase 3 — minimal fix set

Rules respected: no redesign, no visual-style migration, no new component
library, no new dependency, no backend or contract change, existing tokens and
idioms reused, desktop untouched unless the fix is width-independent.

`src/styles.css` (+103 lines, one commented block; the mobile half was placed
**inside** the existing final `@media (max-width: 760px)` block so the stylesheet
keeps a single authoritative mobile block):

1. `overflow-wrap: anywhere` on 17 selectors — the B1 set plus the same class of
   element in Experiments (`.experiment-row h2`/`p`, `.experiment-source`), Nodes
   (`.nodes-project-tab strong`/`small`), the sync state (`.sync-state span`,
   which carries the refresh error text) and Discovery
   (`.discovery-source-card p`/`small`). It is the same declaration the
   stylesheet already uses for `.detail-row dd` and
   `.history-timeline article`. *(This one is width-independent by design: an
   unbreakable token overflows at 1440px too. It changes nothing for real data,
   which contains no such token.)*
2. `min-height: 44px` at ≤760px for 18 interactive selectors (nav, triage tabs,
   graph filters, history filters, search field, every evidence link, sync
   button, detail report link).
3. `.header-actions { flex-direction: column }` at ≤760px.
4. `.sidebar { position: sticky; top: 0; z-index: 5 }` at ≤760px.
5. `.search-box input` / `.report-project-select select` → `font-size: 16px` at
   ≤760px (iOS zoom-on-focus).
6. `font-size: 11px` at ≤760px for the eleven 8–9px selectors. The deliberate
   10px metadata scale (`.status-badge`, `.experiment-status`,
   `.read-only-badge`, …) was **left alone**.
7. `.page-header h1 { font-size: 24px }` at ≤420px.
8. `.touch-hint { display: none }` base + `display: inline` at ≤760px.

`src/components/DashboardApp.tsx` (+1/−1) — the card's source hint is also
rendered as `<span className="touch-hint">`.
`src/components/history-parts.tsx` (+3) — the full evidence id is also rendered
as `<span className="touch-hint">`, only when it differs from the short form.

Both are additive: desktop output is byte-identical because `.touch-hint` is
`display: none` above 760px (asserted in the test).

---

## 6. Phase 4 — verification

Commands run in this repository:

| Command | Result |
|---|---|
| `npm test` | **267/267 pass** (was 216/216; +51 new in `tests/mobile-resilience.test.ts`) |
| `npm run build` (`tsc -b && vite build`) | **PASS** — `dist/index.html` 0.45 kB, `dist/assets/index-DrhK9TtW.css` 57.50 kB (gzip 10.63 kB), `dist/assets/index-BAKWuBOn.js` 654.43 kB (gzip 179.30 kB), built in 5.74 s |
| `npm run verify:snapshot` | **OK** — schemaVersion 1.2.0, version 6, updatedAt 2026-10-01, 15 projects, no credentials detected |
| `git diff --check` | clean |
| CI `validate` on PR #31 (`npm ci` → `npm test` → `verify:snapshot` → `sync:discovery` → `npm run build`) | **pass** in 48 s — independent confirmation on GitHub runners |
| CI `Cloudflare Pages` preview on PR #31 | **fail** — pre-existing: the same check also fails on PRs #28, #29 and #30, so it is not caused by this change |
| static cascade analyzer, 4 datasets × 8 views × 4 widths | see below |

### Before / after (findings per view at 320px)

| dataset / view | before | after |
|---|---|---|
| real — triage | 27 | 9 |
| real — portfolio | 19 | 9 |
| real — experiments | 11 | 6 |
| real — attention | 10 | 7 |
| real — nodes | 15 | 4 |
| real — reports | 12 | 6 |
| real — discovery | 3 | 1 |
| real — detail | 18 | 10 |
| hostile — triage | 25 | 5 |
| hostile — portfolio | 17 | 5 |
| hostile — experiments | 11 | 6 |
| hostile — attention | 9 | 4 |
| hostile — nodes | 15 | 4 |
| hostile — reports | 14 | 6 |
| hostile — discovery | 3 | 1 |
| hostile — detail | 21 | 10 |
| single — all views | 98 | 38 |
| bulk — all views | 98 | 38 |
| **all four datasets** | **426** | **169** (−60%) |

### By defect class (hostile dataset, 320px, all eight views)

| Class | before | after |
|---|---|---|
| `UNBREAKABLE_NO_WRAP` | 12 | **0** |
| `TOUCH_TARGET` | 39 | **0** |
| `DECLARED_MIN_WIDTH` | 0 | 0 |
| `NOWRAP_NO_SCROLLER` | 0 | 0 |
| `HOVER_ONLY_INFO` | 15 | 11 |
| `SMALL_TYPE` | 49 | 30 |

The two classes that can produce page-level horizontal overflow
(`UNBREAKABLE_NO_WRAP`, `DECLARED_MIN_WIDTH` outside a scroll container) are now
**zero at every audited width and for every dataset** — which is the strongest
statement about "no horizontal page overflow at 320px" this sandbox can make
without a browser.

### Acceptance checklist

1. *No horizontal page overflow at 320px* — **proven statically** (both
   overflow mechanisms now report zero); **not** pixel-verified.
2. *All primary actions usable by touch* — **yes**: every interactive element
   resolves to ≥44px at 320/360/390/430px; asserted per selector in
   `tests/mobile-resilience.test.ts`, including that the desktop value is
   unchanged.
3. *Important information remains accessible* — **yes**: extreme values are
   rendered whole (no truncation), sparse values keep their explicit
   "Не определено источником" placeholders, zero renders as `0 из 1`, all four
   simultaneous warnings stay visible, and both tooltip-only payloads are now
   real text on a phone.
4. *Extreme data does not destroy layout* — **yes** for every case the contract
   allows; the four forbidden cases are documented in §4 rather than faked.
5. *Empty states remain understandable* — **yes**: a zero-result filter renders
   `Ничего не найдено по текущему фильтру.` (tested).
6. *Desktop layout has no obvious regression* — **asserted, not rendered**:
   every mobile rule is inside `max-width: 760px`/`420px`, and the test asserts
   the 1440px value for each changed selector. The one width-independent change
   is `overflow-wrap: anywhere` on B1's selectors, which cannot alter the
   rendering of text that already fits.
7. *Existing automated tests still pass* — **yes**, 216/216, plus 51 new.

### Files changed

| File | Change |
|---|---|
| `src/styles.css` | +103 / −0 |
| `src/components/DashboardApp.tsx` | +1 / −1 |
| `src/components/history-parts.tsx` | +3 / −0 |
| `tests/dashboard-monitoring-boundary.test.ts` | +5 / −0 (see note) |
| `tests/hostile-portfolio.ts` | new, 194 lines (shared contract-valid fixtures) |
| `tests/mobile-resilience.test.ts` | new, 380 lines (51 assertions) |

**Test change requiring owner review.** `chromeText()` in
`dashboard-monitoring-boundary.test.ts` strips project-sourced fields before
checking for execution vocabulary. `.touch-hint` was added to that list because
the source hint is verbatim source-artifact text — for `business-discovery` it is
`"Status documents differ between main and codex/stage-5-auditor"`, a branch name
from the project's own status artifact, which the same test already accepts in
`.attention-row p`. Without the addition the boundary test fails on the word
"Codex". This is a classification correction, not a relaxation: no dashboard-
authored execution vocabulary is exempted, and `assertNoExecutionButtons` and the
`.project-card button` count assertions are untouched.

---

## 7. Remaining problems

| # | Problem | Severity | Why it was not fixed |
|---|---|---|---|
| R1 | Discovery crawler table is a 620px horizontal-scroll island at 320px | MEDIUM | A card adaptation is a structural change to a table outside the four target sections; needs its own decision |
| R2 | 30 remaining `SMALL_TYPE` findings, all the deliberate 10px metadata scale (`.status-badge`, `.experiment-status`, `.read-only-badge`, `.history-event-heading`, `.relationship-legend li`, `.history-timeline a`) | LOW | Raising them changes the established visual density; that is a visual-system decision, not a bounded fix |
| R3 | `.evidence-links a` still keeps `sourceId` in `title` | LOW | The label is visible and the full provenance is one tap away in Project Detail |
| R4 | `.empty-state` keeps 42px padding on a 320px screen | LOW | Cosmetic |
| R5 | No pixel-level or real-device verification exists anywhere in the repository | HIGH (process) | No browser is installable in this sandbox; see §2 |
| R6 | The sticky mobile nav is the only **behavioural** (not purely declarative) change: `.sidebar` becomes `position: sticky` inside an `.app-shell` that is `display: block` below 760px. The declaration resolves correctly and the containing block spans the full page height, but stickiness itself was not observed in a browser | MEDIUM | Needs one real-device check; it is a 4-line revert if it misbehaves |
| R7 | `bundle > 500 kB` build warning (654 kB JS) | LOW | Pre-existing, unrelated to this experiment |

---

## 8. Experiment conclusion

### Result: **PASS**

The selected skills found real, previously unreported defects in the production
dashboard — a page-widening wrapping asymmetry between sibling elements in the
same component, five classes of control below the touch floor, a mobile header
that never stacked, and provenance locked inside hover tooltips — and every one
was fixed with a bounded patch: 107 changed lines of product CSS/TSX, no new
dependency, no architectural change, desktop output unchanged, 216 existing tests
still green.

The signal was concentrated and cheap: 60% of all audit findings disappeared, and
both defect classes capable of causing horizontal page overflow went to zero.

### Should this become a reusable UI-quality check for other MPE projects?

### **ADOPT_WITH_CHANGES**

Adopt:

- the **hostile-but-valid data** discipline — build fixtures, push them through
  the *real* contract, and record contract-forbidden cases as impossibilities
  instead of weakening validation to manufacture them (`total = 0` and an empty
  registry were both impossible here, and saying so was more useful than faking
  them);
- the **fixed viewport set** 320 / 360 / 390 / 430 plus a desktop control;
- the **severity ladder** BLOCKER / HIGH / MEDIUM / LOW with each finding tied to
  a named selector and a measured value;
- the **bounded fix rule** — fix only what the audit proved, mobile-scoped,
  existing tokens first, and assert the desktop value is unchanged;
- the **"checked and not found"** section, which is what makes a PASS
  distinguishable from a shallow pass.

Change before reusing:

1. **Make a real browser mandatory.** Every number here is static-cascade
   analysis because this sandbox cannot install Chromium. That is the single
   biggest weakness of the run, and R5 is a HIGH process finding, not a
   footnote. The check must run headless Chromium (or a device farm) and record
   `document.scrollingElement.scrollWidth > innerWidth`, real touch-target
   bounding boxes and screenshots. A project should not be able to report PASS on
   static analysis alone.
2. **Commit the analyzer, or replace it.** The instrument used here was kept
   outside the repository to avoid adding a parallel harness, which means the
   before/after numbers are not independently reproducible by `npm test`. Only
   the 51 committed assertions are. Either commit the analyzer as a shared MPE
   tool or make a real-browser harness the standard so this gap disappears.
3. **Fix the false-positive classes found in the instrument itself**: the first
   analyzer version recorded **zero** media-query rules (so every number was
   desktop-only), then ignored CSS inheritance (flagging `span.meta-repo` inside
   an `overflow-wrap: anywhere` parent), then treated `/` and `-` as
   non-breakable. An audit tool that is not itself tested will confidently report
   the wrong baseline. It needs its own unit tests before it is trusted on
   another project.
4. **Add the two checks this run could not do**: real touch-target geometry
   (`getBoundingClientRect`) rather than resolved `min-height`, and a
   contrast/legibility pass — `SMALL_TYPE` is a proxy for readability, not a
   measurement of it.

Not yet evaluated (out of first-run scope by owner instruction): animation,
interaction polish, accessibility and visual-detail skills.

---

## 9. Reproducing

```bash
npm ci
npm test                 # 267 assertions, includes tests/mobile-resilience.test.ts
npm run build
npm run verify:snapshot
```

`tests/mobile-resilience.test.ts` encodes every fixed defect twice: once against
the shipped stylesheet (resolved through a small deterministic cascade at
320/390/430/420/1440px, asserting the desktop value is unchanged for each
selector) and once against the real components rendered in jsdom at 320px with
the fixtures from `tests/hostile-portfolio.ts`. The exploratory analyzer used for
the before/after counts in §6 is described in §2 and is not committed.
