# PROJECT STATUS

Decision: `EXTEND_EXISTING`

Current checkpoint: `CP-12 — Discovery Monitoring`
Status: `PASS`

## CP-00 — Repository Foundation
Status: `PASS`

Evidence:
- repository `Murkin1980/salamat-projects-dashboard` created;
- Foundation invariants committed to `main`;
- mandatory agent reading order committed;
- architecture, triage rules and checkpoint model committed;
- icon/node research baseline documented;
- MPE tracking issue exists as Issue #11.

## CP-01 — Visual System
Status: `PASS`

Evidence:
- `docs/VISUAL_SYSTEM.md` locks semantic node/file/status/service icon vocabulary;
- Tabler Icons selected for system semantics;
- Simple Icons selected for recognizable external service marks;
- `config/icon-map.json` provides the canonical machine-readable mapping;
- triage state semantics are expressed with icon + text, never color alone;
- node anatomy and accessibility/permission guardrails are locked;
- React Flow is explicitly restricted to presentation/control and may not become workflow truth/runtime;
- `config/projects.json` contains the initial active-project registry fixture for the static shell.

## CP-02 — Static Triage Shell
Status: `PASS`

Implemented:
- React + TypeScript + Vite app scaffold;
- responsive desktop/mobile shell;
- Triage / Portfolio / Attention navigation;
- fixture rendering from `config/projects.json`;
- triage counts and filter pills;
- project search;
- summary KPI cards;
- disabled future controls instead of fake functionality;
- mobile navigation and single-column project layout.

Verification evidence:
- `npm install` completed with 0 vulnerabilities;
- `npm run build` passed (`tsc -b && vite build`, Vite 7.3.6);
- browser smoke check passed at desktop `1440x1000` and mobile `390x844`;
- Triage navigation, all seven filters, fixture counts, KPI cards, search by project and next action, Portfolio and Attention views were exercised;
- Portfolio does not inherit the hidden Triage filter;
- mobile document width equals the viewport width (`390px`), with no horizontal page overflow;
- future Roadmap / Reports / Settings / Continue controls remain disabled and honestly labelled;
- fixture data is read from `config/projects.json`; canonical triage icons are read from `config/icon-map.json`;
- no live GitHub integration or workflow runtime is present.

## CP-03 — Project State Contract
Status: `PASS`

Deep-change approval:
- Murat explicitly approved ProjectState contract version `1.0.0` in the agreed CP-03 scope on 2026-08-26.

Evidence:
- strict Zod schemas define the versioned `ProjectState` and registry envelopes;
- the seven canonical triage states remain unchanged;
- UNKNOWN and CONFLICT use nullable triage plus explicit source attribution, not an invented eighth state;
- deterministic freshness handling uses an injected clock and the seven-day triage threshold;
- `config/projects.json` contains normalized fixtures for all ten required projects;
- UI parses the registry through `parseProjectRegistry` and no longer uses unchecked fixture casts;
- unresolved source attribution renders explicitly instead of crashing or silently guessing;
- `npm test` passed 9/9 valid and invalid validation scenarios;
- `npm run build` passed;
- browser smoke check confirmed all ten normalized cards render and search by normalized `nextAction` works;
- no GitHub adapter, live synchronization or workflow runtime was introduced.

## CP-04 — GitHub/MPE Source Adapter
Status: `PASS`

Deep-change approval:
- Murat explicitly approved the read-only GitHub/MPE Source Adapter for `murat-project-engineer`, `business-discovery` and `salamat-projects-dashboard` without token or raw private content persistence.

Evidence:
- repository metadata and approved status/roadmap artifacts are fetched read-only through the GitHub REST API;
- `PROJECT_STATUS.md` has priority, `STATUS.md` is its fallback, and `ROADMAP.md` is supporting evidence only;
- exact artifact SHAs and blob URLs remain attached to normalized evidence;
- `murat-project-engineer` resolves honestly to `UNKNOWN` because its fallback status artifact lacks a canonical status label;
- divergent Business Discovery status documents resolve to `CONFLICT` without guessing a triage state;
- `salamat-projects-dashboard` resolves to canonical `READY`;
- the UI consumes the committed normalized snapshot and remains buildable from a clean checkout without credentials;
- tokens are read from environment variables only; raw repository content is processed in memory and is never persisted;
- sync output is restricted to the canonical cache or a system temporary directory;
- adapter, contract and real-cache tests pass; the sync script is included in TypeScript build validation;
- production build and browser smoke pass, including visible `STATUS UNKNOWN`, `SOURCE CONFLICT` and repository attribution.

## CP-05 — Live Triage
Status: `PASS`

Disposition:
- `EXTEND_EXISTING` — CP-05 extends the CP-04 adapter and the existing Triage/Attention views; no parallel service or repository was introduced.

Evidence:
- the read-only GitHub sync supports an operator-run watch interval and keeps credentials in process environment only;
- each successful cycle schema-validates and atomically publishes normalized state to the committed cache and browser runtime snapshot;
- the browser polls the runtime snapshot every 60 seconds and provides an explicit manual refresh;
- refresh errors and invalid schemas fail visibly while preserving the last valid registry;
- deterministic triage precedence applies unresolved source, blocker and pending-approval rules without writing back to source repositories;
- Attention signals explain source conflict/unknown, blockers, pending approvals, staleness, ACTION_NOW and VALIDATION with source attribution;
- 31 automated tests pass, including precedence, injected-clock staleness, HTTP failure and invalid runtime schema scenarios;
- production TypeScript/Vite build passes;
- a real GitHub watch run completed two consecutive cycles and published byte-identical validated cache/runtime snapshots;
- desktop browser smoke shows live refresh state and ten projects; mobile at 390x844 has no horizontal overflow (`390/390`);
- Codex Router delegation was attempted across four suitable OpenCode models, but final independent review was unavailable because all review attempts returned provider `429 Too Many Requests`.

## CP-06 — Flow / Nodes MVP
Status: `PASS`

Disposition:
- `EXTEND_EXISTING` — CP-06 extends the existing dashboard with a read-only derived graph; it does not add execution authority or a workflow runtime.

Evidence:
- a strict, source-attributed `NodeGraph` contract validates nodes, relationships, immutable evidence URLs, unique identifiers and referenced endpoints;
- the first factual vertical slice maps Business Discovery subsystems, evidence documents, stages and divergent branches from committed repository evidence;
- the desktop React Flow canvas is read-only and supports node-type and relationship filters, reset, zoom, pan and evidence inspection;
- the divergent Stage 5 branch and Auditor remain explicitly `CONFLICT`, while future scope remains explicitly `FUTURE`;
- mobile uses the same parsed manifest as a readable node list and inspector without depending on the canvas;
- relationship types now use distinct semantic colors plus text labels and directional arrowheads;
- selecting an edge dims unrelated relationships, marks source and destination nodes, and opens a read-only `source → destination` evidence inspector;
- mobile exposes the same relationships as labelled `source → destination` rows;
- 41 automated tests pass across the full dashboard suite, including edge-presentation semantics, missing evidence and dangling/invented node references;
- the production TypeScript/Vite build passes;
- browser smoke passed at desktop `1440x1000` and mobile `390x844`; filter changes, node selection and evidence inspection were exercised;
- mobile document width equals the viewport width (`390px`), with no horizontal page overflow;
- no graph editing, repository write-back, task execution or workflow orchestration was introduced.

### CP-06 extension — Multi-project Nodes (2026-09-13)

Disposition: `EXTEND_EXISTING` — the existing Nodes view now selects among five
evidence-backed graphs instead of one hard-coded graph; no new registry format,
schema version, service, backend or workflow runtime was added.

Evidence:

- `config/node-graphs.json` holds five strictly validated graphs: `business-discovery`
  (unchanged, 18 nodes / 17 edges), `murat-project-engineer`, `minibase-cloudflare`,
  `salamat-projects-dashboard` and `ai-microtask-factory`;
- every new node and edge carries `sourceId` plus a commit-pinned `evidenceUrl` from a
  readable repository;
- the Nodes view renders a compact project switcher driven only by registry graph entries
  (projects without graph data are never offered), with WAI-ARIA tab semantics and
  `ArrowLeft` / `ArrowRight` / `Home` / `End` keyboard navigation;
- switching the active project immediately re-renders the existing `NodeView` without a
  page reload; existing node-type and relationship filters and the read-only inspector
  keep working;
- a missing or empty graph resolves to an explicit empty state instead of failing;
- `ai-microtask-factory` is recorded with `sourceState UNKNOWN` because its repository is
  not readable from this session: only MPE portfolio evidence is represented, and the
  unverified Task Packet / Runner / Execution / QC / Artifacts subsystems were deliberately
  not invented;
- `minibase-cloudflare` shows the documented conflict between its `ROADMAP.md` counter
  ("CP-04 of 10") and the merged CP-05 / CP-06 commits instead of a guessed progress value;
- `minibase-cloudflare` and `ai-microtask-factory` were added to the project registry as
  explicit `triageSource: UNKNOWN` entries so graph project ids resolve; the GitHub source
  adapter configuration was not changed and no project status was asserted;
- 60 automated tests pass, including five new node-graph checks;
- production TypeScript / Vite build passes;
- a scratch jsdom harness (not committed, no new project dependency) verified 19/19
  behaviours: selector source, click and keyboard switching, source-state rendering,
  preserved filters and the safe empty state;
- no graph generation from `projects.github.json`, no editing, no write-back and no
  execution authority were introduced.

See `docs/CP06_MULTI_PROJECT_NODE_GRAPHS.md`.

## CP-07 — History & Reports
Status: `PASS`

Disposition:
- `EXTEND_EXISTING` — CP-07 extends the current dashboard and Git evidence model with a read-only transition manifest; no database or parallel analytics service was introduced.

Evidence:
- a strict, versioned history contract rejects duplicate events, reverse chronology, unchanged transitions and unattributed sources;
- the first vertical slice contains seven checkpoint movements and one state transition derived from immutable Salamat Projects Dashboard commits;
- each event retains its full commit SHA and direct GitHub evidence URL;
- report totals and the timeline are computed from the same schema-validated manifest;
- zero blocker changes are shown explicitly as no confirmed changes, without invented blocker activity;
- checkpoint, state and blocker filters visibly update the timeline, support reset and expose a truthful empty state;
- 39 automated tests pass, including history validation and report aggregation inputs;
- the production TypeScript/Vite build passes;
- desktop browser smoke at `1440x1000` verified report metrics, chronological evidence and filtering;
- mobile browser smoke at `390x844` verified the same controls and no horizontal overflow (`390/390`);
- history remains committed derived data and cannot edit repositories or become source of truth.

## CP-08 — Cloudflare Production
Status: `PASS`

Disposition:
- `REUSE_COMPONENT` — deploy the existing validated Vite output to Cloudflare Pages without adding a Worker, database or parallel runtime.

Evidence:
- local Wrangler `4.128.0` is installed and authenticated to the intended Cloudflare account;
- repeatable Pages configuration and build/deploy scripts are committed;
- Cloudflare Pages project `salamat-projects-dashboard` was created with production branch `main`;
- production deployment `7af63d62-979f-41d9-bd6c-070ed234d682` completed from commit `cd2e155`;
- `https://salamat-projects-dashboard.pages.dev/` returns HTTPS 200;
- proxied DNS record `CNAME projects → salamat-projects-dashboard.pages.dev` is active with TTL Auto;
- Cloudflare Pages reports custom domain `projects.salamat-mebel.kz` as `active`, including active ownership verification and HTTP validation;
- `https://projects.salamat-mebel.kz/` returns HTTPS 200 directly with a trusted TLS connection and no redirect loop;
- production browser evidence at desktop `1440x1000` verified Triage, Nodes and Reports, relationship selection with explicit `source → destination`, and the evidence inspector;
- production browser evidence at mobile `390x844` verified the responsive Reports view and no horizontal overflow (`390/390`);
- desktop document width equals the viewport width (`1440/1440`);
- browser console inspection produced no critical errors;
- no Worker, D1, KV, R2, Pages Functions, write-back or automatic synchronization was added.

### CP-08 extension — Automatic main deployment (2026-09-18)
Status: `PASS`

Evidence:
- GitHub Actions workflow `.github/workflows/deploy-cloudflare-pages.yml` runs on every push to `main` and supports manual dispatch;
- workflow uses repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; no secret values are committed;
- first production-triggering merge was PR #11, main commit `263a883308fb173e2448e360220ef4d70415b723`;
- GitHub Actions run `35341306057` completed successfully;
- `npm ci`, 73/73 tests, TypeScript/Vite build, credential presence check and Wrangler Pages deployment all completed successfully;
- deployment reused the existing Cloudflare Pages project `salamat-projects-dashboard`; no new Worker, Pages project, database or backend was created;
- the workflow's production verification fetched `https://projects.salamat-mebel.kz/project-state.json` after deployment and confirmed its SHA-256 matched the committed `public/project-state.json`;
- automatic production deployment from `main` is therefore active and verified.

## CP-09 — Codex App Server Experiment (Baseline)
Status: `BASELINE_COMPLETE`

Disposition:
- `EXTEND_EXISTING` — CP-09 baseline extends the existing dashboard with a strict, read-only Task Packet export contract and one-shot validation harness; no persistent orchestrator, database or cross-repository execution was introduced.

Evidence:
- `docs/CP09_CODEX_APP_SERVER_SCOPE.md` documents baseline scope, fail-closed validation, and security invariants;
- strict versioned `TaskPacket` contract (`src/contract/task-packet.ts`) schema version `1.0.0`;
- repository allowlist strictly permits only `Murkin1980/salamat-projects-dashboard`;
- fail-closed validation rejects unknown fields, missing required fields, and unsupported triage values;
- automated sensitive data / secret scanner detects GitHub PATs, Bearer tokens, API keys, private keys, passwords, cookies, and local absolute paths;
- read-only UI preview modal (`src/components/TaskPacketModal.tsx`) provides JSON preview, clipboard copy, file download, and side-effect-free cancellation;
- local one-shot stdio harness (`scripts/task-packet-harness.ts`) generates and validates packets via CLI without starting a daemon or executing tasks;
- 55 automated unit and negative tests pass;
- production build (`tsc -b && vite build`) passes.

## CP-10 — Monitoring-Only Cleanup
Status: `PASS` (merged 2026-09-15)

Disposition:
- `EXTEND_EXISTING` — the existing dashboard was cleaned in place. No new repository,
  control plane, backend, design system or MPE integration. Deep-change gate not
  triggered: UI removal only, no source-of-truth change, no data-model change, no write path.

Product boundary:
- `Salamat Projects Dashboard = Portfolio Monitoring UI` — the dashboard observes and
  visualizes; it does not execute work.

Removed from the UI:
- the `Continue` button on every project card (both the enabled and the disabled variant);
- the Task Packet modal and its Task Packet preview;
- `Raw JSON Payload`, `Копировать JSON` (Copy JSON) and `Экспорт JSON` (Export JSON);
- Codex App Server wording and the `CP-09 Codex App Server Experiment` sidebar badge;
- the `Можно запускать` KPI wording that implied launching work;
- `src/components/TaskPacketModal.tsx` and all styling that belonged to the removed UI.

Kept and tidied on the project card:
- project name, repository (with an explicit "Не привязан к репозиторию" state),
  operational status, current stage, progress, blocker, next step, last updated,
  source attribution and read-only evidence links;
- unresolved sources still render explicitly as `STATUS UNKNOWN` / `SOURCE CONFLICT`;
- History & Reports still carries significant-change history.

Evidence:
- 73 automated tests pass, including 4 new boundary regression tests
  (`tests/dashboard-monitoring-boundary.test.ts`) that render the real shell in a DOM at
  1440px and 390px and assert zero execution controls and full monitoring fields;
- production build (`tsc -b && vite build`) passes; CSS shrank from 47.94 kB to 43.00 kB
  and the client bundle from 568.81 kB to 557.53 kB;
- the retained Task Packet contract, harness and tests (MPE migration candidate) are no
  longer imported by any UI code;
- repository-wide search for `Continue`, `Task Packet`, `RAW JSON`, `Copy JSON`,
  `Export JSON`, `Arena`, `Codex`, `executor`, `execution`, `model selector`,
  `prompt editor`, `run task` leaves only legitimate documentation/history, project data
  and the retained migration candidate.

Retained migration candidate (owner decision required):
- `src/contract/task-packet.ts`, `scripts/task-packet-harness.ts`, `tests/task-packet.test.ts`
  and the `task-packet:harness` npm script. Forming a Task Packet is an MPE function, so
  the code was not migrated automatically and is not wired into the UI.
- `config/node-graphs.json` still holds the evidence-pinned `task-packet-builder` and
  `stage-cp09` nodes of the dashboard's own graph snapshot (historical evidence, pinned to
  commit `a62c7a94`); regenerating that snapshot is a separate follow-up.

Known gap (not introduced, not fixed here):
- no portfolio tier field (`P0` / `SUPPORT` / `HOLD` / `ARCHIVE`) exists in the `ProjectState`
  contract. Adding one changes the data contract and therefore needs explicit owner
  approval under the deep-change gate.

## Next
No new checkpoint is approved. Keep the dashboard monitoring-only. The retained Task Packet
contract migration/deletion and any portfolio tier field remain separate owner decisions.

## Blocker
No Cloudflare deployment credential blocker remains. Automatic main deployment is verified.
No active checkpoint blocker. Cloudflare crawler counts remain explicitly `UNAVAILABLE` until
the production token receives Zone Read / Analytics Read; the UI and collector fail closed and
never present missing analytics as zero traffic.

Last updated: 2026-09-25

## CP-11 — Portfolio Refresh
Status: `PASS`

Disposition:
- `EXTEND_EXISTING` — refresh the existing monitoring data and source coverage. No new repository, runtime, backend, workflow engine or write path.

Refresh scope:
- bring the committed portfolio snapshot forward to 2026-09-18;
- attach current repositories/evidence to active projects that were still represented as fixtures;
- add Murat House, Murat AI Orchestrator and Grand Mebel Document Control as explicit portfolio projects;
- update Murat Ads Control to its current CP-004 diagnostic state and blocker;
- update AI Microtask Factory from the stale MPE-only snapshot to direct repository evidence;
- preserve unresolved states as UNKNOWN/CONFLICT instead of inventing status;
- keep legacy portfolio cards unchanged when no newer attributable evidence is available.

Boundary:
- monitoring-only UI remains unchanged;
- no Task Packet, executor, agent/model control, repository write-back or autonomous action is introduced.

Validation:
- registry shape and invariants are checked before merge;
- `config/projects.github.json` and `public/project-state.json` must be byte-equivalent after the refresh;
- full npm test/build and Cloudflare production deployment remain external verification steps for this data-only checkpoint in the current connector-only environment.

External verification (2026-09-18, connector environment, base `2460d19`):
- snapshot checks PASS: 15 projects in `config/projects.json`, `config/projects.github.json`
  and `public/project-state.json` (schemaVersion `1.0.0`, generatedAt `2026-09-18`);
  `config/projects.github.json` and `public/project-state.json` are byte-identical
  (md5 `9f5a8a439ef59600d443c4d0538ddc4c`); Murat Ads Control `BLOCKED`,
  Murat House `READY`, Murat AI Orchestrator `READY`, Business Discovery
  `SOURCE CONFLICT`; UNKNOWN/CONFLICT states preserved with source attribution,
  nothing replaced by assumptions;
- three data-dependent test assertions left stale by the merged refresh were aligned
  with the committed snapshot (test-only changes, no product code touched):
  `tests/live-registry.test.ts` project count `12 → 15`;
  `tests/project-state.test.ts` injected-clock freshness dates now derive from the
  fixture `lastUpdated` + `staleAfterDays` boundary;
  `tests/task-packet.test.ts` now asserts the packet carries the registry triage state
  (currently `VALIDATION`) instead of a hard-coded `READY`;
- `npm ci` + `npm test`: 73/73 pass (0 fail);
- `npm run build` (`tsc -b && vite build`): PASS (CSS 43.00 kB, JS 561.73 kB);
- `git diff --check`: clean;
- monitoring-only boundary PASS: no Continue / Task Packet / Run / executor controls in
  any rendered view, no write-back calls in `src/` (read-only `GET /project-state.json`
  refresh only), the retained Task Packet contract is not imported by any UI code, and
  the CP-10 boundary regression tests at 1440px and 390px pass.

Deployment follow-up:
- the credential blocker is resolved through GitHub repository secrets;
- PR #11 merged to main at `263a883308fb173e2448e360220ef4d70415b723`;
- GitHub Actions run `35341306057` completed the Cloudflare Pages deployment successfully;
- production `project-state.json` matched the committed refreshed snapshot after deploy,
  proving the 15-project runtime snapshot reached production;
- no new Worker, Pages project, backend or infrastructure was created.

Final production validation (2026-09-25):
- desktop `1440×1000` rendered all 15 portfolio projects with document width `1440/1440`;
- mobile `390×844` rendered the complete Portfolio view with document width `390/390`;
- no critical browser console errors were observed;
- CP-11 post-deploy visual evidence is complete.


## CP-12 — Discovery Monitoring
Status: `PASS`

Disposition:
- `EXTEND_EXISTING` — owner explicitly requested crawler/search visibility inside the existing Salamat Projects Dashboard; no new repository or product was created.

Implemented:
- strict DiscoverySnapshot contract and known crawler registry;
- read-only Cloudflare GraphQL sync for `house.salamat-mebel.kz` using a bounded 24-hour analytics window;
- explicit UNAVAILABLE state on missing permission or source failure;
- Discovery view with Googlebot, Bingbot, AI crawler totals, crawler table and top paths;
- six-hour refresh added to the existing Cloudflare Pages production workflow;
- production discovery snapshot verification;
- dedicated contract tests and checkpoint PR validation workflow.

Validation evidence:
- Project Validation run `35566893213`: tests PASS, read-only Discovery sync exercise PASS, TypeScript/Vite build PASS;
- current Dashboard Cloudflare token cannot resolve the zone, so the collector correctly writes `UNAVAILABLE` instead of fake zero traffic;
- live crawler counts require Cloudflare Zone Read/Analytics access (or a safely configured Zone ID) before the source can become `OK`.

Boundary:
- monitoring only; no crawler blocking, robots.txt/WAF editing, Cloudflare setting mutation, backend, database or credential persistence.

Known external limitation:
- live Cloudflare crawler counts remain unavailable until the token receives Zone Read / Analytics Read; this is surfaced as `UNAVAILABLE`, not as fake zero traffic.

Final production validation (2026-09-25):
- deployment workflow run `36096477147` succeeded for main commit `bcfa51c` and verified both production snapshots;
- `https://projects.salamat-mebel.kz/discovery-analytics.json` returns HTTP 200 and a schema-valid `UNAVAILABLE` snapshot with the permission limitation stated explicitly;
- Discovery rendered its explicit unavailable state at desktop `1440×1000` and mobile `390×844`;
- document widths matched both viewports (`1440/1440`, `390/390`) with no horizontal overflow;
- no critical browser console errors were observed;
- full local suite passed 80/80 tests and the production TypeScript/Vite build passed after dependency sync.
