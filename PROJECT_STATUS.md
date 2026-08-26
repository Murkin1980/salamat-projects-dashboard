# PROJECT STATUS

Decision: `NEW_REPOSITORY`

Current checkpoint: `CP-03 — Project State Contract`
Status: `READY`

## CP-00 — Repository Foundation
Status: `PASS`

Evidence:
- repository `Murkin1980/salamat-projects-dashboard` created;
- Foundation invariants committed to `main`;
- mandatory agent reading order committed;
- architecture, triage rules and checkpoint model committed;
- icon/node research baseline documented;
- MPE tracking issue exists as Issue #11.

## CP-01 — Visual System
Status: `PASS`

Evidence:
- `docs/VISUAL_SYSTEM.md` locks semantic node/file/status/service icon vocabulary;
- Tabler Icons selected for system semantics;
- Simple Icons selected for recognizable external service marks;
- `config/icon-map.json` provides the canonical machine-readable mapping;
- triage state semantics are expressed with icon + text, never color alone;
- node anatomy and accessibility/permission guardrails are locked;
- React Flow is explicitly restricted to presentation/control and may not become workflow truth/runtime;
- `config/projects.json` contains the initial active-project registry fixture for the static shell.

## CP-02 — Static Triage Shell
Status: `PASS`

Implemented:
- React + TypeScript + Vite app scaffold;
- responsive desktop/mobile shell;
- Triage / Portfolio / Attention navigation;
- fixture rendering from `config/projects.json`;
- triage counts and filter pills;
- project search;
- summary KPI cards;
- disabled future controls instead of fake functionality;
- mobile navigation and single-column project layout.

Verification evidence:
- `npm install` completed with 0 vulnerabilities;
- `npm run build` passed (`tsc -b && vite build`, Vite 7.3.6);
- browser smoke check passed at desktop `1440x1000` and mobile `390x844`;
- Triage navigation, all seven filters, fixture counts, KPI cards, search by project and next action, Portfolio and Attention views were exercised;
- Portfolio does not inherit the hidden Triage filter;
- mobile document width equals the viewport width (`390px`), with no horizontal page overflow;
- future Roadmap / Reports / Settings / Continue controls remain disabled and honestly labelled;
- fixture data is read from `config/projects.json`; canonical triage icons are read from `config/icon-map.json`;
- no live GitHub integration or workflow runtime is present.

## Next
`CP-03 — Project State Contract`.

## Blocker
None.

Last updated: 2026-08-26
