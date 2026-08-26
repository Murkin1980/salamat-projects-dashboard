import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  adaptGithubSource,
  type RepositorySnapshot,
  type RepositoryArtifact,
} from '../src/adapters/github-source.js'
import { ProjectStateSchema } from '../src/contract/project-state.js'

// --- Fixtures --------------------------------------------------------------

function makeArtifact(
  overrides: Partial<RepositoryArtifact> & { path: string },
): RepositoryArtifact {
  return {
    ref: 'main',
    sha: 'abc123',
    htmlUrl: `https://github.com/test/repo/blob/main/${overrides.path}`,
    content: '',
    ...overrides,
  }
}

const DASHBOARD_STATUS_CONTENT = `# PROJECT STATUS

Decision: \`NEW_REPOSITORY\`

Current checkpoint: \`CP-04 — GitHub/MPE Source Adapter\`
Status: \`READY\`

## Next
\`Implement source adapter.\`

## Blocker
\`None\`

Last updated: 2026-08-26
`

function standardSnapshot(
  overrides: Partial<RepositorySnapshot> = {},
): RepositorySnapshot {
  return {
    projectId: 'salamat-dashboard',
    repo: 'Murkin1980/salamat-projects-dashboard',
    defaultBranch: 'main',
    headSha: 'sha-head-001',
    retrievedAt: '2026-08-26',
    artifacts: [
      makeArtifact({
        path: 'PROJECT_STATUS.md',
        sha: 'sha-status-001',
        content: DASHBOARD_STATUS_CONTENT,
      }),
    ],
    ...overrides,
  }
}

// --- Tests -----------------------------------------------------------------

test('dashboard standard parse produces valid ProjectState with correct triage', () => {
  const result = adaptGithubSource(standardSnapshot())

  const parsed = ProjectStateSchema.safeParse(result)
  assert.equal(parsed.success, true, 'Output must pass ProjectState schema')

  assert.equal(result.triageState, 'READY')
  assert.equal(result.checkpoint, 'CP-04 — GitHub/MPE Source Adapter')
  assert.equal(result.nextAction, 'Implement source adapter.')
  assert.equal(result.blocker, 'None')
  assert.equal(result.lastUpdated, '2026-08-26')
  assert.equal(result.repo, 'Murkin1980/salamat-projects-dashboard')
  assert.equal(result.source.kind, 'REPOSITORY')
  assert.equal(result.source.id, 'Murkin1980/salamat-projects-dashboard')
  assert.equal(result.staleAfterDays, 7)
  assert.equal(result.triageSource.status, 'KNOWN')
})

test('PASS status maps to DONE', () => {
  const content = DASHBOARD_STATUS_CONTENT.replace('READY', 'PASS')
  const result = adaptGithubSource(
    standardSnapshot({
      artifacts: [
        makeArtifact({
          path: 'PROJECT_STATUS.md',
          sha: 'sha-pass',
          content,
        }),
      ],
    }),
  )
  assert.equal(result.triageState, 'DONE')
})

test('MPE fallback: missing status artifact yields UNKNOWN', () => {
  const result = adaptGithubSource(
    standardSnapshot({ artifacts: [] }),
  )

  assert.equal(result.triageState, null)
  assert.equal(result.triageSource.status, 'UNKNOWN')
  if (result.triageSource.status === 'UNKNOWN') {
    assert.ok(
      result.triageSource.reason.includes('No status artifact'),
      'Reason should mention missing artifact',
    )
  }

  const parsed = ProjectStateSchema.safeParse(result)
  assert.equal(parsed.success, true)
})

test('MPE fallback: unrecognized status value yields UNKNOWN', () => {
  const content = DASHBOARD_STATUS_CONTENT.replace('READY', 'SHIPPED')
  const result = adaptGithubSource(
    standardSnapshot({
      artifacts: [
        makeArtifact({
          path: 'PROJECT_STATUS.md',
          sha: 'sha-unknown',
          content,
        }),
      ],
    }),
  )

  assert.equal(result.triageState, null)
  assert.equal(result.triageSource.status, 'UNKNOWN')
  if (result.triageSource.status === 'UNKNOWN') {
    assert.ok(
      result.triageSource.reason.includes('SHIPPED'),
      'Reason should mention the unrecognized value',
    )
  }
})

test('Business divergent CONFLICT: alternate branch status differs', () => {
  const altContent = DASHBOARD_STATUS_CONTENT.replace('READY', 'BLOCKED')
  const result = adaptGithubSource(
    standardSnapshot({
      alternateStatus: {
        branch: 'feature/divergent',
        artifact: makeArtifact({
          path: 'PROJECT_STATUS.md',
          ref: 'feature/divergent',
          sha: 'sha-alt-999',
          content: altContent,
        }),
      },
    }),
  )

  assert.equal(result.triageState, null)
  assert.equal(result.triageSource.status, 'CONFLICT')
  if (result.triageSource.status === 'CONFLICT') {
    assert.equal(result.triageSource.sourceIds.length, 2)
    assert.ok(
      result.triageSource.sourceIds[0].includes('sha-status-001'),
      'First sourceId should reference default branch artifact',
    )
    assert.ok(
      result.triageSource.sourceIds[1].includes('sha-alt-999'),
      'Second sourceId should reference alternate branch artifact',
    )
    assert.ok(result.triageSource.reason.includes('feature/divergent'))
  }

  const parsed = ProjectStateSchema.safeParse(result)
  assert.equal(parsed.success, true)
})

test('CONFLICT with same status on both branches is KNOWN, not CONFLICT', () => {
  const result = adaptGithubSource(
    standardSnapshot({
      alternateStatus: {
        branch: 'feature/same',
        artifact: makeArtifact({
          path: 'PROJECT_STATUS.md',
          ref: 'feature/same',
          sha: 'sha-alt-same',
          content: DASHBOARD_STATUS_CONTENT,
        }),
      },
    }),
  )

  assert.equal(result.triageState, 'READY')
  assert.equal(result.triageSource.status, 'KNOWN')
})

test('source URLs and SHAs are traceable in evidenceLinks', () => {
  const result = adaptGithubSource(
    standardSnapshot({
      artifacts: [
        makeArtifact({
          path: 'PROJECT_STATUS.md',
          sha: 'sha-status-trace',
          htmlUrl: 'https://github.com/Murkin1980/salamat-projects-dashboard/blob/main/PROJECT_STATUS.md',
        }),
        makeArtifact({
          path: 'ROADMAP.md',
          sha: 'sha-roadmap-trace',
          htmlUrl: 'https://github.com/Murkin1980/salamat-projects-dashboard/blob/main/ROADMAP.md',
        }),
      ],
    }),
  )

  assert.equal(result.evidenceLinks.length, 2)

  const statusLink = result.evidenceLinks.find((l) =>
    l.label === 'PROJECT_STATUS.md',
  )
  assert.ok(statusLink, 'Must have evidence link for PROJECT_STATUS.md')
  assert.equal(
    statusLink!.url,
    'https://github.com/Murkin1980/salamat-projects-dashboard/blob/main/PROJECT_STATUS.md',
  )
  assert.ok(
    statusLink!.sourceId.includes('sha-status-trace'),
    'sourceId must contain artifact SHA',
  )

  const roadmapLink = result.evidenceLinks.find((l) =>
    l.label === 'ROADMAP.md',
  )
  assert.ok(roadmapLink, 'Must have evidence link for ROADMAP.md')
  assert.ok(
    roadmapLink!.sourceId.includes('sha-roadmap-trace'),
    'sourceId must contain artifact SHA',
  )
})

test('ROADMAP.md alone yields UNKNOWN when no primary status artifact exists', () => {
  const roadmapContent = `# ROADMAP\n\nStatus: \`IN_PROGRESS\`\n`
  const result = adaptGithubSource(
    standardSnapshot({
      artifacts: [
        makeArtifact({
          path: 'ROADMAP.md',
          sha: 'sha-roadmap-only',
          content: roadmapContent,
        }),
      ],
    }),
  )

  // ROADMAP is supporting; without a primary artifact, status is unknown
  assert.equal(result.triageState, null)
  assert.equal(result.triageSource.status, 'UNKNOWN')
})

test('missing values are explicit null, never guessed', () => {
  const minimalContent = `# PROJECT STATUS\n\nStatus: \`HOLD\`\n`
  const result = adaptGithubSource(
    standardSnapshot({
      artifacts: [
        makeArtifact({
          path: 'PROJECT_STATUS.md',
          sha: 'sha-minimal',
          content: minimalContent,
        }),
      ],
    }),
  )

  assert.equal(result.triageState, 'HOLD')
  assert.equal(result.checkpoint, null)
  assert.equal(result.blocker, null)
  assert.equal(result.nextAction, null)
  assert.equal(result.progress, null)
  assert.equal(result.stage, null)
  assert.deepEqual(result.dependencies, [])
  assert.deepEqual(result.tools, [])
  assert.deepEqual(result.approvals, [])
})
