# CP-16 — Project Detail Drill-down & Session Inspection

Status: `PASS`
Checkpoint type: `EXTEND_EXISTING` — CP-16 extends the existing read-only dashboard,
its CP-14 activity/session contract and the CP-15 card presentation. No new
repository, runtime, backend, database, Worker, API or second synchronization
mechanism was created.

## Goal

Clicking a project card opens a complete read-only project view, including enough
Arena session evidence to understand whether the session was actually closed.

## Implemented

- **Every project card is navigable.** The card is a real anchor to its own detail
  route (`#/project/<project-id>`), so it is keyboard reachable, the link can be
  copied or opened in a new tab, and the whole card is one large target. The
  anchor overlays the card while the evidence links inside keep a higher stacking
  context and stay independently clickable. A plain left click is handled by the
  SPA router; modified clicks (cmd/ctrl/shift/alt) fall through to the browser.
- **Project Detail route/view.** `src/components/ProjectDetailView.tsx` renders the
  complete project: name, repository, operational/portfolio status, stage,
  checkpoint, progress, blocker, next action, last update and source attribution;
  the activity block (last meaningful activity, canonical status update, snapshot
  generation, freshness); the Arena session block (state, closure status, session
  checkpoint, started-at, last session activity, closure evidence and state
  evidence); evidence links; recent activity/events; and the project's own
  committed history.
- **Hash routing with deep links.** `src/routing/hash-route.ts` (pure) plus
  `src/hooks/use-hash-route.ts` (hook) keep the route in the URL fragment. A
  detail link therefore survives a direct navigation, a refresh and a shared link
  on the static Cloudflare Pages deployment without any server rewrite, and the
  browser Back/Forward buttons move between a card and its detail view.
  Unknown or malformed routes fail safe to Triage instead of rendering nothing.
- **Same normalized source as the cards.** The detail view receives the same
  `ProjectState` objects the cards render (derived from the live runtime snapshot),
  so a project can never be described differently in the list and in its detail.
  Freshness uses the snapshot's own generation time as the reference clock, exactly
  as on the cards.
- **Recent activity/events are derived, not invented.**
  `src/monitoring/project-detail-events.ts` builds a deterministic event list from
  evidence timestamps that already exist in the snapshot (project activity,
  canonical status update, session start, session activity, snapshot generation),
  newest attributable first. A missing timestamp stays an explicit `UNAVAILABLE`
  gap carrying its recorded reason, and snapshot generation is always labelled as
  the dashboard's own clock because it is not project activity.
- **Project completion ≠ session closure.** The session panel states the
  distinction explicitly and resolves it from evidence: `DONE` with an unclosed
  session says "DONE не означает CLOSED"; a `CLOSED` session on a project that is
  not `DONE` says "CLOSED сам по себе не означает DONE"; unverifiable closure says
  `UNKNOWN`. Closure is only ever shown as confirmed together with its evidence
  link.
- **Return navigation.** Explicit `Портфель` and `Триаж` buttons return to the two
  list views a project is opened from.
- **Read-only.** The detail view contains no input, form, select or mutating
  control — only the two return-navigation buttons plus evidence/route links. No
  project mutation, task execution, session control or agent control is possible.

## Files

- `src/routing/hash-route.ts` — new: pure route grammar (`#/<view>`,
  `#/project/<id>`), `parseHashRoute`, `viewHash`, `projectDetailHash`.
- `src/hooks/use-hash-route.ts` — new: hash routing hook (`hashchange` +
  `popstate`, immediate state update on navigate).
- `src/monitoring/project-detail-events.ts` — new: deterministic recent-activity
  event derivation and shared evidence-timestamp formatting.
- `src/components/ProjectDetailView.tsx` — new: the Project Detail view.
- `src/components/status-badges.tsx` — new: `StatusBadge` / `SessionIndicator` /
  `triageMeta` extracted from `DashboardApp.tsx` so cards and the detail view
  render an operational status and an Arena session state identically.
- `src/components/DashboardApp.tsx` — hash-routed navigation, card link, detail
  view rendering, detail header/summary/search handling.
- `src/styles.css` — `CP-16` styles: card link overlay, detail layout, session and
  closure badges, event lists, responsive rules.
- `tests/cp16-project-detail.test.ts` — new: routing contract, event derivation,
  every project openable, deep-link/refresh survival, return navigation, the
  project-vs-session distinction, the explicit `UNKNOWN` closure state, the
  read-only boundary, and 390px rendering.
- `docs/CP16_PROJECT_DETAIL_DRILLDOWN.md` — this document.

## Boundary (unchanged)

The dashboard remains a read-only Portfolio Monitoring UI:

- no task execution, agent/model/runner controls, Task Packet generation/export;
- no Arena session-control action anywhere (start / stop / close / continue);
- no write-back to GitHub or any repository;
- no backend, database, Worker, API or second synchronization mechanism;
- operational status (`READY`, `IN_PROGRESS`, `ACTION NOW`, `BLOCKED`,
  `VALIDATION`, `HOLD`, `DONE`) is never replaced by the Arena session state;
- the session observation is evidence only — the dashboard never closes a session;
  a merge / commit / status update is still never interpreted as closure;
- all values come only from the latest scheduled/manual snapshot; no browser-side
  continuous Arena monitoring was added.

## Validation

- `npm test`: 170/170 pass (was 152; +18 new CP-16 tests), including desktop
  (1440px) and mobile (390px) DOM checks for the detail view, deep links, return
  navigation and the read-only boundary.
- `npm run build` (`tsc -b && vite build`): PASS.
- `git diff --check`: clean.
- `npm run verify:snapshot`: OK — schemaVersion `1.1.0`, version 5, 15 projects,
  no credentials detected; `config/projects.github.json` and
  `public/project-state.json` remain byte-identical and unchanged by this
  checkpoint.
- The monitoring-only boundary regression tests (CP-10) still pass at 1440px and
  390px: no execution control renders in any view, and project cards contain no
  button at all.
- Repository-wide search confirms no execution vocabulary, no write path and no
  new data source were introduced; the retained Task Packet contract is still not
  imported by any UI code.

## Exit-criteria mapping

- Every project in the portfolio can be opened and inspected — verified by the
  test that opens all 15 projects from their cards and asserts the full field set.
- Detail data is derived from the same normalized source state as the cards —
  verified by comparing the card and detail status/repository and by the shared
  snapshot-derived freshness reference clock.
- A user can determine whether session closure is confirmed, pending, stale or
  unknown — the session panel shows the state, the closure status and the
  evidence, and states `UNKNOWN` when closure cannot be verified.
- No project mutation, task execution, session control or agent control is
  possible from the detail view — verified by the read-only boundary test.
- Responsive validation passes — the detail view renders at 390px and 1440px with
  all panels, the session badge and return navigation.

## Known limitations (external, not introduced here)

- The committed history manifest (`config/project-history.json`) covers only
  `salamat-projects-dashboard`; for every other project the detail view states the
  gap explicitly instead of fabricating history. Replacing that static manifest is
  separate, later scope.
- The committed snapshot predates any project carrying an explicit Arena session
  block, so every project currently resolves to `UNKNOWN`; the detail view shows
  that honestly as a gap.
