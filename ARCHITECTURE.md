# ARCHITECTURE

## Role
`Salamat Projects Dashboard = Portfolio Monitoring UI`.

Standalone deployable **read-only** monitoring UI linked to Murat Project Engineer and project repositories.
It observes and visualizes portfolio state. It does not execute work.

## Product boundary (locked in CP-10)
Dashboard — observes and visualizes only:
- renders normalized project state, triage, blockers, next steps, evidence and history;
- no task execution, no agent/model/runner controls, no Task Packet generation or export,
  no Codex/Arena integration, no write-back to any repository.

`murat-project-engineer` (MPE) — decides, forms Task Packets, manages execution,
evidence, governance and Arena/Codex integration.

GitHub — source of factual changes, PRs and evidence.

Operational status is project state, never executor availability:
`READY` means "the project is ready for the next work", not "Codex/Arena/executor is available".

## Data path
Project repositories / MPE
→ source adapters
→ normalized `ProjectState`
→ triage engine
→ dashboard views

## Production data path (CP-13)
The scheduled Cloudflare Pages workflow keeps the portfolio snapshot current:

```text
GitHub repositories
→ npm run sync:github -- --output config/projects.github.json
→ config/projects.github.json
→ public/project-state.json        (same run, byte-identical)
→ npm run build
→ Cloudflare Pages
→ Dashboard (browser polls project-state.json every 60 s)
```

One synchronization mechanism, no backend, no Worker, no database and no new API.
The sync runs before the build and fails closed, so a GitHub outage preserves the
last valid committed snapshot instead of publishing damaged or empty data.

## Views
1. Triage — main operational screen
2. Portfolio — all projects
3. Attention — stale/blocker/approval signals
4. Flow / Nodes — project/tool/plugin/service graph
5. Roadmap — checkpoint trajectory
6. Reports — historical changes and summaries

## Proposed MVP stack
- React + TypeScript + Vite
- `@xyflow/react` for node canvas
- `@tabler/icons-react` for system/node/file/UI icons
- Simple Icons for service/brand marks
- Cloudflare Pages for deployment

## Boundaries
React Flow is a rendering/interactivity component only. Business truth and execution authority remain outside the canvas.

## Normalized ProjectState (conceptual)
- id
- name
- repo
- triageState
- stage
- checkpoint
- progress
- lastUpdated
- blocker
- nextAction
- evidenceLinks[]
- dependencies[]
- tools[]
- approvals[]
