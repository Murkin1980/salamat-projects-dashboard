# Arena Task Packet — CP-19 Portfolio Coverage & Data Quality Hardening

## Hard entry gate

Before doing any implementation, fetch current `main` and verify all of the
following in `PROJECT_STATUS.md`:

- CP-18 is recorded as `PASS`;
- PR #37 and merge commit `c44a510bdbb089107c226ceef596125dc4177d59`
  are recorded;
- production workflow `39465753157` is recorded as successful;
- current progress is `19/21`;
- CP-19 is named as the next checkpoint.

If any item is missing, STOP and report `BLOCKED: CP-18 closeout not merged`.
Do not repair or bypass this gate inside the CP-19 run.

## Repository and mandatory reading

- Repository: `Murkin1980/salamat-projects-dashboard`
- Base: latest verified `main`

Read completely, in order:

1. `docs/governance/SCOPE-CHANGE-CONTROL.md`
2. `FOUNDATION.md`
3. `AGENTS.md`
4. `ARCHITECTURE.md`
5. `TRIAGE_RULES.md`
6. `CHECKPOINTS.md` — CP-19 is the sole implementation scope
7. `PROJECT_STATUS.md`
8. `ROADMAP.md`
9. `docs/GITHUB_SOURCE_ADAPTER.md`
10. `docs/CP17_LIVE_HISTORY_REPORTS.md`
11. `docs/CP18_PORTFOLIO_RECENT_ACTIVITY.md`

## Disposition

`EXTEND_EXISTING`

Reuse the existing GitHub source adapter, `ProjectState` contract, scheduled
sync, snapshot verification, Reports and Recent Activity UI. No parallel
service or second data path.

## Goal

Make production portfolio coverage and data quality explicit and machine-
checkable for every configured project, including Arena session evidence.

## Required work

Execute CP-19 exactly as written in `CHECKPOINTS.md`:

1. Audit every configured portfolio project against its canonical repository
   and status source.
2. Classify every project explicitly as current, stale, `UNKNOWN`,
   `UNAVAILABLE` or fixture-backed.
3. Classify session evidence for every project, or record an attributable
   `UNKNOWN`/`UNAVAILABLE` limitation.
4. Remove accidental fixture/stale production data only where a verified real
   source exists. Never replace missing evidence with guesses.
5. Extend the existing read-only diagnostics so coverage, freshness and session
   evidence gaps are visible and attributable. Reuse Reports/Recent Activity
   patterns; do not create a parallel dashboard.
6. Strengthen snapshot verification so generated snapshots are checked for
   credentials/secrets and required coverage/data-quality invariants.
7. Verify private-repository access only through the existing GitHub secret
   path. Never print, persist or expose credentials.
8. Keep project status and Arena session state separate. Never infer `CLOSED`
   from merge, commit, status update or workflow success.

## Boundaries

Do not add:

- a backend, Worker, database, queue or second synchronization mechanism;
- realtime monitoring or notifications;
- write-back to repositories;
- task execution, agent controls or session controls;
- a new repository or source of truth;
- CP-20 work.

If full-scope private repository access is unavailable, fail closed, preserve
the last valid snapshot, expose the limitation and continue only work that can
be truthfully validated. Do not fabricate coverage.

## Required validation

- focused tests for every new behavior and negative/fail-closed path;
- full `npm test` once at the final stable checkpoint;
- `npm run build`;
- `npm run verify:snapshot`;
- `git diff --check`;
- desktop 1440px and mobile 390px real-browser validation for affected views;
- verify no horizontal mobile overflow;
- verify no execution/session controls;
- verify event/status/session provenance and explicit unavailable states;
- record any private-source limitation without exposing credentials.

## Evidence and delivery

Create `docs/CP19_PORTFOLIO_COVERAGE_DATA_QUALITY.md` containing disposition,
scope, changed components, source coverage matrix, validation results, known
limitations and the exact next action.

Then:

- commit to a dedicated branch;
- push and open one PR;
- return branch, commit SHA, PR URL, check results, changed-file summary,
  coverage counts and blockers;
- STOP at the PR boundary unless Murat explicitly authorizes merge;
- do not update `PROJECT_STATUS.md` to CP-19 PASS before merge and production
  validation;
- do not start CP-20.

