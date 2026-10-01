# CHECKPOINTS

## CP-00 — Repository Foundation
Foundation, AGENTS, architecture, triage rules, status/roadmap and icon research exist.
Exit: human-readable repository constitution is complete.

## CP-01 — Visual System
Approved node/file/status/service icon system and design tokens.
Exit: visual catalog accepted.

## CP-02 — Static Triage Shell
Responsive UI shell with Triage/Portfolio/Attention navigation and fixture data.
Exit: mobile + desktop usability pass.

## CP-03 — Project State Contract
Versioned normalized ProjectState schema and fixtures.
Exit: deterministic validation tests pass.

## CP-04 — GitHub/MPE Source Adapter
Read project status from selected repositories/artifacts.
Exit: dashboard values can be traced to source evidence.

## CP-05 — Live Triage
Automatic triage derivation and Attention signals.
Exit: live changes propagate without manual card editing.

## CP-06 — Flow / Nodes MVP
Interactive graph of projects/tools/plugins/services with inspect/filter/toggle configuration where safe.
Exit: graph reflects real relationships; no workflow runtime introduced.

## CP-07 — History & Reports
State transition history, blocker changes, checkpoint movement.

## CP-08 — Cloudflare Production
Deploy and bind `projects.salamat-mebel.kz`, verify mobile and desktop.

### CP-08 extension — Automatic main deployment
Use the existing Cloudflare Pages project only. A GitHub Actions workflow runs on every push to `main`, executes tests/build, deploys with Wrangler, and verifies that production `project-state.json` matches the committed runtime snapshot. Credentials must be supplied only through GitHub repository secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`); no secret values may be committed.
Exit: a push to `main` completes verify → deploy → production snapshot verification without manual Wrangler execution.

## CP-09 — Codex App Server Experiment
Only after separate experiment gate. Evaluate Continue-from-project / agent workstream integration without moving source-of-truth authority into the dashboard.
UI surface removed in CP-10; the retained contract and harness are recorded as an MPE migration candidate, not dashboard functionality.

## CP-10 — Monitoring-Only Cleanup
Restore the product boundary `Salamat Projects Dashboard = Portfolio Monitoring UI`.
Remove every execution control from the UI (Continue, Task Packet modal, RAW JSON / Copy JSON / Export JSON, Codex/Arena references), keep and tidy all monitoring fields (name, repository, operational status, stage, progress, blocker, next step, last updated, evidence links, history), and leave the dashboard strictly read-only.
Exit: no execution control renders in any view at desktop or mobile; monitoring data intact; tests, build and boundary verification pass.

## CP-11 — Portfolio Refresh
Refresh the committed normalized portfolio snapshot from current project/repository evidence without changing the monitoring-only product boundary.
Scope: update active project cards, repository links, current checkpoints/blockers/next actions where attributable, and add newly active repositories to the portfolio.
Exit: normalized registries remain schema-valid, public runtime snapshot matches the committed cache, no execution/write controls are introduced, and the refresh is recorded in project status/roadmap.

## CP-12 — Discovery Monitoring
Add read-only Murat House search/AI crawler visibility from Cloudflare analytics. Show last observed Googlebot/Bingbot activity, AI crawler request totals, crawler identities and top requested paths. User-Agent detection quality must be disclosed; unavailable source data must remain UNAVAILABLE rather than becoming fake zero traffic. No crawler controls, WAF changes, backend or execution authority.
Exit: strict snapshot contract, scheduled read-only sync, responsive Discovery view, full tests/build and production snapshot verification pass.

## CP-13 — Automatic Portfolio Sync
Refresh the committed portfolio snapshot from GitHub inside the existing Cloudflare Pages production workflow, before the build, on the unchanged six-hour schedule. Keep one synchronization mechanism, keep the browser runtime snapshot byte-identical to the committed cache, and keep the last valid snapshot when GitHub is temporarily unavailable. Record every portfolio repository that has no canonical status source as an explicit gap instead of inventing data. Do not change the portfolio boundary, the sync frequency or the monitoring-only product boundary.
Exit: the scheduled workflow runs tests → GitHub credentials check → `sync:github` → snapshot verification → discovery sync → build → deploy → production verification; source coverage is machine-checked; no credentials reach generated artifacts or the frontend.

---

# Production Completion Plan — CP-14+

These checkpoints complete the dashboard from its current technical state to a dependable day-to-day Portfolio Monitoring UI.

## CP-14 — Portfolio Activity Source & Freshness
**Goal:** make project activity current and evidence-based.

Scope:
- Introduce a normalized read-only activity/freshness contract.
- Derive activity from available GitHub evidence: commits, pull requests, workflow/check activity and canonical project-status artifacts.
- Separate `last activity`, `status updated`, and `snapshot generated`; never use snapshot generation time as project activity.
- Mark missing/private/unavailable evidence explicitly as `UNKNOWN` or `UNAVAILABLE`; never invent activity.
- Preserve the existing portfolio source-of-truth chain and fail-closed behavior.

Exit:
- Every portfolio project has a deterministic freshness state and evidence source when available.
- Automated tests cover fresh, stale, missing and unavailable evidence.
- A generated snapshot can be traced back to concrete GitHub evidence.
- No UI execution controls are introduced.

## CP-15 — Activity-Aware Portfolio & Triage Ordering
**Goal:** make the first screen immediately show what is actually being worked on.

Scope:
- Add deterministic activity timestamps to project state.
- Portfolio view: order projects by recent meaningful activity, with deterministic tie-breakers.
- Triage/Attention view: preserve operational priority first, then use recent activity as a secondary ordering signal.
- Show freshness on cards so ordering is explainable.
- Define a stale threshold and make it visible rather than silently treating old projects as active.

Exit:
- Recently active projects appear first in Portfolio.
- Triage priority remains authoritative; recency never hides ACTION NOW/BLOCKED information.
- Ordering is deterministic and covered by tests.
- Mobile and desktop behavior are both validated.

## CP-16 — Project Detail Drill-down
**Goal:** clicking a project card opens a complete read-only project view.

Scope:
- Make every project card navigable/clickable.
- Add a Project Detail route/view within the existing dashboard.
- Show at minimum:
  - project name and repository;
  - operational/portfolio status;
  - current stage/checkpoint;
  - progress;
  - blocker;
  - next action;
  - last meaningful activity;
  - source/evidence links;
  - recent activity/events;
  - project-specific history.
- Provide clear return navigation to Portfolio/Triage.
- Deep links must survive direct browser navigation/refresh.

Exit:
- Every project in the portfolio can be opened and inspected.
- Detail data is derived from the same normalized source state as the cards.
- No project mutation, task execution or agent control is possible from the detail view.
- Responsive validation passes.

## CP-17 — Live History & Reports
**Goal:** replace the obsolete manual dashboard-only history with automatically derived portfolio history.

Scope:
- Define a normalized history/event contract.
- Collect meaningful read-only events from GitHub/project evidence: commits, PR lifecycle changes, checkpoint/status changes, blockers and other attributable state transitions.
- Replace the static August-only `project-history.json` dependency where appropriate.
- Reports must support selecting a project and viewing its recent history.
- Keep event provenance and timestamps.

Exit:
- History & Reports reflects current portfolio activity, not only the dashboard's own old CP-00→CP-07 history.
- A project can be selected and its history inspected.
- Events have source/provenance and deterministic ordering.
- Missing evidence is explicit, not fabricated.

## CP-18 — Portfolio Recent Activity Feed
**Goal:** provide one cross-project timeline of what changed recently.

Scope:
- Add a read-only Recent Activity section/view.
- Aggregate meaningful events across all projects.
- Each event links to the relevant project and source evidence.
- Support a compact recent window plus project filtering.
- Do not turn the feed into a task queue or notification/execution system.

Exit:
- Murat can open the dashboard and understand the latest portfolio changes without opening every card.
- Activity is ordered by event time and shows project + event + source.
- Feed remains monitoring-only.

## CP-19 — Portfolio Coverage & Data Quality Hardening
**Goal:** make the dashboard honest and reliable across all configured projects.

Scope:
- Audit all portfolio entries against canonical repositories/status sources.
- Remove accidental fixture/stale data from the production path where a real source exists.
- Keep explicit coverage gaps for projects whose source cannot be read.
- Add freshness/coverage diagnostics to the read-only dashboard or reports.
- Machine-check that generated snapshots contain no credentials/secrets.
- Verify private-repository access through the existing GitHub secret path without exposing credentials.

Exit:
- Every project is classified as current, stale, UNKNOWN, UNAVAILABLE or explicitly fixture-backed.
- No project is silently represented by outdated fixture data when a canonical source is available.
- Coverage gaps are visible and attributable.
- Tests and snapshot verification remain green.

## CP-20 — Production UX & Acceptance
**Goal:** make the dashboard a dependable daily-use tool on phone and desktop.

Scope:
- Final mobile-first pass for Triage, Portfolio, Attention, Project Detail, History/Reports and Recent Activity.
- Verify loading, empty, stale, UNKNOWN and UNAVAILABLE states.
- Verify navigation, deep links, refresh and back navigation.
- Verify readable information density within the intended 30–60 second portfolio scan.
- Add/complete regression tests for the final monitoring flows.
- Run production deployment and verify the deployed runtime snapshot.

Exit:
- Full monitoring journey works end-to-end:
  **Portfolio → project → current state → recent activity/history → source evidence → back to portfolio.**
- No execution controls exist anywhere in the product.
- GitHub sync → build → Cloudflare deploy → production verification is green.
- Desktop and mobile acceptance is complete.

---

# Arena Execution Protocol

These checkpoints are intentionally sequential.

1. Arena executes **one checkpoint at a time**.
2. Do not start the next checkpoint until the current checkpoint has passed its exit criteria.
3. Each checkpoint must produce:
   - implementation;
   - tests;
   - build;
   - `git diff --check`;
   - desktop/mobile validation where UI is affected;
   - evidence of source provenance;
   - a concise findings/validation note;
   - branch + commit SHA + PR.
4. Arena must not create a new repository.
5. Arena must extend the existing `salamat-projects-dashboard` repository.
6. No checkpoint may add execution/orchestration controls.
7. No checkpoint may move source-of-truth authority from GitHub/project evidence into the dashboard.
8. If a source is unavailable, the dashboard must expose the limitation explicitly rather than fabricate a value.
9. If a checkpoint exposes a design problem that affects later checkpoints, stop at the current checkpoint and record the blocker instead of silently broadening scope.
10. After each merged checkpoint, re-read this file and use the next numbered checkpoint as the sole scope for the next Arena run.

## Current execution state

**Next checkpoint: CP-14 — Portfolio Activity Source & Freshness**

Status: READY TO START.
