# PROJECT STATE CONTRACT — CP-03, extended in CP-14

Status: APPROVED  
Schema version: `1.1.0`

## Purpose

`ProjectState` is the normalized, source-attributed state consumed by the dashboard. It is independent of any particular repository format. Source adapters are explicitly deferred to CP-04.

The executable source of truth for the contract is `src/contract/project-state.ts`. JSON entering the UI must pass `parseProjectRegistry`; unchecked type assertions are not allowed at this boundary.

## Required fields

Every project object contains:

- identity: `schemaVersion`, `id`, `name`, `summary`, `repo`;
- triage: `triageState`, `triageSource`;
- position: `stage`, `checkpoint`, `progress`;
- action: `lastUpdated`, `blocker`, `nextAction`;
- observation: `activity`, `session`;
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

## Project activity (CP-14)

Three timestamps are separated so activity is never confused with status or with the dashboard itself:

- `activity.lastMeaningfulActivity` — the newest attributable evidence that the project itself changed.
- `activity.statusUpdatedAt` — when the canonical status artifact was itself last updated.
- `activity.snapshotGeneratedAt` — when the dashboard produced the snapshot this state was read from.

Rules:

- `snapshotGeneratedAt` is never project activity. It is the only field that accepts the `SNAPSHOT` evidence source, and the schema rejects a `SNAPSHOT`-sourced `lastMeaningfulActivity` or `statusUpdatedAt`.
- A commit is activity evidence. It does not, by itself, change the operational status.
- `PROJECT_STATUS.md` (or the configured `STATUS.md` fallback) is the canonical project-status evidence; `ROADMAP.md` is supporting evidence for `statusUpdatedAt` only.
- Pull-request, workflow-run and check-run activity are valid evidence kinds.
- Missing data is never replaced by the current time. A timestamp is either `KNOWN` with `source`, `sourceId` and an optional `evidenceUrl`, or `UNAVAILABLE` with a reason.
- `getActivityFreshness(activity, now, staleAfterDays)` returns `FRESH`, `STALE` or `UNKNOWN`; missing activity is `UNKNOWN`, not stale.
- Equal timestamps resolve deterministically by evidence-source priority and then by `sourceId`.

### Evidence sources

`COMMIT | PULL_REQUEST | WORKFLOW_RUN | CHECK_RUN | PROJECT_STATUS | ROADMAP | MANUAL | FIXTURE | SNAPSHOT`

`MANUAL` means the value comes from a reviewed manual read-only observation recorded in the registry. `FIXTURE` means a fixture-only project with no repository source.

## Arena session (CP-14)

The dashboard additionally observes the state of the Arena execution session of a project. This is a read-only observation contract; the dashboard never starts, continues, retries, validates or closes an Arena session, and it holds no session-control action anywhere.

`session.sessionState` is exactly one of:

| state | meaning |
| --- | --- |
| `NOT_ACTIVE` | canonical evidence declares that no Arena session is running |
| `ACTIVE` | an evidenced session is working on a checkpoint |
| `WAITING_FOR_VALIDATION` | implementation work is finished and required validation is pending |
| `READY_TO_CLOSE` | checkpoint work is factually complete and mandatory results are present, but explicit session closure is not confirmed |
| `CLOSED` | explicit session-closure evidence exists |
| `STALE_SESSION` | a session still looks open, but no attributable activity exists within the inactivity threshold |
| `UNKNOWN` | the available evidence cannot determine the session state |

Session evidence fields:

```text
sessionState
sessionCheckpoint        // checkpoint the session is executing, or null
sessionStartedAt         // KNOWN with provenance, or UNAVAILABLE with a reason
sessionLastActivityAt    // KNOWN with provenance, or UNAVAILABLE with a reason
sessionClosureStatus     // CONFIRMED | NOT_CONFIRMED | UNKNOWN
sessionClosureEvidence   // explicit closure reference, required exactly when closure is CONFIRMED
sessionStateEvidence[]   // evidence the state was derived from, empty only for UNKNOWN
sessionStateReason       // human-readable provenance of the derived state
```

### Canonical session evidence

Arena writes its session lifecycle into the canonical status artifact (`PROJECT_STATUS.md`, or the configured `STATUS.md` fallback) as an optional block:

```markdown
## Arena Session
Session state: `ACTIVE`
Session checkpoint: `CP-14 — Portfolio Activity & Arena Session State Contract`
Session started: 2026-10-01T09:12:00Z
Last session activity: 2026-10-01T14:32:00Z
Session closure: `NOT_CONFIRMED`
Session closure evidence: https://github.com/owner/repo/pull/12
```

Recognized values: `Session state` ∈ `NOT_ACTIVE | ACTIVE | WAITING_FOR_VALIDATION | CLOSED`; `Session closure` ∈ `CONFIRMED | NOT_CONFIRMED`. Timestamps are second-precision UTC. An absent block, an unrecognized value or an unreadable repository stays explicit: the derived state is `UNKNOWN` with a reason, never `CLOSED`.

### Invariants that must never be weakened

- `merge != CLOSED`, `commit != CLOSED`, `PROJECT_STATUS update != CLOSED`.
- `CLOSED` requires `sessionClosureStatus: CONFIRMED` and non-null `sessionClosureEvidence`. The schema rejects any other combination.
- A declared closure without closure evidence does not become `CLOSED`; when checkpoint work is complete it becomes `READY_TO_CLOSE`.
- An open session state (`ACTIVE`, `WAITING_FOR_VALIDATION`, `READY_TO_CLOSE`, `STALE_SESSION`) cannot carry confirmed closure and requires an attributable `sessionLastActivityAt`.
- Session timestamps can never be attributed to `SNAPSHOT`; the schema rejects it.
- Insufficient evidence is `UNKNOWN`, never an inference such as "the last commit was long ago, so the session must be closed".
- The inactivity threshold is `ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS = 24`. At or beyond the threshold an evidenced-but-idle session is `STALE_SESSION`.
- `UNKNOWN` is the only state allowed to carry no evidence references.

When a session is evidenced but carries no session-activity timestamp of its own, derivation may fall back to the newest attributable project activity; the resulting `sessionLastActivityAt` keeps its real source (`COMMIT`, `PROJECT_STATUS`, …) and the reason states that a project-activity fallback was used.

## Observation cadence

The dashboard analyzes the whole configured portfolio only inside the existing scheduled/manual synchronization cycle (`00:17`, `06:17`, `12:17`, `18:17` `Asia/Almaty` plus `workflow_dispatch`). No realtime monitoring, webhook or browser-driven session polling is added.

A post-merge `PROJECT_STATUS.md` update is a **source event for the next full portfolio reconciliation**, not a trigger for continuous monitoring or for a single-project sync. The next synchronization always re-reads the entire configured portfolio.

## Validation rules

- objects are strict; unknown keys fail validation;
- schema version must be exactly `1.1.0` in the registry and in every project;
- IDs use lowercase ASCII slugs and are unique within the registry;
- repositories are `owner/repo` or `null`;
- dates are real ISO calendar dates in `YYYY-MM-DD` format;
- timestamps are second-precision UTC (`YYYY-MM-DDTHH:MM:SSZ`);
- progress is `null` or non-negative integer completion over a positive total, with `completed <= total`;
- `BLOCKED` requires a concrete blocker;
- `ACTION_NOW` requires a concrete next action;
- a project cannot depend on itself;
- evidence, dependencies, tools and approvals carry source attribution;
- session rules from the previous section are enforced by the schema.

## Stale-data handling

Freshness is derived, never stored as an invented status. `getFreshness(project, now)` accepts an injected clock for deterministic behavior. A project becomes `STALE` when elapsed whole days are greater than or equal to `staleAfterDays`; the fixture policy is seven days, matching `TRIAGE_RULES.md`. Activity freshness uses the same thresholds through `getActivityFreshness`.

## Versioning

- major: breaking field or semantic change;
- minor: backward-compatible additive capability;
- patch: compatible validation/documentation correction.

`1.1.0` adds the `activity` and `session` blocks (CP-14). The objects are strict, so a snapshot produced before `1.1.0` must be regenerated by the synchronization instead of being accepted.

Changing the seven canonical triage states, or adding a session-control capability, remains a deep change requiring explicit approval.

## CP-03 / CP-14 boundaries

Included: schema, normalized fixtures, deterministic derivation, runtime parsing, deterministic tests and UI consumption.

Excluded: GitHub/MPE write access, network synchronization beyond the existing read-only sync, automatic triage derivation, automatic session closure and workflow execution. A session-control capability is out of scope for this product.
