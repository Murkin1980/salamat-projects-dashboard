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
