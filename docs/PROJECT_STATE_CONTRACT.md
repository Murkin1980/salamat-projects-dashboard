# PROJECT STATE CONTRACT — CP-03

Status: APPROVED  
Schema version: `1.0.0`

## Purpose

`ProjectState` is the normalized, source-attributed state consumed by the dashboard. It is independent of any particular repository format. Source adapters are explicitly deferred to CP-04.

The executable source of truth for the contract is `src/contract/project-state.ts`. JSON entering the UI must pass `parseProjectRegistry`; unchecked type assertions are not allowed at this boundary.

## Required fields

Every project object contains:

- identity: `schemaVersion`, `id`, `name`, `summary`, `repo`;
- triage: `triageState`, `triageSource`;
- position: `stage`, `checkpoint`, `progress`;
- action: `lastUpdated`, `blocker`, `nextAction`;
- evidence and relationships: `evidenceLinks[]`, `dependencies[]`, `tools[]`, `approvals[]`;
- attribution and freshness policy: `source`, `staleAfterDays`.

Fields are required structurally. Values that are genuinely unavailable use explicit `null` where the schema permits it; missing keys are invalid. Collections are always present and use an empty array when no attributable items exist.

## Triage and UNKNOWN semantics

The canonical triage model remains exactly:

`ACTION_NOW | BLOCKED | READY | IN_PROGRESS | VALIDATION | HOLD | DONE`

`UNKNOWN` is not an eighth triage state. Unresolved data uses `triageState: null` together with:

- `triageSource.status: UNKNOWN` and a reason; or
- `triageSource.status: CONFLICT`, at least two source IDs, and a reason.

A known triage state requires `triageSource.status: KNOWN` and an attributable `sourceId`. The UI renders unresolved attribution explicitly and never silently chooses a state.

## Validation rules

- objects are strict; unknown keys fail validation;
- schema version must be exactly `1.0.0`;
- IDs use lowercase ASCII slugs and are unique within the registry;
- repositories are `owner/repo` or `null`;
- dates are real ISO calendar dates in `YYYY-MM-DD` format;
- progress is `null` or non-negative integer completion over a positive total, with `completed <= total`;
- `BLOCKED` requires a concrete blocker;
- `ACTION_NOW` requires a concrete next action;
- a project cannot depend on itself;
- evidence, dependencies, tools and approvals carry source attribution.

## Stale-data handling

Freshness is derived, never stored as an invented status. `getFreshness(project, now)` accepts an injected clock for deterministic behavior. A project becomes `STALE` when elapsed whole days are greater than or equal to `staleAfterDays`; the fixture policy is seven days, matching `TRIAGE_RULES.md`.

## Versioning

- major: breaking field or semantic change;
- minor: backward-compatible additive capability;
- patch: compatible validation/documentation correction.

Changing the seven canonical triage states remains a deep change requiring explicit approval.

## CP-03 boundaries

Included: schema, normalized fixtures, runtime parsing, deterministic tests and UI consumption.  
Excluded: GitHub/MPE adapters, network synchronization, automatic triage derivation and workflow execution.
