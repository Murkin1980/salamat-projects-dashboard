# CHECKPOINTS

## CP-00 — Repository Foundation
Foundation, AGENTS, architecture, triage rules, status/roadmap and icon research exist.
Exit: human-readable repository constitution is complete.

## CP-01 — Visual System
Approved node/file/status/service icon system and design tokens.
Exit: visual catalog accepted.

## CP-02 — Static Triage Shell
Responsive UI shell with Triage/Portfolio/Attention navigation and fixture data.
Exit: mobile + desktop usability pass.

## CP-03 — Project State Contract
Versioned normalized ProjectState schema and fixtures.
Exit: deterministic validation tests pass.

## CP-04 — GitHub/MPE Source Adapter
Read project status from selected repositories/artifacts.
Exit: dashboard values can be traced to source evidence.

## CP-05 — Live Triage
Automatic triage derivation and Attention signals.
Exit: live changes propagate without manual card editing.

## CP-06 — Flow / Nodes MVP
Interactive graph of projects/tools/plugins/services with inspect/filter/toggle configuration where safe.
Exit: graph reflects real relationships; no workflow runtime introduced.

## CP-07 — History & Reports
State transition history, blocker changes, checkpoint movement.

## CP-08 — Cloudflare Production
Deploy and bind `projects.salamat-mebel.kz`, verify mobile and desktop.

## CP-09 — Codex App Server Experiment
Only after separate experiment gate. Evaluate Continue-from-project / agent workstream integration without moving source-of-truth authority into the dashboard.
UI surface removed in CP-10; the retained contract and harness are recorded as an MPE migration candidate, not dashboard functionality.

## CP-10 — Monitoring-Only Cleanup
Restore the product boundary `Salamat Projects Dashboard = Portfolio Monitoring UI`.
Remove every execution control from the UI (Continue, Task Packet modal, RAW JSON / Copy JSON / Export JSON, Codex/Arena references), keep and tidy all monitoring fields (name, repository, operational status, stage, progress, blocker, next step, last updated, evidence links, history), and leave the dashboard strictly read-only.
Exit: no execution control renders in any view at desktop or mobile; monitoring data intact; tests, build and boundary verification pass.
