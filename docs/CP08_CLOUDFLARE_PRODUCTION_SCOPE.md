# CP-08 — Cloudflare Production Scope

Primary disposition: `REUSE_COMPONENT`

## New Idea Filter

1. Existing overlap: the project already produces a static Vite build intended for Cloudflare Pages.
2. Reuse: deploy the existing `dist` output with the official Wrangler Pages Direct Upload flow.
3. Duplicate infrastructure: no Worker, database, storage binding, server runtime or second frontend is introduced.
4. Outcome: the operational dashboard is reachable on Cloudflare and on `projects.salamat-mebel.kz` with mobile and desktop verification.
5. Smallest validation: one production Pages project, one main-branch deployment and one custom subdomain.
6. Priority: this publishes the completed CP-00 through CP-07 product before any Codex App Server experiment.
7. Deep-change risk: low; deployment does not change GitHub/MPE source-of-truth authority.

## Included

- local Wrangler v4 dependency and reviewable Pages configuration;
- reproducible build-and-deploy scripts;
- Cloudflare Pages project `salamat-projects-dashboard` with production branch `main`;
- production deployment of the validated `dist` directory;
- custom domain `projects.salamat-mebel.kz`;
- HTTPS, desktop, mobile and core-view smoke verification;
- deployment evidence in project status.

## Excluded

- Cloudflare Worker runtime, Pages Functions, KV, D1, R2 or secrets;
- automatic GitHub deployment integration;
- changing dashboard state authority or source adapters;
- Access restrictions, analytics and scheduled refresh infrastructure;
- CP-09 Codex App Server experiment.

## Acceptance

1. Tests and production build pass before upload.
2. Wrangler reports an authenticated account and a successful production deployment.
3. The `pages.dev` production URL returns HTTPS 200 and renders the dashboard.
4. `projects.salamat-mebel.kz` is attached and returns HTTPS 200 with a valid certificate.
5. Triage, Nodes and Reports render on production at desktop and mobile widths.
6. Mobile document width equals viewport width and no horizontal page overflow appears.
