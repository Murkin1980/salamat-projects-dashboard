# ARCHITECTURE

## Role
Standalone deployable UI/control plane linked to Murat Project Engineer and project repositories.

## Data path
Project repositories / MPE
→ source adapters
→ normalized `ProjectState`
→ triage engine
→ dashboard views

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
