# GitHub / MPE Source Adapter

CP-04 adds a read-only adapter that normalizes repository evidence into the
versioned `ProjectState` contract. It does not make this dashboard the source of
project truth.

## Source rules

1. `PROJECT_STATUS.md` is the preferred status artifact.
2. `STATUS.md` is the fallback status artifact.
3. `ROADMAP.md` is supporting evidence and cannot establish status by itself.
4. Only canonical status labels are mapped. Missing or unrecognized labels
   produce `UNKNOWN`; divergent status documents produce `CONFLICT`.
5. Dates come from an attributable status label or the repository HEAD commit,
   never from the synchronization clock.
6. Evidence links contain the repository path and immutable Git blob SHA.

## Security boundary

- Authentication is read only from `GH_TOKEN` or `GITHUB_TOKEN`.
- Tokens are never printed or written by the adapter.
- Raw repository content is decoded and parsed in memory only.
- The persisted cache contains normalized `ProjectState` fields and evidence
  metadata, not raw private repository content.
- `--output` is restricted to `config/projects.github.json` or a system
  temporary directory.

## Refreshing the snapshot

```powershell
$env:GH_TOKEN = gh auth token
npm run sync:github -- --output config/projects.github.json
```

Without `--output`, the validated normalized registry is written to stdout.
`config/projects.github.json` is a committed reviewable snapshot so a clean
checkout builds deterministically without requiring GitHub credentials.

Publishing the canonical cache also refreshes `public/project-state.json` in the
same run, so both artifacts are always byte-identical:

```text
GitHub repositories
→ npm run sync:github -- --output config/projects.github.json
→ config/projects.github.json
→ public/project-state.json
→ npm run build
→ Cloudflare Pages
→ Dashboard (browser polls project-state.json every 60 seconds)
```

For CP-05 live triage, keep a terminal running:

```powershell
$env:GH_TOKEN = gh auth token
npm run sync:github:watch
```

Each successful cycle atomically publishes the same schema-validated normalized
registry to `public/project-state.json`. The browser polls that file and keeps
the last valid state if a later request fails.

## Scheduled production sync (CP-13)

`.github/workflows/deploy-cloudflare-pages.yml` runs on the unchanged
`17 */6 * * *` schedule (and on every push to `main` / manual dispatch) and
performs, in order:

1. checkout;
2. Node.js setup;
3. `npm ci`;
4. `npm test`;
5. GitHub credentials check — `GH_TOKEN` (optional repository secret with
   private-repository access) first, then the workflow's own `GITHUB_TOKEN`;
6. `npm run sync:github -- --output config/projects.github.json`;
7. `npm run verify:snapshot`;
8. `npm run sync:discovery`;
9. `npm run build`;
10. Cloudflare Pages deployment;
11. production snapshot verification.

The GitHub sync always runs **before** `npm run build`, so the deployed snapshot
is the freshly normalized repository state.

### Failure behavior

`sync-github-projects.ts` fails closed: it writes nothing unless the merged
registry passes schema validation, and each file is published atomically. The
workflow therefore runs the sync with `continue-on-error: true`, emits a
`::warning::` when it fails, and then runs `npm run verify:snapshot`, which
hard-fails the deployment if either artifact is missing, empty, schema invalid,
non-identical or credential-bearing. A temporary GitHub outage deploys the last
valid committed snapshot instead of damaged or empty data, the failure stays
visible in the CI logs, and the browser keeps rendering the last valid
`project-state.json`.

## Source coverage

`config/source-repositories.json` declares both the synchronized `sources` and
the recorded `gaps`. Coverage is verified by
`tests/portfolio-source-coverage.test.ts`, which enforces that:

- every `sources` entry names the canonical repository of a real portfolio
  project;
- every portfolio project that has a repository is either synchronized or
  recorded as a gap;
- fixture-only projects never claim a source or a gap;
- status paths stay limited to `PROJECT_STATUS.md` / `STATUS.md`, with
  `PROJECT_STATUS.md` preferred, and `ROADMAP.md` stays in `roadmapPaths`.

Current coverage — 15 portfolio projects, 10 with a canonical repository:

| projectId | repository | state |
| --- | --- | --- |
| `murat-project-engineer` | `Murkin1980/murat-project-engineer` | synchronized (`UNKNOWN`) |
| `business-discovery` | `Murkin1980/business-discovery` | synchronized (`CONFLICT`) |
| `salamat-projects-dashboard` | `Murkin1980/salamat-projects-dashboard` | synchronized |
| `ai-microtask-factory` | `Murkin1980/ai-microtask-factory` | synchronized (`UNKNOWN`) |
| `murat-ads-control` | `Murkin1980/murat-ads-control` | gap — no canonical status artifact |
| `tender-assistant` | `Murkin1980/tender-assistant` | gap — no canonical status artifact |
| `minibase-cloudflare` | `Murkin1980/minibase-cloudflare` | gap — only `ROADMAP.md` / runbook |
| `murat-house` | `Murkin1980/Murat-house` | gap — private, unverifiable |
| `murat-ai-orchestrator` | `Murkin1980/murat-ai-orchestrator` | gap — private, unverifiable |
| `grand-mebel-document-control` | `Murkin1980/grand-mebel-document-control` | gap — private, unverifiable |

Gaps are recorded with a reason in `config/source-repositories.json`. They are
not defects to be filled by guessing: a project is only added to `sources` when a
canonical status artifact is verified to exist.
