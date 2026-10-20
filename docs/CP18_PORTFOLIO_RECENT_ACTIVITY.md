# CP-18 — Portfolio Recent Activity Feed

Disposition: `EXTEND_EXISTING`

## Result

The existing live `ProjectState.history` data now powers one read-only,
cross-project Recent Activity view at `#/activity`.

- The feed aggregates evidence-backed events from every project and applies the
  existing deterministic history ordering.
- The compact window is limited to the newest 20 events.
- A project selector filters the same feed without changing the snapshot.
- Each event links to its Project Detail route and its original GitHub evidence.
- Session lifecycle events, including `READY_TO_CLOSE`, `CLOSED` and
  `STALE_SESSION`, remain separate from operational project state and appear
  only when the normalized history contains attributable session evidence.
- Projects without readable history stay explicit; the view reports coverage
  and never fabricates events.

## Boundary

No contract/schema change, source adapter, backend, database, realtime channel,
notification, task queue, execution control or session control was added. The
view reads the same periodically synchronized snapshot as the rest of the
dashboard.

## Validation

- `npm test`: 284/284 passed.
- `npm run build`: passed (`tsc -b && vite build`).
- `npm run verify:snapshot`: passed — schema `1.2.0`, version 6, 15 projects,
  no credentials detected.
- `git diff --check`: clean.
- Real Chromium validation passed at 1440×1000 and 390×844.
- Mobile document width matched the viewport (`390/390`); the feed rendered 20
  events and the unavailable-history filter state remained explicit.
- Browser console contained no application error; the only entry was the
  pre-existing missing `favicon.ico` request.

`PROJECT_STATUS.md` must be updated only after PR merge and production
validation, in accordance with the mandatory post-merge status rule.
