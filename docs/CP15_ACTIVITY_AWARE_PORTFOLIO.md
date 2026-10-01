# CP-15 — Activity-Aware Portfolio, Triage & Session Visibility

Status: `PASS`
Checkpoint type: `EXTEND_EXISTING` — CP-15 extends the existing read-only dashboard
and the CP-14 activity/session contract. No new repository, runtime, backend,
database, Worker, API or second synchronization mechanism was created.

## Goal

Make the first screen show what is actually active while making
forgotten / unclosed Arena sessions visible — without turning the dashboard into
realtime monitoring.

## Implemented

- **Deterministic activity + Arena session state in normalized `ProjectState`.**
  The `activity` (last meaningful activity, status updated, snapshot generated)
  and `session` (seven-state Arena observation) blocks from CP-14 are now
  consumed by the UI and by deterministic ordering helpers. No contract change;
  schema version remains `1.1.0`.
- **Portfolio ordered by recent meaningful activity**, most recent first, with
  deterministic tie-breakers: equal time → evidence-source priority → `sourceId`
  → project `id`. Projects whose activity is unattributable (`UNAVAILABLE`) sort
  after all attributable ones, so they are never silently treated as "recent".
- **Triage / Attention keep operational priority authoritative.** The seven
  canonical triage states order first; recent activity only breaks ties inside
  the same operational state, so an `ACTION_NOW` / `BLOCKED` project is never
  hidden behind a newer but lower-priority one.
- **Freshness visible on cards.** Every card shows an activity-freshness chip
  (`FRESH` / `STALE` / `UNKNOWN`) plus the date/time of the last meaningful
  activity. Freshness is derived from the snapshot's own generation time, never
  from a browser clock.
- **Compact Arena session indicator.** Shown for `ACTIVE`,
  `WAITING_FOR_VALIDATION`, `READY_TO_CLOSE`, `STALE_SESSION` and `UNKNOWN`
  only; `NOT_ACTIVE` and `CLOSED` are settled states and show no indicator. The
  indicator is a separate dashed-border element prefixed `Arena ·` so it never
  reads as, or replaces, the operational status badge.
- **`READY_TO_CLOSE` and `STALE_SESSION` are visually distinguishable** from
  operational status (amber caution vs. alert-red, distinct icons, dashed border)
  and from each other.
- **Stale-session threshold made visible.** The inactivity threshold
  (`ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS = 24`, defined in CP-14 derivation)
  is surfaced in the `STALE_SESSION` indicator's title/tooltip rather than
  silently assuming an old open session is still active. A Portfolio caption
  states the ordering rule and the threshold.
- **No realtime monitoring.** All values come from the latest scheduled/manual
  snapshot (`config/projects.github.json` ≡ `public/project-state.json`). The
  browser still polls the runtime snapshot on the existing 60-second cadence; no
  per-project or per-session Arena polling was added.

## Files

- `src/monitoring/portfolio-ordering.ts` — new: pure, clock-free ordering and
  session-visibility helpers (`orderByRecentActivity`,
  `compareByPriorityThenActivity`, `compareByRecentActivity`, `triageRank`,
  `shouldShowSessionIndicator`).
- `src/components/DashboardApp.tsx` — Portfolio/Triage/Attention ordering,
  card freshness block and compact session indicator, Portfolio caption.
- `src/styles.css` — `CP-15` styles: `.session-indicator` (+ state variants),
  `.freshness-chip` (+ variants), `.project-activity`, `.view-caption`.
- `tests/cp15-activity-session-visibility.test.ts` — new: ordering determinism,
  session-indicator visibility, and desktop (1440px) / mobile (390px) rendering
  of ordering, freshness and the distinct session chips.
- `tests/dashboard-monitoring-boundary.test.ts` — updated: the read-only
  "Arena session" observation label is permitted (CP-15); Arena *execution*
  actions (Continue, Send to Arena, Task Packet, Codex) remain forbidden.
- `docs/CP15_ACTIVITY_AWARE_PORTFOLIO.md` — this document.

## Boundary (unchanged)

The dashboard remains a read-only Portfolio Monitoring UI:

- no task execution, agent/model/runner controls, Task Packet generation/export;
- no Arena session-control action anywhere (start / stop / close / continue);
- no write-back to GitHub or any repository;
- no backend, database, Worker, API or second synchronization mechanism;
- operational status (`READY`, `IN_PROGRESS`, `ACTION NOW`, `BLOCKED`,
  `VALIDATION`, `HOLD`, `DONE`) is never replaced by the Arena session state;
- the Arena session observation is evidence only — the dashboard never closes a
  session; a merge/commit/status update is still never interpreted as closure.

## Validation

- `npm test`: 152/152 pass (was 150; +2 new CP-15 tests), including desktop and
  mobile DOM checks for ordering, freshness and the distinct session chips.
- `npm run build` (`tsc -b && vite build`): PASS.
- `git diff --check`: clean.
- `npm run verify:snapshot`: OK — schemaVersion `1.1.0`, version 5, `updatedAt`
  `2026-10-01`, 15 projects, no credentials detected.
- Deterministic ordering, session-indicator visibility and priority-authorship
  are covered by tests; the snapshot remains byte-identical between
  `config/projects.github.json` and `public/project-state.json`.

## Exit-criteria mapping

- Recently active projects appear first in Portfolio — verified by the ordering
  test against the committed snapshot at 1440px and 390px.
- Triage priority remains authoritative; recency/session state never hide
  `ACTION_NOW` / `BLOCKED` — verified by the priority unit + DOM test.
- A forgotten/unclosed Arena session is recognizable from the next
  synchronization when evidence supports `READY_TO_CLOSE` or `STALE_SESSION` —
  the indicator is shown for both with a distinct, status-separated visual and
  the inactivity threshold is exposed.
- Ordering and session-state rendering are deterministic and covered by tests.
- Mobile and desktop behavior validated via the DOM harness at 390px and 1440px.

## Known limitations (external, not introduced here)

- The committed snapshot predates any project carrying an explicit Arena session
  block, so every project currently resolves to `UNKNOWN`; the indicator shows
  `UNKNOWN` honestly as a gap rather than fabricating activity. The scheduled
  CI sync will surface `READY_TO_CLOSE` / `STALE_SESSION` only when a canonical
  status artifact records the evidence.
- Freshness uses the snapshot's generation time as the reference clock, keeping
  the dashboard a periodic read-only observer; it is not live staleness.
