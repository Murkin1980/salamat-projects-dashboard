# Salamat Projects Dashboard

Operational portfolio dashboard for `projects.salamat-mebel.kz`.

## Purpose
A live control surface for Murat's active projects: triage, readiness, blockers, checkpoints, roadmap, reports and a node-based view of tools/plugins/services.

## Source of truth
This repository is the UI/control-plane repository. It must NOT become the canonical source of project truth.
Canonical project state remains in the project repositories and Murat Project Engineer (MPE) artifacts.

CP-04 consumes a committed normalized GitHub snapshot. Refresh it with a
temporary `GH_TOKEN` or `GITHUB_TOKEN`; tokens and raw private content are never
persisted. See `docs/GITHUB_SOURCE_ADAPTER.md`.

## Live triage

Run the UI and read-only source watcher in separate terminals:

```powershell
npm run dev
```

```powershell
$env:GH_TOKEN = gh auth token
npm run sync:github:watch
```

The browser polls the normalized runtime snapshot every 60 seconds. A failed or
invalid refresh is shown explicitly while the last valid state remains visible.

## Read first
1. `FOUNDATION.md`
2. `AGENTS.md`
3. `ARCHITECTURE.md`
4. `TRIAGE_RULES.md`
5. `CHECKPOINTS.md`
6. `PROJECT_STATUS.md`
7. `ROADMAP.md`
8. `docs/ICON_RESEARCH.md`

## Planned domain
`projects.salamat-mebel.kz`

## Deployment
Cloudflare only.
