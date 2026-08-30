# CP-07 — History & Reports Scope

Primary disposition: `EXTEND_EXISTING`

## New Idea Filter

1. Existing overlap: CP-04/05 already normalize current GitHub/MPE state, but do not preserve or present transitions.
2. Reuse: extend the existing dashboard, source attribution model, status vocabulary and evidence-link pattern.
3. Duplicate infrastructure: no database, analytics service, event bus or second project-management store.
4. Outcome: Murat can see when the dashboard moved between checkpoints and whether blocker changes were actually evidenced.
5. Smallest validation: one strict Git-backed history vertical slice for Salamat Projects Dashboard.
6. Priority: closes the last product checkpoint before Cloudflare production; broader portfolio history remains later work.
7. Deep-change risk: low because the manifest is derived, committed, read-only and never authoritative.

## Included

- strict, versioned and source-attributed history manifest contract;
- checkpoint and state transitions derived from immutable Git commits;
- evidence-backed timeline with event-type filters;
- report summary for checkpoint movement, state changes and blocker changes;
- explicit zero state when no blocker changes are evidenced;
- responsive desktop and mobile presentation.

## Excluded

- persistent database or background event ingestion;
- manual history editing or dashboard-authored truth;
- invented blocker events or inferred dates;
- charts that imply statistical significance from the first vertical slice;
- portfolio-wide history extraction, exports, scheduled reports and notifications;
- Cloudflare deployment, which remains CP-08.

## Acceptance

1. Every event has a commit SHA and immutable GitHub evidence URL.
2. Events are deterministically ordered and invalid dates/duplicates are rejected.
3. Filters visibly change the timeline and can be reset.
4. Checkpoint, state and blocker-change counts come from the same parsed manifest.
5. No blocker change renders as an explicit evidenced zero, not fabricated activity.
6. Desktop and mobile provide the same events without horizontal page overflow.
