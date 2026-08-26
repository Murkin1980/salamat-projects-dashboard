# FOUNDATION — Salamat Projects Dashboard

## 1. Product thesis
The dashboard is a live operational control surface for the project portfolio, not a static picture and not a second project-management database.

It answers five questions immediately:
1. What needs action now?
2. What is blocked?
3. What is ready to move?
4. What is currently in progress or validation?
5. How are projects, agents, tools, plugins and services connected?

## 2. Product invariants
- GitHub/MPE project artifacts remain the source of truth.
- Dashboard state is derived, normalized and cached; it must not silently invent project status.
- Triage is the primary working view.
- Node/Flow is a visual and configuration layer, not a new workflow runtime.
- No duplication of n8n/LangGraph/Temporal-style orchestration.
- Every status must be explainable from source evidence.
- Every blocker must point to its source or responsible checkpoint.
- Every project card must expose current stage/checkpoint, next action and last update.
- Manual overrides must be explicit, attributable and reversible.
- Destructive or authority-changing actions require explicit approval.
- Cloudflare is the deployment target.
- Mobile usability is mandatory; desktop remains the richer editing surface.

## 3. Triage states
`ACTION_NOW | BLOCKED | READY | IN_PROGRESS | VALIDATION | HOLD | DONE`

## 4. Node principles
Nodes may represent projects, agents, tools, plugins, models, stores, services, documents, checkpoints and external systems.
Edges explain real relationships: uses, reads, writes, deploys, depends_on, reviews, triggers, reports_to.

Nodes do not execute an independent workflow engine in MVP.

## 5. Deep-change gate
Explicit approval is required before:
- introducing a new workflow/runtime engine;
- making dashboard state authoritative over project repositories;
- autonomous execution across repositories;
- automated destructive actions;
- changing the canonical triage state model;
- adding persistent secrets/credentials storage;
- replacing MPE as portfolio source of truth.

## 6. Quality bar
No decorative fake progress. No invented dates. No fake blockers. No generated project relationships without evidence.
