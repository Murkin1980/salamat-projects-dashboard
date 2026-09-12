# CP-06 extension — Multi-project Node Graphs

Checkpoint: `CP-06 — Flow / Nodes MVP` (extension, no new checkpoint number)
Disposition: `EXTEND_EXISTING`
Date: 2026-09-13
Baseline commit: `a62c7a94a71f130929b8c6be098849b716257483` (`main`)

## 1. Scope

The Nodes view previously rendered exactly one hard-coded graph
(`business-discovery`) through `<NodeView graph={businessDiscoveryGraph}/>`.
This extension lets the same read-only `NodeView` render a selected graph out of
the existing `config/node-graphs.json` registry.

In scope:

- parse the whole `NodeGraphRegistry` once and keep `graphs`;
- one active project id (`activeProjectId`) resolving an active graph by `projectId`;
- a compact project selector that offers **only** projects with a graph entry;
- an explicit empty state when no graph exists for the active selection;
- four verified graph entries added next to the untouched Business Discovery graph.

Out of scope (explicitly not built): `deriveNodeGraph()` generation from
`projects.github.json`, backend/Worker/DB, new registry format or schema version,
live writes, node editing, drag persistence, runtime AI generation, a new sync engine.
`FOUNDATION.md`, `ARCHITECTURE.md`, `AGENTS.md`, `TRIAGE_RULES.md` semantics,
Task Packet semantics, Reports semantics and the GitHub sync architecture are unchanged.

## 2. Registry contents (5 graphs)

| graph id / projectId | sourceState | nodes / edges | evidence |
| --- | --- | --- | --- |
| `business-discovery` | `CONFLICT` | 18 / 17 | unchanged from CP-06 |
| `murat-project-engineer` | `KNOWN` | 16 / 20 | `STATUS.md`, `docs/NEW_IDEA_FILTER_POLICY.md`, `playbooks/deep-change.md`, `gates/registry.yaml`, `docs/experiments/*`, `experiments/exp-002-machine-protocol/*`, `scripts/earned_autonomy.py`, `scripts/task_acceptance.py`, `skills/ux-ui/*`, `docs/OPERATING_MODEL.md` @ `9c0c39b` |
| `minibase-cloudflare` | `KNOWN` | 13 / 16 | `README.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `docs/SCALABILITY.md`, `docs/PROJECT_ISOLATION.md`, `CP06_AUDIT.md`, `src/files-api.ts` @ `a139b47`; CP-05 commit `de8f578` |
| `salamat-projects-dashboard` | `KNOWN` | 15 / 18 | `PROJECT_STATUS.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `docs/GITHUB_SOURCE_ADAPTER.md`, `docs/CP05_LIVE_TRIAGE_SCOPE.md`, `src/adapters/github-source.ts`, `src/triage/live-triage.ts`, `src/components/NodeView.tsx`, `src/components/ReportView.tsx`, `src/contract/task-packet.ts`, `wrangler.jsonc` @ `a62c7a9` |
| `ai-microtask-factory` | `UNKNOWN` | 11 / 12 | MPE portfolio snapshot `dashboard/public/index.html` and `docs/OPERATING_MODEL.md` @ `9c0c39b` only |

Every node and edge carries `sourceId` and a commit-pinned `evidenceUrl`; graphs are
validated by the strict existing `NodeGraphSchema` (no schema or version change).

### sourceState semantics used by this extension

- `KNOWN` — the graph is built only from readable, mutually consistent sources.
- `CONFLICT` — readable sources disagree (Business Discovery branches; MiniBase
  `ROADMAP.md` still reports "CP-04 of 10 / 40%" although CP-05 and CP-06 are merged).
- `UNKNOWN` — a required source is not readable, so nothing about it is claimed.

## 3. Deliberate UNKNOWN / CONFLICT states (not guessed)

1. **`ai-microtask-factory` repository is not readable from this session**
   (`Murkin1980/ai-microtask-factory` → HTTP 404, no public trace). Therefore:
   `sourceState: UNKNOWN`, the project node is `NEUTRAL`, and only what the MPE
   portfolio snapshot documents exists in the graph (Stage 4 Spreadsheet Cleanup,
   remote preview, operational deadlines, Task Detail, controlled acceptance,
   acceptance receipt → execution, next gate "real orders").
   The requested subsystems Task Packet / Runner / Execution / QC / Artifacts were
   **not** created: no source in this session verifies them. No BRANCH node either —
   no divergence evidence exists.
2. **MiniBase `ROADMAP.md` counter conflicts with merged commits.** The conflict is
   shown as a `CONFLICT` evidence node instead of inventing a progress number; the
   CP-05/CP-06 stages cite their merge commits.
3. **Murat Project Engineer has no canonical `Status:` label.** Its graph is `KNOWN`
   because every node is file-verified, but the dashboard triage for that project
   stays `UNKNOWN` (unchanged CP-04 behaviour) and the evidence node says so.
4. **No FUTURE nodes without documentation.** FUTURE nodes exist only where a source
   states a future state: EXP-13 Pilot Batch 1 (pre-registered, not executed),
   MiniBase CP-07…CP-10, and the AI Microtask Factory "real orders" gate.

## 4. Project registry extension

`minibase-cloudflare` and `ai-microtask-factory` were not project ids in the
dashboard registry, so graph `projectId`s could not resolve. Both were added to
`config/projects.json` (base registry used by the sync merge), `config/projects.github.json`
and `public/project-state.json` with:

- `triageState: null` and an explicit `triageSource: { status: 'UNKNOWN', reason }`;
- attributed `evidenceLinks` (MiniBase from its own repository, AI Microtask Factory
  from the MPE portfolio snapshot);
- `source.kind: REPOSITORY` for MiniBase and `source.kind: MPE` for AI Microtask Factory.

No status is asserted for either project: they render as `STATUS UNKNOWN`, which is the
existing, honest representation for unresolved sources. `config/source-repositories.json`
was intentionally not modified: the source adapter currently cannot complete a run from
this environment (`Murkin1980/business-discovery` is not readable), and the extension must
not break the existing live pipeline. The two entries are merge-preserved, so a later
sync that adds MiniBase to the adapter configuration will replace them with adapter-derived
state.

## 5. UI behaviour

- `src/graph/node-graph.ts` — `listNodeGraphProjects()` (selector options from the parsed
  registry only) and `resolveActiveNodeGraph()` (unknown/empty selection → `null`).
- `src/components/NodesView.tsx` — owns `activeProjectId`, renders the switcher and passes
  the resolved graph into the existing `NodeView`; switching remounts `NodeView` per graph id.
- Keyboard: WAI-ARIA tabs pattern (`role="tablist"` / `tab` / `tabpanel`,
  `aria-selected`, `aria-controls`, `aria-labelledby`, roving `tabindex`), `ArrowLeft`,
  `ArrowRight`, `Home`, `End`. The global `:focus-visible` outline is untouched.
- Mobile: the switcher is a horizontally scrollable chip row (no page-level overflow),
  touch targets ≥ 44 px; the graph itself keeps the existing mobile node/edge lists.
- `NodeView` changes are limited to: graph-driven default selection (previous `auditor`
  default preserved when present), graph name in the canvas label, and a source-state badge
  that no longer shows a warning icon for `KNOWN`.

## 6. Verification

- `npm test` — 60/60 passing (5 new node-graph checks: ≥ 5 valid graphs, `projectId`
  resolves to an existing project id, selector mirrors the registry, switching changes the
  graph, missing graph resolves safely; Business Discovery asserted at 18 nodes / 17 edges
  and `CONFLICT`).
- `npm run build` — `tsc -b && vite build` passes.
- Behavioural DOM check (scratch jsdom harness, not committed, no project dependency):
  19/19 checks — 5 tabs for 5 graphs, click and `ArrowRight`/`Home`/`End` switch the graph,
  `SOURCE KNOWN`/`SOURCE UNKNOWN` badges follow the graph, existing node-type and
  relationship filters still render and work, Business Discovery inventory preserved,
  empty registry renders the explicit empty state without crashing.
- `git diff --check` clean; Business Discovery graph block byte-identical to baseline.
- Responsive: CSS audit only (no browser binary is downloadable in this environment —
  Playwright/Puppeteer CDNs are unreachable). The switcher cannot widen the page: it is a
  block-level flex container with `overflow-x: auto` inside `min-width: 0` ancestors, and
  the added CSS contains no fixed widths. Desktop/mobile pixel checks remain a manual
  browser step; the built `dist/` is served for that purpose.
