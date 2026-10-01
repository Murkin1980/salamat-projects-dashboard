# CP-17 — Live History & Reports

Status: `PASS` (see `PROJECT_STATUS.md` for the post-merge record)
Checkpoint type: `EXTEND_EXISTING` — CP-17 extends the existing read-only
dashboard, the CP-14 `ProjectState` contract and the existing GitHub
synchronization. No new repository, runtime, backend, database, Worker, API or
second synchronization mechanism was created.

## Goal

History & Reports reflects the current portfolio from existing evidence and is
consistent with the normalized `ProjectState`, instead of the static
August-only CP-00→CP-07 manifest.

Architecture (unchanged): GitHub / canonical project evidence → existing sync →
normalized `ProjectState` (+ `history`) → History & Reports → read-only dashboard.

## Permitted extension

`CHECKPOINTS.md` CP-17 permits a normalized history/event contract fed through
the existing mechanism and replacing the static `config/project-history.json`.
That is exactly what was done; no separate history source was introduced. The
history is part of `ProjectState` (schema `1.2.0`), travels in the same committed
snapshot and is refreshed by the same `sync:github` cycle.

## Implemented

- **Contract (`1.2.0`).** `src/contract/project-state.ts`: required `history`
  block — `UNAVAILABLE {reason}` or `KNOWN {limits, events, gaps}` — strict event
  schema, deterministic comparator, uniqueness and ordering enforced by the schema.
  See `docs/PROJECT_STATE_CONTRACT.md` → "Project history".
- **Evidence collection.** `scripts/sync-github-projects.ts` (`collectHistoryEvidence`)
  reads, with the same read-only token and fail-closed behavior, the recent
  commits, recent pull requests and the recent revisions of the canonical status
  artifact (each revision's labels are read at that commit). Windows: 15 commits,
  10 PRs, 10 status revisions, recorded in `history.limits`.
- **Derivation.** `src/monitoring/history-derivation.ts` (pure): commits; PR
  opened/merged/closed; checkpoint, state and blocker transitions between
  consecutive status revisions; session lifecycle from the explicit
  `Arena Session` block only. Commits already represented by a merged PR are not
  duplicated.
- **Adapter.** `src/adapters/github-source.ts` attaches the derived history; a
  repository that cannot be read yields `history: UNAVAILABLE` with the reason.
- **Reports.** `src/components/ReportView.tsx` + `history-parts.tsx`: project
  selector (all 15 projects, deep link `#/reports/<id>`), summary metrics,
  category filters (Commits / Pull requests / Project status / Session) with reset,
  a newest-first timeline with source, source id and evidence link per event, a
  gaps panel and a provenance/window note. Zero counters show an explicit
  "no confirmed changes in the window" hint.
- **Project Detail.** `ProjectDetailView.tsx` renders the same
  `project.history` through the same helpers (`src/monitoring/history-view.ts`) and
  links to the project's report, so the two views cannot disagree.
- **Routing.** `src/routing/hash-route.ts`: `reportHash`, `reportProjectId`;
  plain view routes keep their CP-16 shape.
- **Removed.** `config/project-history.json`, `src/history/project-history.ts`,
  `tests/project-history.test.ts` (static source replaced by live history).
- **Mobile fix found during real-browser validation.** Long `sha:path` evidence ids
  in Project Detail fields overflowed 390px; `.detail-row dd` now wraps.

## Source / provenance model

| Event group | `source` | `sourceId` | Evidence |
| --- | --- | --- | --- |
| Commit | `COMMIT` | short sha | commit URL |
| PR opened / merged / closed | `PULL_REQUEST` | `owner/repo#N` | PR URL |
| Checkpoint / state / blocker transition | `PROJECT_STATUS` | commit sha producing the revision | commit URL |
| Session lifecycle | `PROJECT_STATUS` | `<sha>:<status path>` of the status artifact read | artifact URL / closure evidence |

`timeBasis` tells what `occurredAt` means (`EVENT`, `SESSION_LAST_ACTIVITY`,
`INACTIVITY_THRESHOLD`). Ordering: newest first, then event-type order, then
`sourceId`, then `id` — independent of input order and locale.

## Missing-data handling

- Repository unreadable / not configured → `history: UNAVAILABLE` with its reason;
  Reports and Detail show "История недоступна (UNAVAILABLE)" and never an empty
  timeline presented as "nothing happened".
- Readable repository but unreadable part of the evidence → explicit `gaps`
  (`COMMITS`, `PULL_REQUESTS`, `STATUS_TRANSITIONS`, `SESSION`) with reasons.
- No Arena session block → `SESSION` gap, state `UNKNOWN`; never `CLOSED`.
- `snapshotGeneratedAt` is shown only as the dashboard's clock, never as an event.
- A commit, merge, validation result or status update never creates a session event.

## Snapshot (partial refresh — disclosed)

The committed snapshot (`config/projects.github.json` == `public/project-state.json`,
schema `1.2.0`, version 6) was regenerated with the existing `syncOnce` mechanism.
The sandbox token can read only `murat-project-engineer` and
`salamat-projects-dashboard`; the full `npm run sync:github` fails closed
(`business-discovery` returns 404), so it could not be run end-to-end. The two
readable projects carry real history (dashboard: 34 events; murat-project-engineer:
27 events plus an explicit `SESSION` gap); the other 13 projects are explicitly
`history: UNAVAILABLE` with a reason. The next scheduled/manual sync in the
deployment environment (full-scope token) fills in the remaining projects; no UI
change is needed for that.

## Files

- Contract/logic: `src/contract/project-state.ts`, `src/monitoring/history-derivation.ts`
  (new), `src/monitoring/history-view.ts` (new), `src/adapters/github-source.ts`,
  `scripts/sync-github-projects.ts`, `src/routing/hash-route.ts`.
- UI: `src/components/ReportView.tsx`, `src/components/history-parts.tsx` (new),
  `src/components/ProjectDetailView.tsx`, `src/components/DashboardApp.tsx`,
  `src/styles.css`.
- Data: `config/projects.json`, `config/project-state.example.json`,
  `config/projects.github.json`, `public/project-state.json`.
- Tests: `tests/cp17-live-history.test.ts` (new), updated `cp15`, `cp16`,
  `arena-session-state`, `live-triage`, `github-sync`.
- Docs: this file, `docs/PROJECT_STATE_CONTRACT.md`.

## Boundary (unchanged)

Read-only Portfolio Monitoring UI: no start / stop / close / execute / continue,
no Task Packet, no agent controls, no write-back, no backend/DB/Worker/API, no
realtime monitoring, no second synchronization mechanism. Project status is never
replaced by Arena session state, and the dashboard never closes a session.

## Exit-criteria mapping

- Reflects current portfolio activity — live commits, PRs, status transitions and
  session events from evidence (tests: live history, committed snapshot).
- A project can be selected and its history inspected — selector over all 15
  projects (DOM tests at 1440 and 390px; verified in a real browser).
- Session lifecycle visible when attributable, explicit when unavailable — derivation
  and DOM tests for started/activity/waiting/ready/closed/stale and `UNKNOWN` gap.
- Source/provenance and deterministic ordering — schema-enforced; tests.
- Missing evidence explicit, not fabricated — `UNAVAILABLE` / `gaps`; tests assert
  no events without evidence.

## Validation

See the PR description and `PROJECT_STATUS.md` for the final numbers.
