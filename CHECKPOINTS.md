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

## CP-14 — Portfolio Activity & Arena Session State Contract
**Goal:** define a deterministic, read-only status contract that distinguishes project state, meaningful activity and the state of an Arena working session.

Scope:
- Introduce a normalized read-only activity/freshness contract.
- Derive project activity from available GitHub evidence: commits, pull requests, workflow/check activity and canonical project-status artifacts.
- Separate `last meaningful activity`, `status updated` and `snapshot generated`; never use snapshot generation time as project activity.
- Introduce an optional normalized **Arena execution-session state** observed from attributable project/evidence sources, with these states:
  - `NOT_ACTIVE` — no active Arena session is evidenced;
  - `ACTIVE` — an Arena session is evidenced as currently working;
  - `WAITING_FOR_VALIDATION` — implementation work is finished and validation is pending;
  - `READY_TO_CLOSE` — checkpoint work is factually complete, but session closure has not been confirmed;
  - `CLOSED` — explicit session closure evidence exists;
  - `STALE_SESSION` — a session remains evidenced as open but has exceeded the defined inactivity threshold;
  - `UNKNOWN` — the available evidence cannot determine the session state.
- Define the minimum session evidence fields: session state, checkpoint, started-at when known, last session activity when known, closure status and closure evidence/reference when available.
- Treat missing session evidence as `UNKNOWN`, not as `CLOSED`.
- A commit, PR merge or status update alone must not be interpreted as proof that an Arena session was closed.
- The dashboard observes session state only during its existing scheduled/manual synchronization cycle; it does not continuously monitor Arena and does not start, stop or close sessions.
- Mark missing/private/unavailable evidence explicitly as `UNKNOWN` or `UNAVAILABLE`; never invent activity or closure.
- Preserve the existing portfolio source-of-truth chain and fail-closed behavior.

Exit:
- Every portfolio project has deterministic activity/freshness data and an explicit session-state value or `UNKNOWN`, with evidence where available.
- Automated tests cover fresh/stale/missing/unavailable activity and all session-state transitions that can be determined from evidence.
- A generated snapshot can be traced back to concrete project/GitHub/session evidence.
- No UI execution or session-control actions are introduced.

## CP-15 — Activity-Aware Portfolio, Triage & Session Visibility
**Goal:** make the first screen show what is actually active while making forgotten/open Arena sessions visible without turning the dashboard into realtime monitoring.

Scope:
- Add deterministic activity timestamps and Arena session state to project state.
- Portfolio view: order projects by recent meaningful activity, with deterministic tie-breakers.
- Triage/Attention view: preserve operational priority first, then use recent activity as a secondary ordering signal.
- Show freshness on cards so ordering is explainable.
- Show a compact session indicator when an Arena session is `ACTIVE`, `WAITING_FOR_VALIDATION`, `READY_TO_CLOSE`, `STALE_SESSION` or `UNKNOWN`.
- Make `READY_TO_CLOSE` and `STALE_SESSION` visually distinguishable from project operational status; session state must not replace READY/IN_PROGRESS/ACTION NOW/BLOCKED/VALIDATION/HOLD/DONE.
- Define a stale-session threshold and make it visible rather than silently treating an old open session as active.
- Keep all values based on the latest scheduled/manual snapshot; no browser-side continuous monitoring.

Exit:
- Recently active projects appear first in Portfolio.
- Triage priority remains authoritative; recency and session state never hide ACTION NOW/BLOCKED information.
- A forgotten/unclosed Arena session can be recognized from the next available synchronization when evidence supports `READY_TO_CLOSE` or `STALE_SESSION`.
- Ordering and session-state rendering are deterministic and covered by tests.
- Mobile and desktop behavior are both validated.

## CP-16 — Project Detail Drill-down & Session Inspection
**Goal:** clicking a project card opens a complete read-only project view, including enough session evidence to understand whether Arena work was actually closed.

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
  - Arena session state;
  - session checkpoint;
  - session started-at when known;
  - last session activity when known;
  - closure status/evidence when available;
  - source/evidence links;
  - recent activity/events;
  - project-specific history.
- Clearly distinguish project completion from session closure: `DONE` does not imply `CLOSED`, and `CLOSED` does not by itself imply project `DONE`.
- Show explicit `UNKNOWN` when closure cannot be verified.
- Provide clear return navigation to Portfolio/Triage.
- Deep links must survive direct browser navigation/refresh.

Exit:
- Every project in the portfolio can be opened and inspected.
- Detail data is derived from the same normalized source state as the cards.
- A user can determine from the detail view whether session closure is confirmed, pending, stale or unknown when evidence permits.
- No project mutation, task execution, session control or agent control is possible from the detail view.
- Responsive validation passes.

## CP-17 — Live History & Reports
**Goal:** replace the obsolete manual dashboard-only history with automatically derived portfolio history, including attributable Arena session lifecycle events.

Scope:
- Define a normalized history/event contract.
- Collect meaningful read-only events from GitHub/project evidence: commits, PR lifecycle changes, checkpoint/status changes, blockers and other attributable state transitions.
- Include Arena session lifecycle evidence when available: session started, activity observed, waiting for validation, ready-to-close, explicit closure, stale-session detection.
- Do not manufacture a session event merely because a commit, merge or snapshot occurred.
- Replace the static August-only `project-history.json` dependency where appropriate.
- Reports must support selecting a project and viewing its recent history.
- Keep event provenance, timestamps and evidence references.

Exit:
- History & Reports reflects current portfolio activity, not only the dashboard's own old CP-00→CP-07 history.
- A project can be selected and its history inspected.
- Session lifecycle events are visible when attributable and explicit when unavailable.
- Events have source/provenance and deterministic ordering.
- Missing evidence is explicit, not fabricated.

## CP-18 — Portfolio Recent Activity Feed
**Goal:** provide one cross-project timeline of what changed recently, including important session-state changes.

Scope:
- Add a read-only Recent Activity section/view.
- Aggregate meaningful events across all projects.
- Include attributable Arena session events that materially change the observed state, especially `READY_TO_CLOSE`, `CLOSED` and `STALE_SESSION`.
- Each event links to the relevant project and source evidence.
- Support a compact recent window plus project filtering.
- Do not turn the feed into a task queue, reminder system or notification/execution system.
- Keep the feed tied to the latest scheduled/manual synchronization snapshot.

Exit:
- Murat can open the dashboard and understand the latest portfolio changes and any sessions that appear unfinished without opening every card.
- Activity is ordered by event time and shows project + event + source.
- Feed remains monitoring-only and periodic, not realtime.

## CP-19 — Portfolio Coverage & Data Quality Hardening
**Goal:** make the dashboard honest and reliable across all configured projects, including session-state evidence.

Scope:
- Audit all portfolio entries against canonical repositories/status sources.
- Audit Arena session-state evidence and identify which configured projects can actually expose attributable session state.
- Remove accidental fixture/stale data from the production path where a real source exists.
- Keep explicit coverage gaps for projects whose source cannot be read.
- Add freshness/coverage/session-evidence diagnostics to the read-only dashboard or reports.
- Machine-check that generated snapshots contain no credentials/secrets.
- Verify private-repository access through the existing GitHub secret path without exposing credentials.
- Never downgrade missing session evidence to `CLOSED`; use `UNKNOWN` or `UNAVAILABLE` as appropriate.

Exit:
- Every project is classified as current, stale, UNKNOWN, UNAVAILABLE or explicitly fixture-backed.
- Every project also has an explicit session-state classification or documented `UNKNOWN`/source limitation.
- No project is silently represented by outdated fixture data when a canonical source is available.
- Coverage and session-evidence gaps are visible and attributable.
- Tests and snapshot verification remain green.

## CP-20 — Production UX & Acceptance
**Goal:** make the dashboard a dependable daily-use tool on phone and desktop, including reliable visibility of forgotten Arena sessions.

Scope:
- Final mobile-first pass for Triage, Portfolio, Attention, Project Detail, History/Reports and Recent Activity.
- Verify loading, empty, stale, UNKNOWN and UNAVAILABLE states.
- Verify session states `ACTIVE`, `WAITING_FOR_VALIDATION`, `READY_TO_CLOSE`, `CLOSED`, `STALE_SESSION` and `UNKNOWN` where evidence exists.
- Verify that project status and session status remain separate and are not conflated.
- Verify navigation, deep links, refresh and back navigation.
- Verify readable information density within the intended 30–60 second portfolio scan.
- Add/complete regression tests for the final monitoring flows.
- Run production deployment and verify the deployed runtime snapshot.

Exit:
- Full monitoring journey works end-to-end:
  **Portfolio → project → current state → session state → recent activity/history → source evidence → back to portfolio.**
- A forgotten Arena session can remain visibly `READY_TO_CLOSE` or become `STALE_SESSION` based on evidence; the dashboard never closes it automatically.
- No execution or session-control actions exist anywhere in the product.
- GitHub sync → build → Cloudflare deploy → production verification is green.
- Desktop and mobile acceptance is complete.

---

# Arena Execution Protocol

These checkpoints are intentionally sequential and the status update rule applies to **every checkpoint, including all future checkpoints added to this file**.

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
10. Arena session closure is an explicit evidence-bearing state, not an implicit assumption. A commit, PR merge, validation result or status update does not by itself mean the Arena session is closed.
11. If Arena forgets to close a session, the dashboard must surface the observed `READY_TO_CLOSE` or `STALE_SESSION` state on the next available synchronization when the required evidence exists; it must never close the session itself.
12. After each merged checkpoint, re-read this file and use the next numbered checkpoint as the sole scope for the next Arena run.

## Mandatory post-merge status update

**Every merged checkpoint MUST update the project's factual status before the checkpoint is considered closed.**

After a checkpoint PR is merged, Arena must update `PROJECT_STATUS.md` in the same repository and record, at minimum:

- completed checkpoint and its result;
- merge commit SHA and PR reference;
- current project status;
- current stage/checkpoint;
- progress;
- blocker, or explicitly `none`;
- next checkpoint / next action;
- validation result (tests, build and production verification where applicable);
- date/time of the status update.

Rules:
- Status must be updated **only after the merge and required validation actually succeed**.
- Do not mark a checkpoint DONE merely because its PR was merged if production validation or another exit criterion is still pending; use the appropriate state such as `VALIDATION` or `BLOCKED`.
- If the checkpoint is blocked or partially complete, record the factual blocker and stop rather than advancing the checkpoint.
- `CHECKPOINTS.md` is the plan; `PROJECT_STATUS.md` is the factual current state.
- Do not silently rewrite historical results. Add the new state/update while preserving the project history.
- The status update itself must be committed and traceable to the completed checkpoint.
- The final checkpoint evidence must include the resulting `PROJECT_STATUS.md` change.
- If the status update cannot be completed, the checkpoint is **not closed** and Arena must report the blocker.

13. After the status update is committed and verified, the checkpoint is considered closed and only then may Arena proceed to the next checkpoint.


## Portfolio synchronization rule

The dashboard is a read-only observer of the entire canonical portfolio.

After any governed project/repository updates its factual `PROJECT_STATUS.md` after merge, the next portfolio synchronization MUST reconcile **all configured portfolio repositories/projects**, not only the repository that changed.

The synchronization must:
- re-read canonical status and repository evidence for the full portfolio;
- analyze current status, checkpoint, progress, blockers, meaningful activity, Arena session state and attributable evidence;
- reconcile every project into the normalized dashboard state;
- keep `UNKNOWN` / `UNAVAILABLE` explicit when a repository or source cannot be read;
- never infer a project state from another project's changes;
- never infer `CLOSED` from a merge, commit or status update alone;
- never write status back to project repositories;
- never start, stop or close Arena sessions;
- never use dashboard state as a source of truth.

A status update or session-state evidence in one repository is therefore a source event for the **next full portfolio reconciliation**, not a request for continuous monitoring. The dashboard must reflect the resulting cross-repository analysis only through the existing scheduled/manual synchronization mechanism.

## Current execution state

**Next checkpoint: CP-14 — Portfolio Activity Source & Freshness**

Status: READY TO START.
