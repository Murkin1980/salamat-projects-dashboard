# CP-19 — Portfolio Coverage & Data Quality Hardening

Disposition: `EXTEND_EXISTING`

## Result

CP-19 hardens the existing GitHub source adapter, normalized `ProjectState`
contract, scheduled synchronization, snapshot verification and read-only Reports
view so portfolio coverage, freshness and Arena session evidence are explicit
and machine-checkable for every configured project. No backend, Worker,
database, second synchronization mechanism, realtime channel, execution or
session control was added.

## Scope

1. Added `UNAVAILABLE` as a fourth triage-source resolution (alongside
   `KNOWN` / `UNKNOWN` / `CONFLICT`). The seven canonical triage states
   (`ACTION_NOW | BLOCKED | READY | IN_PROGRESS | VALIDATION | HOLD | DONE`)
   are unchanged; `UNAVAILABLE` classifies projects whose canonical source
   cannot currently be read (private repo without authorization, missing
   canonical status artifact, HTTP failure). It requires `triageState = null`
   so no operational state is claimed without evidence.
2. Removed accidental stale/fabricated `KNOWN` states from two private
   repositories (`murat-house`, `murat-ai-orchestrator`) where the gap record
   already says no canonical `PROJECT_STATUS.md` could be verified. They now
   render as `SOURCE UNAVAILABLE` with the attributable reason.
3. Preserved all other attributed gap states unchanged:
   - `murat-ads-control` stays BLOCKED per its manual portfolio attribution
     (the gap reason explicitly says to keep the existing state until a
     canonical status artifact is verified).
   - `business-discovery` stays CONFLICT (previously synchronized, now a
     403 gap).
   - `tender-assistant`, `minibase-cloudflare`, `ai-microtask-factory`,
     `grand-mebel-document-control` stay UNKNOWN (missing/insufficient
     canonical status artifacts).
   - Five fixture-backed projects (no repository) stay fixture.
4. Fail-closed sync invariant: `scripts/sync-github-projects.ts` throws on
   any source-access failure before writing output, so a partial GitHub outage
   preserves the last valid snapshot. Gap entries are **not** overwritten by
   the sync; they retain their last valid data. The helper `unavailableProjectState`
   is exported for explicit UNAVAILABLE construction and is used by tests.
5. Strengthened `scripts/verify-project-state.ts` (CP-19 snapshot invariants):
   - existing credential/secret scan, plus AWS key id and PEM private-key
     headers;
   - byte-identity between `config/projects.github.json` and
     `public/project-state.json`;
   - schema validation;
   - every `REPOSITORY` project must be either a synchronized source or an
     explicit gap in `config/source-repositories.json`;
   - fixture-backed projects must not claim a repository;
   - `UNAVAILABLE` projects must carry no fabricated triageState, blocker,
     nextAction, stage, checkpoint, activity or history;
   - coverage counts printed at the end of every run.
6. Added a read-only Portfolio Coverage panel at the top of History & Reports
   (`#/reports`). It derives classifications from the same normalized
   `ProjectState` the snapshot verifier consumes, so UI counts match
   `npm run verify:snapshot` exactly. It shows totals, per-classification
   counts (Current / Stale / Unknown / Unavailable / Fixture), session
   evidence coverage, history coverage, and a collapsible source matrix with
   per-project classification, source id, session/history state and the
   attributable reason. Clicking a project in the matrix deep-links to its
   report (same routing mechanism, no new navigation). No parallel dashboard
   or second data path.
7. StatusBadge renders `SOURCE UNAVAILABLE` explicitly (separate from
   `STATUS UNKNOWN` / `SOURCE CONFLICT`). Live-triage attention flags
   UNAVAILABLE sources with their reason.
8. Session evidence is kept strictly separate from operational status: only
   `salamat-projects-dashboard` carries confirmed session closure evidence;
   every other project stays `UNKNOWN` with an attributable reason. No
   session is ever inferred as `CLOSED` from a merge, commit, validation
   result or status update.
9. History stays `UNAVAILABLE` (with reason) for projects whose source cannot
   be read — zero events are fabricated.

## Changed files

- `src/contract/project-state.ts` — added `UNAVAILABLE` to `TriageSourceSchema`.
- `src/adapters/github-source.ts` — added `unavailableProjectState` helper.
- `src/triage/live-triage.ts` — attention signal for UNAVAILABLE sources.
- `src/components/status-badges.tsx` — `SOURCE UNAVAILABLE` badge.
- `src/monitoring/portfolio-coverage.ts` (new) — pure derivation of CP-19
  coverage classifications and summary counts from a ProjectRegistry.
- `src/components/CoveragePanel.tsx` (new) — read-only coverage diagnostics
  panel (metrics grid + collapsible source matrix), wired into Reports.
- `src/components/ReportView.tsx` — minimal wiring to render CoveragePanel;
  existing project history behavior unchanged.
- `src/styles.css` — coverage panel styles.
- `scripts/sync-github-projects.ts` — gap processing now preserves existing
  valid snapshot entries (fail-closed invariant documented; gap id existence
  is still enforced).
- `scripts/verify-project-state.ts` — CP-19 coverage/data-quality
  invariants and stronger secret detection.
- `config/projects.json`, `config/projects.github.json`,
  `public/project-state.json` — removed fabricated KNOWN states from
  `murat-house` and `murat-ai-orchestrator` (now `UNAVAILABLE`); bumped
  snapshot version to 7, `updatedAt` 2026-10-20.
- `tests/cp19-portfolio-coverage.test.ts` (new) — focused CP-19 tests:
  UNAVAILABLE contract, coverage classification, snapshot invariants,
  secret detection, gap-vs-source accounting, and verification that the
  two fabricated KNOWN states are gone.

## Source coverage matrix (committed snapshot, version 7)

| projectId | source kind | triage | session | history | attributable reason |
|---|---|---|---|---|---|
| murat-project-engineer | REPOSITORY | UNKNOWN | UNKNOWN | KNOWN | STATUS.md has no canonical Status label |
| business-discovery | REPOSITORY | CONFLICT | UNKNOWN | UNAVAILABLE | Default/codex branch status differ; production credential 403 |
| salamat-projects-dashboard | REPOSITORY | KNOWN (DONE) | CLOSED (CONFIRMED) | KNOWN | canonical PROJECT_STATUS.md |
| mebelflow-ai | FIXTURE | KNOWN (IN_PROGRESS) | UNKNOWN | UNAVAILABLE | fixture-backed |
| murat-ads-control | REPOSITORY | KNOWN (BLOCKED) | UNKNOWN | UNAVAILABLE | manual portfolio attribution retained per gap record |
| interactive-kp | FIXTURE | KNOWN (IN_PROGRESS) | UNKNOWN | UNAVAILABLE | fixture-backed |
| mebellegal-kz | FIXTURE | KNOWN (VALIDATION) | UNKNOWN | UNAVAILABLE | fixture-backed |
| whatsapp-sales-agent | FIXTURE | KNOWN (VALIDATION) | UNKNOWN | UNAVAILABLE | fixture-backed |
| tender-assistant | REPOSITORY | UNKNOWN | UNKNOWN | UNAVAILABLE | no canonical status artifact |
| etsy-market-research | FIXTURE | KNOWN (HOLD) | UNKNOWN | UNAVAILABLE | fixture-backed |
| minibase-cloudflare | REPOSITORY | UNKNOWN | UNKNOWN | UNAVAILABLE | only ROADMAP.md / operational runbook |
| ai-microtask-factory | REPOSITORY | UNKNOWN | UNKNOWN | UNAVAILABLE | production credential 403 |
| murat-house | REPOSITORY | **UNAVAILABLE** | UNKNOWN | UNAVAILABLE | private, unverifiable (fabricated READY removed) |
| murat-ai-orchestrator | REPOSITORY | **UNAVAILABLE** | UNKNOWN | UNAVAILABLE | private, unverifiable (fabricated READY removed) |
| grand-mebel-document-control | REPOSITORY | UNKNOWN | UNKNOWN | UNAVAILABLE | private, unverifiable |

Coverage counts (from `npm run verify:snapshot`):
- total 15 (primary buckets: 0+2+6+2+5 = 15 — mutually exclusive partition)
- current 0, stale 2 (repository KNOWN projects: salamat-projects-dashboard, murat-ads-control — both past the 7-day freshness threshold because the snapshot was regenerated without a live sync in this sandbox; production sync on main will recompute freshness)
- unknown 6 (includes CONFLICT for business-discovery)
- unavailable 2 (murat-house, murat-ai-orchestrator — fabricated READY removed)
- fixture 5
- session known 1, session unknown 14
- history known 2, history unavailable 13

## Boundary

- No backend, Worker, database, queue, second synchronization mechanism,
  realtime channel, notification, task execution, agent controls, session
  controls or write-back was added.
- No new repository or source of truth was introduced.
- `PROJECT_STATUS.md` was not updated to CP-19 PASS (that happens after merge
  and production validation per the mandatory post-merge rule).
- CP-20 was not started.
- Private-repository access is only attempted through the existing `GH_TOKEN`
  / `GITHUB_TOKEN` path. Raw content is processed in memory; tokens are never
  printed, persisted or exposed. A failed sync writes nothing and preserves
  the last valid snapshot.

## Validation

- `npm test`: **293/293 passed** (284 prior + 9 new CP-19 focused tests).
- `npm run build` (`tsc -b && vite build`): PASS.
- `npm run verify:snapshot`: PASS — schema `1.2.0`, version 7, 15 projects,
  no credentials detected.
- `git diff --check`: clean.
- Real-browser validation performed at desktop 1440px and mobile 390px (see
  PR description). Coverage panel renders above History & Reports; source
  matrix is collapsible; clicking a project name navigates to its report
  without reloading; no execution/session controls exist.
- Dashboard remains read-only: the only form control in Reports is the
  existing project selector; no Start/Stop/Close/Run/Task-Packet/Send-to-Arena
  buttons are present.
- No horizontal overflow at 390px (coverage metrics use auto-fit and wrap).

## Known limitations

- Full production `npm run sync:github` could not be exercised end-to-end
  from this sandbox environment (network access limited to an allowlist that
  does not include `api.github.com`). The sandbox token was able to read
  repositories in earlier runs; the production GitHub Actions workflow uses
  its own `GITHUB_TOKEN` plus the optional `GH_TOKEN` secret and will refresh
  the snapshot on next push to `main`. The fail-closed verifier guarantees the
  existing snapshot (with the two fabricated KNOWN states now removed)
  remains valid until then.
- 13 of 15 projects still have `history: UNAVAILABLE` (as on `main`); the
  `history` block for them carries an attributable reason and the UI reports
  coverage instead of inventing events.
- Only `salamat-projects-dashboard` carries confirmed Arena session closure
  evidence. The other 14 projects stay `UNKNOWN` per CP-14/CP-19 evidence
  rules; missing session evidence is never downgraded to `CLOSED`.

## Next action

Push this branch, open one PR against `main`, await Murat's authorization
before merging. After merge and production validation, update
`PROJECT_STATUS.md` per the mandatory post-merge rule before starting CP-20.
