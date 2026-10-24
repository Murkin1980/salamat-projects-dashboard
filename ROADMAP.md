# ROADMAP

1. CP-00 Repository Foundation — PASS
2. CP-01 Visual System — PASS
3. CP-02 Static Triage Shell — PASS
4. CP-03 Project State Contract — PASS
5. CP-04 GitHub/MPE Source Adapter — PASS
6. CP-05 Live Triage — PASS
7. CP-06 Flow / Nodes MVP — PASS
8. CP-07 History & Reports — PASS
9. CP-08 Cloudflare Production — PASS / automatic main deployment extension — PASS (first main-triggered production run verified 2026-09-18)
10. CP-09 Codex App Server Experiment — BASELINE_PASS / UI surface removed in CP-10 (contract retained as MPE migration candidate)
11. CP-10 Monitoring-Only Cleanup — PASS (merged 2026-09-15)
12. CP-11 Portfolio Refresh — PASS (production snapshot and desktop/mobile visual smoke verified 2026-09-25)
13. CP-12 Discovery Monitoring — PASS (production fail-closed monitoring verified; live counts remain UNAVAILABLE pending Cloudflare analytics permission)
14. CP-13 Automatic Portfolio Sync — PASS (scheduled GitHub sync before build on the unchanged 17 */6 * * * cadence; 4 of 10 portfolio repositories synchronized, 6 recorded as explicit gaps)
15. CP-14 Portfolio Activity & Arena Session State Contract — PASS (PR #21 merged 2026-10-01; 140/140 tests, build PASS; snapshot verification PASS; activity and Arena session state kept separate from operational status)
16. CP-15 Activity-Aware Portfolio, Triage & Session Visibility — PASS (PR #22 merged 2026-10-01; 152/152 tests, build PASS; activity-ordered Portfolio, freshness chips and the compact session indicator at desktop and mobile)
17. CP-16 Project Detail Drill-down & Session Inspection — PASS (PR #24 plus routing/provenance hardening PR #26 merged 2026-10-01; 172/172 tests, build PASS; production workflow runs 36868477244 and 36874033588 succeeded)
18. CP-17 Live History & Reports — PASS (PR #29 merged 2026-10-01 with the post-merge status record PR #30; 216/216 tests, build PASS; `ProjectState` schema 1.2.0 with the required `history` block)
19. CP-18 Portfolio Recent Activity Feed — PASS (PR #37 merged 2026-10-20 at c44a510bdbb089107c226ceef596125dc4177d59; 284/284 tests, build PASS, snapshot verification PASS, desktop 1440×1000 and mobile 390×844 PASS; production workflow run 39465753157 SUCCESS, including Cloudflare deploy and production snapshot verification)
20. CP-19 Portfolio Coverage & Data Quality Hardening — PASS (PR #40 merged 2026-10-24 at ede570f27ef7075d7deb5cdea1451c3bc83960bf; 295/295 tests, build and snapshot verification PASS; production workflow run 40056131304 SUCCESS; primary coverage partition 15/15 and UI/verifier parity confirmed)
21. CP-20 Production UX & Acceptance — VALIDATION (295/295 tests, build and snapshot verification PASS; real production Chromium acceptance passed at 1440×1000 and 390×844 with no overflow or console errors; awaiting merge and canonical `main` production deployment verification)

Next action: merge CP-20, verify the canonical `main` production workflow, then record CP-20 PASS. No later checkpoint is defined or implied.

No later checkpoint starts by silently expanding the scope of an earlier checkpoint.
