# PROJECT STATUS

Decision: `REUSE_COMPONENT`

Current checkpoint: `CP-09 — Codex App Server Experiment`
Status: `IN_PROGRESS` (Baseline complete)

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

## Next
Evaluate Codex App Server integration under Murat review and experiment gates without violating dashboard read-only boundaries.

## Blocker
None.

Last updated: 2026-09-03
