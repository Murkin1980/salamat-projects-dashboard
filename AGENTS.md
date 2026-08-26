# AGENTS — mandatory instructions

Before coding, every coder/agent must read in order:
`FOUNDATION.md` → `ARCHITECTURE.md` → `TRIAGE_RULES.md` → `CHECKPOINTS.md` → `PROJECT_STATUS.md` → `ROADMAP.md`.

## Mandatory behavior
- Preserve all Foundation invariants.
- Prefer extending existing components over parallel implementations.
- Do not add a runtime/orchestrator to Node View.
- Do not hard-code project status when a source adapter can provide it.
- Do not claim data is live until source synchronization is implemented and tested.
- Keep raw source data separate from normalized dashboard state.
- All substantial changes must map to a checkpoint.
- Update `PROJECT_STATUS.md` only after checkpoint evidence exists.
- Update `ROADMAP.md` when scope/order changes.
- Record architecture decisions under `docs/` before deep changes.

## Definition of done for a checkpoint
Implementation + tests + source-of-truth verification + responsive check + documentation update + commit/push + deployment verification when applicable.
