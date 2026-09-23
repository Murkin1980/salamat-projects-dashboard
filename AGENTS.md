<!-- MPE:SCOPE-CHANGE-CONTROL:START -->
## Mandatory first read — MPE Scope & Change Control

Before planning, coding, refactoring, dependency changes, testing strategy, deployment, or checkpoint execution, read:

- `docs/governance/SCOPE-CHANGE-CONTROL.md`

Read it before project-specific source-of-truth documents. Then follow this repository's local rules and the current checkpoint/spec.

The scope policy governs minimal change, reuse, checkpoint boundaries, deep-change, testing, evidence, change-size/merge-pressure, merge/deploy authority, and stopping conditions.

If a local rule appears to conflict with the scope policy, apply the documented source-of-truth priority. Do not silently weaken either rule; surface a deep-change conflict when required.
<!-- MPE:SCOPE-CHANGE-CONTROL:END -->

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
