# CP-20 — Production UX & Acceptance

Disposition: `EXTEND_EXISTING`

Status: `VALIDATION` — implementation and acceptance evidence are complete;
post-merge production deployment verification remains the final gate.

## Result

CP-20 performed the final acceptance pass over the existing read-only portfolio
monitoring product. No product feature, source contract, synchronization path,
backend, Worker, database, dependency, execution control or session control was
added. The existing implementation already satisfied the checkpoint, so the only
repository changes are checkpoint evidence and status documentation.

## Acceptance matrix

| Requirement | Evidence | Result |
|---|---|---|
| Portfolio → Project Detail | Production card/deep-link navigation at 1440px and 390px | PASS |
| Project and Arena session states remain separate | DONE project rendered with STALE_SESSION and explicit “DONE does not mean CLOSED” explanation | PASS |
| Recent Activity and History | Production Activity feed and project History rendered attributable events newest-first | PASS |
| Source evidence | Project Detail, Activity and Reports exposed direct GitHub evidence links | PASS |
| Return to portfolio | Project Detail “Портфель” action returned to `#/portfolio` | PASS |
| Deep links and refresh-safe routing | Existing route tests plus direct production hash routes | PASS |
| Loading/empty/stale/UNKNOWN/UNAVAILABLE states | Existing regression suite covers polling/loading failure, empty filters, stale activity/session, unknown source/session and unavailable source/history | PASS |
| Session-state vocabulary | Automated contract/rendering tests cover ACTIVE, WAITING_FOR_VALIDATION, READY_TO_CLOSE, CLOSED, STALE_SESSION and UNKNOWN | PASS |
| Monitoring-only boundary | Existing desktop/mobile boundary tests plus production DOM inspection: no forms, writable inputs or execution/session controls | PASS |
| Mobile layout | 390×844 production Activity and Project Detail: document/body width 390px, no horizontal overflow | PASS |
| Desktop layout | 1440×1000 production Project Detail: document width 1440px, no horizontal overflow | PASS |
| Browser console | Production desktop/mobile journey reported 0 errors and 0 warnings | PASS |

## Automated verification

- `npm test`: 295/295 passed.
- `npm run build` (`tsc -b && vite build`): PASS.
- `npm run verify:snapshot`: PASS — schema `1.2.0`, version 7, 15 projects,
  no credentials detected; mutually exclusive primary coverage sum 15/15.
- `git diff --check`: clean before the acceptance evidence commit.

The existing regression suite already covers the CP-20 behavior, including all
session classifications, list/detail/report consistency, navigation and deep links,
mobile/desktop rendering, hostile and empty data, coverage gaps and the read-only
boundary. No duplicate test file was added solely to increase the test count.

## Production browser validation

Target: `https://projects.salamat-mebel.kz/`

Checked with real Chromium on 2026-10-24:

- desktop `1440×1000`: Triage, Portfolio, Reports, Project Detail, History,
  source evidence and return navigation;
- mobile `390×844`: Recent Activity → Project Detail, session state, history,
  source evidence and responsive navigation;
- production runtime showed explicit coverage `15` projects, session coverage
  `1/15`, history coverage `2/15`, STALE_SESSION for the unclosed dashboard
  session, UNKNOWN/UNAVAILABLE gaps without fabrication, and the merged CP-19
  events in Activity/History;
- no horizontal overflow, console errors or warnings were observed;
- no forms, writable inputs, task execution actions or session controls exist.

## Scope boundary

- The dashboard remains a read-only Portfolio Monitoring UI.
- GitHub/project repositories and MPE remain the source of truth.
- The dashboard does not start, continue, retry or close Arena sessions.
- No status or session state was fabricated to make acceptance pass.
- The pre-existing external Cloudflare Pages PR-preview integration is not the
  production gate; the canonical `main` deployment workflow is.

## Final gate

After this branch is merged, the `main` production workflow must complete the
GitHub sync, tests, snapshot verification, build, Cloudflare Pages deployment and
production snapshot verification. Only then may CP-20 move from `VALIDATION` to
`PASS` in the post-merge closeout.
