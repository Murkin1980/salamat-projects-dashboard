# CP-05 — Live Triage Scope

Primary disposition: `EXTEND_EXISTING`

## Outcome

The existing dashboard consumes a refreshable normalized registry, derives
triage consistently, and explains why a project appears in Attention. Source
changes propagate through the sync process without editing project cards.

## Included

- repeatable read-only GitHub synchronization with an optional watch interval;
- atomic normalized cache publication for the browser runtime;
- browser polling and an explicit refresh control;
- visible loading, last-success and failure states;
- deterministic triage precedence and Attention signals for source conflicts,
  unknown source state, blockers, pending approvals, validation and staleness;
- unit tests, production build and responsive browser verification.

## Security and authority

- `GH_TOKEN` / `GITHUB_TOKEN` remain process-only environment inputs;
- raw repository content remains in memory and is never published;
- only schema-validated normalized `ProjectState` is written;
- derived triage is presentation state, not a write-back or manual override;
- GitHub/MPE repositories remain authoritative.

## Excluded

- persistent credential storage or browser-side GitHub credentials;
- Cloudflare production deployment and secrets (CP-08);
- transition history and reports (CP-07);
- Flow / Nodes implementation (CP-06);
- cross-repository execution, write-back or destructive actions.

## Acceptance

1. A changed normalized runtime snapshot appears without editing React cards.
2. Refresh failures preserve the last valid state and show an explicit error.
3. Attention shows a source-backed reason for every listed project.
4. BLOCKED precedence, pending approval, UNKNOWN/CONFLICT and staleness are
   deterministic under an injected clock.
5. Tokens and raw private content are absent from runtime artifacts.
