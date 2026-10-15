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
    name: 'Salamat Projects Dashboard',
    summary: 'Operational portfolio dashboard.',
    repo: 'Murkin1980/salamat-projects-dashboard',
    defaultBranch: 'main',
    headSha: 'sha-head-001',
    headCommittedAt: '2026-08-25T12:00:00Z',
    retrievedAt: '2026-08-26',
    generatedAt: '2026-08-26T06:17:00Z',
    snapshotSourceId: 'config/projects.github.json',
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
  assert.equal(result.blocker, null)
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

test('status artifact without canonical Status label explains UNKNOWN precisely', () => {
  const result = adaptGithubSource(
    standardSnapshot({
      artifacts: [
        makeArtifact({
          path: 'STATUS.md',
          sha: 'sha-status-without-label',
          content: '# STATUS\n\nThe project is active, but has no canonical state label.',
        }),
      ],
    }),
  )

  assert.equal(result.triageState, null)
  assert.equal(result.triageSource.status, 'UNKNOWN')
  if (result.triageSource.status === 'UNKNOWN') {
    assert.equal(
      result.triageSource.reason,
      'No canonical Status label found in STATUS.md',
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

test('different unrecognized statuses on divergent branches remain CONFLICT', () => {
  const primaryContent = DASHBOARD_STATUS_CONTENT.replace('READY', 'NEXT / SCOPE UPDATED')
  const alternateContent = DASHBOARD_STATUS_CONTENT.replace('READY', 'IN PROGRESS — CHECKPOINT PASS')
  const result = adaptGithubSource(standardSnapshot({
    artifacts: [makeArtifact({ path: 'PROJECT_STATUS.md', sha: 'sha-primary-unknown', content: primaryContent })],
    alternateStatus: {
      branch: 'codex/stage-5-auditor',
      artifact: makeArtifact({
        path: 'PROJECT_STATUS.md',
        ref: 'codex/stage-5-auditor',
        sha: 'sha-alt-unknown',
        content: alternateContent,
      }),
    },
  }))

  assert.equal(result.triageState, null)
  assert.equal(result.triageSource.status, 'CONFLICT')
})

test('different branch status documents remain CONFLICT without parseable status labels', () => {
  const result = adaptGithubSource(standardSnapshot({
    artifacts: [makeArtifact({
      path: 'PROJECT_STATUS.md',
      sha: 'sha-primary-prose',
      content: '# PROJECT STATUS\n\nStage 5 — NEXT / SCOPE UPDATED',
    })],
    alternateStatus: {
      branch: 'codex/stage-5-auditor',
      artifact: makeArtifact({
        path: 'PROJECT_STATUS.md',
        ref: 'codex/stage-5-auditor',
        sha: 'sha-alt-prose',
        content: '# PROJECT STATUS\n\nStage 5 — IN PROGRESS — deterministic checkpoint PASS',
      }),
    },
  }))

  assert.equal(result.triageState, null)
  assert.equal(result.triageSource.status, 'CONFLICT')
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

test('Phase 3 parser: Checkpoint: format with and without backticks', () => {
  const contentWithBackticks = `# PROJECT STATUS\n\nCheckpoint: \`CP-02 — Core Flow\`\nStatus: \`READY\`\n`
  const r1 = adaptGithubSource(standardSnapshot({
    artifacts: [makeArtifact({ path: 'PROJECT_STATUS.md', content: contentWithBackticks })],
  }))
  assert.equal(r1.checkpoint, 'CP-02 — Core Flow')
  assert.equal(r1.stage, 'CP-02 — Core Flow', 'Checkpoint acts as stage when no explicit stage is defined')

  const contentWithoutBackticks = `# PROJECT STATUS\n\nCheckpoint: CP-03 — Schema Definition\nStatus: \`READY\`\n`
  const r2 = adaptGithubSource(standardSnapshot({
    artifacts: [makeArtifact({ path: 'PROJECT_STATUS.md', content: contentWithoutBackticks })],
  }))
  assert.equal(r2.checkpoint, 'CP-03 — Schema Definition')
  assert.equal(r2.stage, 'CP-03 — Schema Definition')
})

test('Phase 3 parser: Current checkpoint: format with markdown lists and bold formatting', () => {
  const content = `# PROJECT STATUS\n\n- **Current checkpoint:** \`CP-05 — Visual Polish\`\nStatus: \`READY\`\n`
  const result = adaptGithubSource(standardSnapshot({
    artifacts: [makeArtifact({ path: 'PROJECT_STATUS.md', content })],
  }))
  assert.equal(result.checkpoint, 'CP-05 — Visual Polish')
  assert.equal(result.stage, 'CP-05 — Visual Polish')
})

test('Phase 3 parser: Stage: and Current stage: formats', () => {
  const stageOnly = `# PROJECT STATUS\n\nStage: \`Phase 1 Discovery\`\nStatus: \`READY\`\n`
  const r1 = adaptGithubSource(standardSnapshot({
    artifacts: [makeArtifact({ path: 'PROJECT_STATUS.md', content: stageOnly })],
  }))
  assert.equal(r1.stage, 'Phase 1 Discovery')
  assert.equal(r1.checkpoint, null)

  const currentStageWithoutBackticks = `# PROJECT STATUS\n\nCurrent stage: Beta Launch\nStatus: \`READY\`\n`
  const r2 = adaptGithubSource(standardSnapshot({
    artifacts: [makeArtifact({ path: 'PROJECT_STATUS.md', content: currentStageWithoutBackticks })],
  }))
  assert.equal(r2.stage, 'Beta Launch')
  assert.equal(r2.checkpoint, null)
})

test('Phase 3 parser: precedence when both Stage and Checkpoint are present', () => {
  const bothPresent = `# PROJECT STATUS\n\nStage: \`Discovery\`\nCheckpoint: \`CP-01 — Intake\`\nStatus: \`READY\`\n`
  const result = adaptGithubSource(standardSnapshot({
    artifacts: [makeArtifact({ path: 'PROJECT_STATUS.md', content: bothPresent })],
  }))
  assert.equal(result.stage, 'Discovery', 'Explicit stage must take precedence over checkpoint for project.stage')
  assert.equal(result.checkpoint, 'CP-01 — Intake', 'Explicit checkpoint must be preserved in project.checkpoint')
})

test('Phase 3 parser: precedence between primary artifact and ROADMAP.md', () => {
  // Primary has checkpoint only, roadmap has stage
  const primaryContent = `# PROJECT STATUS\n\nCheckpoint: \`CP-10 — Core\`\nStatus: \`READY\`\n`
  const roadmapContent = `# ROADMAP\n\nStage: \`Strategic Rollout\`\n`
  const result = adaptGithubSource(standardSnapshot({
    artifacts: [
      makeArtifact({ path: 'PROJECT_STATUS.md', content: primaryContent }),
      makeArtifact({ path: 'ROADMAP.md', content: roadmapContent }),
    ],
  }))
  assert.equal(result.checkpoint, 'CP-10 — Core')
  assert.equal(result.stage, 'Strategic Rollout', 'Roadmap stage fills missing stage in primary')
})

test('CP-01B-B parser: supports all Markdown bullet and decoration variants for Checkpoint', () => {
  const variants: Array<[line: string, expected: string]> = [
    ['+ Checkpoint: CP-18', 'CP-18'],
    ['1. Checkpoint: CP-18', 'CP-18'],
    ['1) Checkpoint: CP-18', 'CP-18'],
    ['Checkpoint: **CP-18**', 'CP-18'],
    ['Checkpoint: *CP-18*', 'CP-18'],
    ['**Current checkpoint:** `CP-18`', 'CP-18'],
    ['### Checkpoint: `CP-18`', 'CP-18'],
  ]

  for (const [line, expected] of variants) {
    const content = `# PROJECT STATUS\n\n${line}\nStatus: \`READY\`\n`
    const result = adaptGithubSource(standardSnapshot({
      artifacts: [makeArtifact({ path: 'PROJECT_STATUS.md', content })],
    }))
    assert.equal(result.checkpoint, expected, `Variant "${line}" must parse checkpoint "${expected}"`)
    assert.equal(result.stage, expected, `Variant "${line}" must act as stage when no explicit stage is defined`)
  }
})

test('CP-01B-B parser: supports all Markdown bullet and decoration variants for Stage', () => {
  const variants: Array<[line: string, expected: string]> = [
    ['+ Stage: Phase 2 Rollout', 'Phase 2 Rollout'],
    ['1. Stage: Phase 2 Rollout', 'Phase 2 Rollout'],
    ['1) Stage: Phase 2 Rollout', 'Phase 2 Rollout'],
    ['Stage: **Phase 2 Rollout**', 'Phase 2 Rollout'],
    ['Stage: *Phase 2 Rollout*', 'Phase 2 Rollout'],
    ['**Current stage:** `Phase 2 Rollout`', 'Phase 2 Rollout'],
    ['### Stage: `Phase 2 Rollout`', 'Phase 2 Rollout'],
  ]

  for (const [line, expected] of variants) {
    const content = `# PROJECT STATUS\n\n${line}\nStatus: \`READY\`\n`
    const result = adaptGithubSource(standardSnapshot({
      artifacts: [makeArtifact({ path: 'PROJECT_STATUS.md', content })],
    }))
    assert.equal(result.stage, expected, `Variant "${line}" must parse stage "${expected}"`)
    assert.equal(result.checkpoint, null, `Variant "${line}" must leave checkpoint null when not defined`)
  }
})

test('CP-01B-B invariants: Checkpoint != DONE, Stage != PASS, Status governs completion', () => {
  // Checkpoint is present with READY status -> triageState must be READY, NOT DONE
  const readyContent = `# PROJECT STATUS\n\nCheckpoint: **CP-18**\nStatus: \`READY\`\n`
  const rReady = adaptGithubSource(standardSnapshot({
    artifacts: [makeArtifact({ path: 'PROJECT_STATUS.md', content: readyContent })],
  }))
  assert.equal(rReady.checkpoint, 'CP-18')
  assert.equal(rReady.triageState, 'READY', 'Checkpoint alone must never imply DONE')

  // Checkpoint is present with BLOCKED status -> triageState must be BLOCKED
  const blockedContent = `# PROJECT STATUS\n\nCheckpoint: **CP-18**\nStatus: \`BLOCKED\`\n\nBlocker\n\`Waiting on credentials\`\n`
  const rBlocked = adaptGithubSource(standardSnapshot({
    artifacts: [makeArtifact({ path: 'PROJECT_STATUS.md', content: blockedContent })],
  }))
  assert.equal(rBlocked.checkpoint, 'CP-18')
  assert.equal(rBlocked.triageState, 'BLOCKED', 'Checkpoint alone must never override BLOCKED')

  // Stage is present with IN_PROGRESS status -> triageState must be IN_PROGRESS, NOT DONE/PASS
  const inProgressContent = `# PROJECT STATUS\n\nStage: *Phase 2 Rollout*\nStatus: \`IN_PROGRESS\`\n`
  const rProgress = adaptGithubSource(standardSnapshot({
    artifacts: [makeArtifact({ path: 'PROJECT_STATUS.md', content: inProgressContent })],
  }))
  assert.equal(rProgress.stage, 'Phase 2 Rollout')
  assert.equal(rProgress.triageState, 'IN_PROGRESS', 'Stage alone must never imply PASS or DONE')

  // Only canonical Status: PASS maps to DONE
  const passContent = `# PROJECT STATUS\n\nStage: **Phase 2**\nCheckpoint: \`CP-18\`\nStatus: \`PASS\`\n`
  const rPass = adaptGithubSource(standardSnapshot({
    artifacts: [makeArtifact({ path: 'PROJECT_STATUS.md', content: passContent })],
  }))
  assert.equal(rPass.triageState, 'DONE', 'Only canonical Status: PASS maps to DONE')
})


