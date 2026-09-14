# CP-10 — Monitoring-Only Cleanup (scope)

## 1. Decision
`EXTEND_EXISTING` — clean the existing dashboard. No new repository, no new control plane,
no new backend, no MPE integration, no new monitoring features.

## 2. Goal
Restore the product boundary:

`Salamat Projects Dashboard = Portfolio Monitoring UI`

The dashboard only shows project state. It does not run tasks, launch agents,
generate Task Packets or control Codex/Arena.

## 3. In scope
- Remove from the UI: the `Continue` button (both enabled and disabled states), the Task
  Packet modal, Task Packet preview, RAW JSON payload, Copy JSON, Export JSON,
  Codex/Arena wording, the CP-09 experiment badge in the sidebar, and the
  "Можно запускать" KPI wording that implied launching work.
- Delete the styling that belongs to the removed UI.
- Keep and tidy the monitoring fields on the project card: name, repository,
  operational status, current stage, progress, blocker, next step, last updated,
  source attribution and evidence links.
- History & Reports stays as the view for significant change history.
- Lock the boundary with a regression test.

## 4. Out of scope (scope guard)
- New monitoring features, charts, automation, AI summaries.
- New backend, new design system, new repository.
- MPE integration or migration of Task Packet code into MPE.
- Adding a portfolio tier field (`P0` / `SUPPORT` / `HOLD` / `ARCHIVE`) — no such field
  exists in `ProjectState` today; introducing it changes the data contract and needs
  explicit owner approval (deep-change gate).
- Any change that turns the dashboard from read-only into write.

## 5. Retained code and why
`src/contract/task-packet.ts`, `scripts/task-packet-harness.ts`, `tests/task-packet.test.ts`
and the `task-packet:harness` npm script are **not** deleted. Forming a Task Packet is an
MPE responsibility, so this code is recorded as an **MPE migration candidate**: it stays
unwired, is never imported by the UI, and is not migrated automatically.

Follow-up decision for the owner: move it to `murat-project-engineer`, or delete it.

`config/node-graphs.json` still contains the evidence-pinned `task-packet-builder` and
`stage-cp09` nodes of the dashboard's own graph snapshot. They are historical evidence
pinned to commit `a62c7a94`; regenerating that snapshot is a separate follow-up.

## 6. Deep-change gate
Not triggered. This checkpoint removes UI only: no source-of-truth change, no data-model
change, no write path, no new runtime.

## 7. Definition of done
- Tests pass (`npm test`), production build passes (`npm run build`).
- Boundary regression test proves no execution control renders at 1440px and 390px.
- Repository-wide search for `Continue`, `Task Packet`, `RAW JSON`, `Copy JSON`,
  `Export JSON`, `Arena`, `Codex`, `executor`, `execution`, `model selector`,
  `prompt editor`, `run task` classifies every hit.
- Documentation updated: `FOUNDATION.md`, `ARCHITECTURE.md`, `README.md`,
  `CHECKPOINTS.md`, `ROADMAP.md`, `PROJECT_STATUS.md`.
