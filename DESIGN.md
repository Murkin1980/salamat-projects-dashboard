# DESIGN.md

Canonical design document for `salamat-projects-dashboard`.

Read order (unchanged): `FOUNDATION.md` → `AGENTS.md` → `ARCHITECTURE.md` → `TRIAGE_RULES.md`
→ `CHECKPOINTS.md` → `PROJECT_STATUS.md` → `ROADMAP.md` → `docs/VISUAL_SYSTEM.md` → **this file**.

## 0. Scope and canonical sources

| Concern | Canonical source |
|---|---|
| Domain model, adapters, triage rules | `ARCHITECTURE.md`, `TRIAGE_RULES.md`, `src/contract/*` |
| Icon vocabulary, status semantics, graph anatomy | `docs/VISUAL_SYSTEM.md` (CP-01) — still canonical |
| Colour system, surfaces, type scale, component primitives | **this file → §3 FreeScan Dark Control Theme** |

`docs/VISUAL_SYSTEM.md` keeps owning the *semantic* layer (which icon and which meaning belongs to a state).
This document owns the *visual* layer (which token renders that meaning). Nothing in §3 changes domain logic,
the `ProjectState` contract, or the meaning of a triage state.

---

## 1. Component inventory (audit performed before the theme change)

The dashboard had **no component library**: every surface was a CSS class inside a single `src/styles.css`
(611 lines) plus inline JSX in `src/main.tsx`. The audit mapped the de-facto components to shared primitives:

| De-facto component (before) | Where it was duplicated | Primitive now |
|---|---|---|
| Card | `.project-card`, `.summary-card`, `.attention-row`, `.report-metrics article`, `.scope-box`, `.criteria-list li` | `Card` (`src/components/ui/Card.tsx`) |
| Nested block | `.project-meta div`, `.node-inspector dl div`, `.edge-direction > div`, `.task-packet-meta-grid` | `Block` |
| Panel | `.nodes-workspace`, `.reports-workspace`, `.sidebar`, `.page-header` | `Panel` |
| Badge | `.status-badge` (+ 7 `status-*` classes), `.read-only-badge`, `.graph-source-state`, `.modal-tag`, `.inspector-status`, `.sync-state` | `Badge` / `StatusBadge` |
| Button | `.btn`, `.btn-primary`, `.btn-secondary`, `.triage-tabs button`, `.type-filters button`, `.project-footer button`, `.nav-list button` | `Button` |
| Tabs | `.triage-tabs` (pill style), `.history-filters` (toggle chips) | `Tabs` (underline) |
| Progress | **did not exist**, although `ProjectState.progress` exists in the contract | `Progress` / `SourceProgress` |
| Inspector | `.node-inspector` (nodes/relations only), no project inspector | `Inspector`, `InspectorSection`, `InspectorFacts`, `EvidencePanel`, `ProjectInspector` |
| Machine id | `.code-font`, `.repo-badge`, ad-hoc `<code>` blocks | `MachineId` |

Duplicated styles that were collapsed into the shared layer: seven near-identical badge colour pairs,
four card surfaces with different radii/shadows, three button treatments, two filter/tab bars, and
two inspector layouts. Legacy class names were **kept** (`.status-badge.status-blocked`, `.btn-primary`, …)
and now resolve to the new tokens, so any markup that has not been migrated yet still renders correctly.

---

## 2. FreeScan Dark Control Theme — summary

Internal theme name: **FreeScan Dark Control Theme**.
Character: very dark, technical, premium, high information density, calm, control-center feeling.
Colour is spent on **state and action**, never on decoration.

---

## 3. FreeScan Dark Control Theme

### 3.1 Source / reference

* External visual reference: <https://www.freescan.app/> — used **only** as a visual reference for the
  colour system and dashboard hierarchy (dark purple-black surfaces, compact semantic badges, thin
  underline tabs, a docked inspector instead of a modal card).
* No FreeScan branding, logo, copy, naming or unique identity element is used anywhere in the product.
  No component is named after it. It is an external reference, not a dependency.
* The palette below is the starting palette agreed for this repository; it is not a pixel copy of any
  reference screen. The reference is intentionally *not* treated as pixel-perfect truth.

### 3.2 Design principles

1. **Very dark, layered, not flat.** Three background levels (`page` → `primary` → `card` → `raised`)
   plus hairline borders separate surfaces. No borders means no hierarchy.
2. **Colour means state or action.** Magenta = action/critical, yellow = attention, green = positive,
   violet = active/informational, gray-purple = inactive/metadata.
3. **One bright accent, used rarely.** A single magenta fill is allowed: the primary action.
   Everything else is a border, text colour, or a 1px underline.
4. **No decoration.** No gradients, no glow, no blur, no large shadows, no decorative charts.
5. **Density with hierarchy.** More information per card than before, but the three-second read
   (status → checkpoint → next action) must stay intact.
6. **Honest data.** No invented metrics, no health score, no progress bar when the source publishes none.
   Absence of data is stated explicitly instead of filled with a placeholder number.
7. **Never colour alone.** Every status carries an icon and a text label (`docs/VISUAL_SYSTEM.md` §9).

### 3.3 Final tokens

Declared in `src/styles/tokens.css`; legacy aliases (`--bg`, `--panel`, `--text`, `--muted`, `--border`,
`--accent`, `--focus`) are kept so unmigrated rules resolve to the new palette.

```css
:root {
  color-scheme: dark;

  /* Backgrounds */
  --fs-bg-page:        #080014;   /* app background */
  --fs-bg-primary:     #100524;   /* header, sidebar, inspector, section surfaces */
  --fs-bg-card:        #190D2C;   /* card surface */
  --fs-bg-raised:      #211221;   /* nested blocks, metric cells, detail rows */
  --fs-bg-cool-panel:  #11132A;   /* graph canvas, evidence panel, code blocks */

  /* Borders */
  --fs-border:         #29163D;   /* standard hairline border */
  --fs-border-soft:    #1A0E2D;   /* borders inside a card */
  --fs-border-active:  #4A245F;   /* hover / selected border */

  /* Typography */
  --fs-text-primary:   #FFF8F6;   /* warm off-white, never pure #FFFFFF */
  --fs-text-secondary: #BEB2C2;
  --fs-text-muted:     #8E8295;

  /* Primary / Magenta */
  --fs-primary:        #E0004F;   /* primary CTA fill, BLOCKED, critical */
  --fs-primary-hover:  #F00058;
  --fs-primary-soft:   #3B0826;

  /* Success */
  --fs-success:        #20C978;
  --fs-success-soft:   #082D24;

  /* Warning */
  --fs-warning:        #F4BC00;
  --fs-warning-soft:   #302400;

  /* Danger */
  --fs-danger:         #E0004F;
  --fs-danger-soft:    #39051D;

  /* Neutral progress track */
  --fs-track:          #2A1B3C;
}
```

#### Documented deviations (inside the ±5–10 % correction budget)

| Token | Value | Why |
|---|---|---|
| `--fs-primary-fg` | `#FF5C86` | `#E0004F` measures 3.77:1 on `--fs-bg-card` — under the 4.5:1 floor for 12px text. `#FF5C86` is the same hue lightened for text use only (6.28:1 on card). `--fs-primary` remains the fill colour. |
| `--fs-info` | `#9B6BFF` | The palette has no colour for the `IN_PROGRESS` / "active but not positive" state; violet sits in the existing border hue family and stays distinct from green and yellow. |
| `--fs-info-fg` | `#A985FF` | Text-safe variant of `--fs-info` (6.59:1 on card). |
| `--fs-info-soft` | `#201038` | Violet-tinted nested surface, used sparingly. |
| Edge colours | see §3.6 | The relationship palette was re-hued for legibility on the dark canvas (blue `#2563eb` removed); dash patterns, labels and semantics are unchanged. |

### 3.4 Semantic colour mapping

| Meaning | Token | Applied to |
|---|---|---|
| Primary action, BLOCKED, FAIL, critical, destructive | `--fs-primary` / `--fs-primary-fg` | primary button fill, BLOCKED / SOURCE CONFLICT badges, active tab underline, selected-graph-node border |
| Attention: ACTION_NOW, VALIDATION, HUMAN_REQUIRED, degraded, stale, approval pending | `--fs-warning` | attention badges, STALE badge, security notice, `SOURCE <state>` warning chip in the graph toolbar |
| Positive: READY, DONE, PASS, MERGED, healthy, ACTIVE | `--fs-success` | READY / DONE badges, PASS node status, FRESH badge, included-scope block |
| Active / informational: IN_PROGRESS, machine links, evidence markers, `uses` edges | `--fs-info` / `--fs-info-fg` | IN PROGRESS badge, evidence item marker, `uses` relationship |
| Inactive / archived / metadata: HOLD, STATUS UNKNOWN, FUTURE, NEUTRAL | `--fs-text-muted` + `--fs-state-muted-*` | HOLD badge, unknown status, FUTURE graph nodes, machine ids, meta labels |

Triage state → badge tone (implemented in `src/components/StatusBadge.tsx`):

| Triage state | Tone | Note |
|---|---|---|
| `ACTION_NOW` | attention | yellow — human attention required now |
| `BLOCKED` | critical | magenta — cannot proceed |
| `READY` | positive | green — can start |
| `IN_PROGRESS` | active | violet — active, informational |
| `VALIDATION` | attention | yellow family — pending review; disambiguated from `ACTION_NOW` by icon and label |
| `HOLD` | muted | gray-purple — consciously paused |
| `DONE` | positive | green family — completed |
| `null` + `CONFLICT` | critical | magenta — source conflict is a critical evidence problem |
| `null` + `UNKNOWN` | muted | gray-purple — source does not publish a state |

### 3.5 Typography

Font stack is **unchanged** (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`).
Machine evidence (SHA, sourceId, taskId, repo slug) uses `--fs-font-mono`
(`ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`).

| Role | Token | Size / weight |
|---|---|---|
| Page title | `--fs-text-page` | 30px / 700 (26px under 760px) |
| Section title | `--fs-text-section` | 20px / 680 |
| Card title | `--fs-text-card` | 16px / 650 |
| KPI / score | `--fs-text-kpi` | 38px / 600 |
| Body | `--fs-text-body` | 14px |
| Metadata | `--fs-text-meta` | 12px |
| Micro label | `--fs-text-micro` | 11px, uppercase, 0.08em tracking |

### 3.6 Component usage

**Card** — `background: var(--fs-bg-card)`, `1px solid var(--fs-border)`, `radius 12px`, `box-shadow: none`.
Hover: border → `--fs-border-active` + `translateY(-1px)`. Selected: `--fs-border-active` border and
`--fs-bg-raised` background (no glow, no coloured ring).
**Block** (nested) — `--fs-bg-raised`, `1px solid var(--fs-border-soft)`, `radius 10px`.
**Panel** — `--fs-bg-primary`, `1px solid var(--fs-border)`, `radius 12px`, content clipping.

**Badge** — `padding: 3px 9px`, `radius 6px`, `12px / 600`, `1px solid`, tinted background.
A badge is never a large filled button; the only filled control is `Button variant="primary"`.

**Button** — primary: `--fs-primary` fill + `--fs-text-primary` label, `radius 8px`;
secondary: transparent + `1px solid var(--fs-border)`; danger: transparent with a magenta border and
magenta label (never a magenta fill) so destructive actions never read as the default action.

**Progress** — `height: 7px`, `radius: 999px`, track `--fs-track`, solid semantic fill, no gradient.
Fill tone follows the project state (critical / attention / positive / active / muted).
`Progress` renders **nothing** when the source publishes no `progress` — no invented numbers.

**Tabs** — underline tab bar: inactive = muted text on transparent background;
active = `--fs-text-primary` text over a 2px `--fs-primary` underline. Counts are monospace; state
identity is carried by a small semantic dot, not by a coloured pill.

**Inspector** — docked working panel (`--fs-bg-primary` surface, hairline borders), not a modal card.
Project inspector sections, in this order: `STATUS`, `CURRENT CHECKPOINT`, `NEXT ACTION`, `EVIDENCE`,
`CONNECTIONS`, `RISKS / BLOCKERS`. The node/relation inspector uses the same primitives with
`STATUS`, `CONNECTIONS`, `EVIDENCE`.

**EvidencePanel** — dedicated dark bordered surface (`--fs-bg-cool-panel` + `--fs-border`); each item is a
card with label, monospace source id and an outbound link. When a source publishes no evidence the panel
states that instead of rendering empty rows.

**MachineId** — monospace, visually truncatable (`cut` or CSS ellipsis), full value always available via
`title` and `data-full-id`.

**HealthScore** — **deliberately not implemented.** The dashboard has no objective numeric health metric in
`ProjectState`; inventing one is explicitly prohibited. When such a metric exists (for example a source-published
score), the primitive should be added as a half-circle gauge in the spirit of the external reference:
a `--fs-track` arc, a semantic fill, the number at 34–48px and a single-word qualifier underneath.

### 3.7 Layout (control center)

```
┌───────────────────────────────────────────────────────┐
│ Header (view title, live-snapshot state, search)      │  --fs-bg-primary
├───────────────────────────────────────────────────────┤
│ Portfolio overview strip (4 KPI cards)                │
├─────────────────────────────────┬─────────────────────┤
│ Tabs + project grid / graph     │ Inspector (sticky)  │
└─────────────────────────────────┴─────────────────────┘
```

* The existing navigation rail is preserved (architecture unchanged); it is now a dark control rail.
* `.control-columns` is `minmax(0, 1fr) / 356px`, collapsing to a single column under 1100px.
* The graph view keeps its own two-column layout (`minmax(0, 1fr) / 340px`) and React Flow behaviour.
* The inspector is sticky on desktop (`top: 16px`, viewport-height scroll) and becomes a full-screen
  sheet under 760px (see §3.8).

### 3.8 Responsive rules (verified target 390 × 844)

* Project cards: single column under 1100px.
* Inspector: full-width fixed sheet with its own scroll and an explicit 44px **Закрыть** control.
* Badges and flags wrap (`flex-wrap: wrap`); no truncation of state text.
* No horizontal page scroll: every grid uses `minmax(0, 1fr)`, long identifiers use
  `overflow-wrap: anywhere` / `text-overflow: ellipsis`. (The pre-existing horizontally scrollable
  navigation tab strip on mobile was left untouched — it is a control strip, not content.)
* Touch targets ≥ 44px for navigation, filters, card actions, sheet close and modal buttons.
* Machine ids are visually shortened; the full value stays in `title` / `data-full-id`.
* KPI grid: 4 → 2 → 2 columns; metric cells collapse to a single column under 420px.

### 3.9 Accessibility

* `color-scheme: dark` is set, so native controls and scrollbars follow the theme.
* Focus: `:focus-visible` outline `2px solid var(--fs-primary-fg)` with 2px offset (no ring glow).
* Status is never colour-only (icon + text in every badge).
* Measured contrast (WCAG 2.1, computed from the tokens above):

| Foreground | on page `#080014` | on primary `#100524` | on card `#190D2C` | on raised `#211221` |
|---|---|---|---|---|
| `--fs-text-primary` | 19.61 | 18.71 | 17.63 | 17.06 |
| `--fs-text-secondary` | 10.13 | 9.67 | 9.10 | 8.81 |
| `--fs-text-muted` | 5.66 | 5.40 | 5.09 | 4.92 |
| `--fs-primary-fg` (magenta text) | 6.98 | 6.67 | 6.28 | 6.08 |
| `--fs-success` | 9.49 | 9.06 | 8.53 | 8.26 |
| `--fs-warning` | 11.80 | 11.26 | 10.61 | 10.26 |
| `--fs-info-fg` | 7.34 | 7.00 | 6.59 | 6.38 |

All body-text pairs pass AA (≥ 4.5:1). Primary button label `#FFF8F6` on `#E0004F` = **4.67:1** (AA pass);
on the specified hover `#F00058` it is 4.13:1, i.e. above the 3:1 UI-component threshold but below AA for
small text — an accepted, documented trade-off of the specified palette (remediation if strict AA on hover
is required: darken the hover fill instead of lightening it). `--fs-primary` is therefore never used as
text: `--fs-primary-fg` is.

### 3.10 Prohibited patterns (enforced in review)

Forbidden: light theme, white cards, blue SaaS primary, glassmorphism, `backdrop-filter` as an effect,
gradients, neon glow, large `box-shadow`, oversized pills, decorative charts without data, invented health
scores, changing domain logic for design reasons, removing existing evidence, rewriting the app.

Automated self-check on the committed stylesheets: `gradient` → 0, `backdrop-filter` → 0,
`text-shadow` → 0, `filter: drop-shadow` → 0, `#fff`/`#ffffff`/`rgba(255…)` → 0, blue accent hexes → 0,
`box-shadow` → only `none` and two 2px inset accent bars (no glow).

### 3.11 Relationship (graph) colours

`src/graph/edge-presentation.ts` — labels, descriptions and dash patterns are unchanged; only the hues
were re-mapped for the dark canvas. All five colours remain distinct (`tests/edge-presentation.test.ts`).

| Relationship | Colour | Dash |
|---|---|---|
| `uses` | `#9B6BFF` violet | — |
| `depends_on` | `#F4BC00` yellow | — |
| `evidence_for` | `#35D0E0` cyan | `3 4` |
| `reports_to` | `#20C978` green | — |
| `diverged_from` | `#E0004F` magenta | `8 5` |

---

## 4. Change log

| Date | Change |
|---|---|
| 2026-09-11 | Added §3 FreeScan Dark Control Theme: token layer (`src/styles/tokens.css`), primitives under `src/components/ui/`, `ProjectCard` + `ProjectInspector` extracted from `src/main.tsx`, inspector dock in the control-center layout, graph/report/modal surfaces migrated. Domain logic, contracts and tests unchanged. |
