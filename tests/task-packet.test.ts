import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  ALLOWED_PROJECT_IDS,
  ALLOWED_REPOSITORIES,
  buildBaselineTaskPacket,
  detectSensitiveContent,
  isProjectAllowed,
  isRepositoryAllowed,
  parseTaskPacket,
  safeParseTaskPacket,
  serializeTaskPacket,
  TASK_PACKET_SCHEMA_VERSION,
  type TaskPacket,
} from '../src/contract/task-packet.js'
import { parseProjectRegistry } from '../src/contract/project-state.js'

const githubCachePath = fileURLToPath(new URL('../config/projects.github.json', import.meta.url))
const githubCache = JSON.parse(readFileSync(githubCachePath, 'utf8')) as unknown
const registry = parseProjectRegistry(githubCache)
const dashboardProject = registry.projects.find((p) => p.id === 'salamat-projects-dashboard')!

function getValidTaskPacket(): TaskPacket {
  return buildBaselineTaskPacket(dashboardProject, {
    createdAt: '2026-09-03T12:00:00.000Z',
  })
}

test('allowlist identifies approved and unapproved repos and projects', () => {
  assert.equal(isRepositoryAllowed('Murkin1980/salamat-projects-dashboard'), true)
  assert.equal(isRepositoryAllowed('Murkin1980/business-discovery'), false)
  assert.equal(isRepositoryAllowed('Murkin1980/murat-project-engineer'), false)
  assert.equal(isRepositoryAllowed(null), false)

  assert.equal(isProjectAllowed('salamat-projects-dashboard'), true)
  assert.equal(isProjectAllowed('business-discovery'), false)
  assert.equal(isProjectAllowed('unknown-project'), false)
})

test('buildBaselineTaskPacket creates valid Task Packet conforming to schema version 1.0.0', () => {
  const packet = getValidTaskPacket()
  assert.equal(packet.schemaVersion, TASK_PACKET_SCHEMA_VERSION)
  assert.equal(packet.projectId, 'salamat-projects-dashboard')
  assert.equal(packet.repo, 'Murkin1980/salamat-projects-dashboard')
  assert.equal(packet.triageState, 'READY')
  assert.ok(packet.objective.length > 0)
  assert.ok(packet.scope.included.length >= 1)
  assert.ok(packet.scope.excluded.length >= 1)
  assert.ok(packet.acceptanceCriteria.length >= 1)
  assert.ok(packet.evidenceRef.url.startsWith('https://'))

  const serialized = serializeTaskPacket(packet)
  const roundTripped = parseTaskPacket(JSON.parse(serialized))
  assert.deepEqual(roundTripped, packet)
})

test('negative: rejects unknown repository not in allowlist', () => {
  const valid = getValidTaskPacket()
  const payload = { ...valid, repo: 'Murkin1980/business-discovery' }
  const result = safeParseTaskPacket(payload)
  assert.equal(result.success, false)
})

test('negative: rejects unapproved projectId not in allowlist', () => {
  const valid = getValidTaskPacket()
  const payload = { ...valid, projectId: 'business-discovery' }
  const result = safeParseTaskPacket(payload)
  assert.equal(result.success, false)
})

test('negative: rejects missing required fields (fail-closed)', () => {
  const requiredFields: Array<keyof TaskPacket> = [
    'schemaVersion',
    'taskId',
    'projectId',
    'repo',
    'checkpoint',
    'triageState',
    'nextAction',
    'objective',
    'scope',
    'acceptanceCriteria',
    'createdAt',
    'evidenceRef',
  ]

  for (const field of requiredFields) {
    const payload = { ...getValidTaskPacket() }
    delete (payload as Record<string, unknown>)[field]
    const result = safeParseTaskPacket(payload)
    assert.equal(result.success, false, `Expected validation to fail when missing required field: ${field}`)
  }
})

test('negative: rejects empty scope or acceptance criteria', () => {
  const valid = getValidTaskPacket()

  const emptyIncluded = {
    ...valid,
    scope: { included: [], excluded: ['something'] },
  }
  assert.equal(safeParseTaskPacket(emptyIncluded).success, false)

  const emptyExcluded = {
    ...valid,
    scope: { included: ['something'], excluded: [] },
  }
  assert.equal(safeParseTaskPacket(emptyExcluded).success, false)

  const emptyCriteria = {
    ...valid,
    acceptanceCriteria: [],
  }
  assert.equal(safeParseTaskPacket(emptyCriteria).success, false)
})

test('negative: rejects unexpected extra fields (strict schema)', () => {
  const valid = getValidTaskPacket()
  const payload = {
    ...valid,
    unexpectedProperty: 'malicious payload',
  }
  const result = safeParseTaskPacket(payload)
  assert.equal(result.success, false)
})

test('negative: rejects invalid schemaVersion', () => {
  const valid = getValidTaskPacket()
  const payload = { ...valid, schemaVersion: '2.0.0' }
  const result = safeParseTaskPacket(payload)
  assert.equal(result.success, false)
})

test('negative: rejects invalid triageState and BLOCKED state', () => {
  const valid = getValidTaskPacket()

  // Unknown triage state value
  const invalidState = { ...valid, triageState: 'UNKNOWN' }
  assert.equal(safeParseTaskPacket(invalidState).success, false)

  // BLOCKED triage state should fail packet creation
  const blockedState = { ...valid, triageState: 'BLOCKED' }
  assert.equal(safeParseTaskPacket(blockedState).success, false)
})

test('negative: sensitive data detector catches secrets and credentials', () => {
  assert.ok(detectSensitiveContent('ghp_123456789012345678901234567890123456'))
  assert.ok(detectSensitiveContent('gho_123456789012345678901234567890123456'))
  assert.ok(detectSensitiveContent('github_pat_11AAAAAAA_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'))
  assert.ok(detectSensitiveContent('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M'))
  assert.ok(detectSensitiveContent('sk-proj-abc123456789012345678901234567890'))
  assert.ok(detectSensitiveContent('AKIAIOSFODNN7EXAMPLE'))
  assert.ok(detectSensitiveContent('-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0'))
  assert.ok(detectSensitiveContent('password = "mySecretPassword123"'))
  assert.ok(detectSensitiveContent('Set-Cookie: session_id=xyz123'))
})

test('negative: sensitive data detector catches local absolute paths', () => {
  assert.ok(detectSensitiveContent('/home/user/salamat-projects-dashboard/secret.txt'))
  assert.ok(detectSensitiveContent('/Users/murat/workspace/keys'))
  assert.ok(detectSensitiveContent('C:\\Users\\Murat\\Documents\\secrets'))
  assert.ok(detectSensitiveContent('/etc/shadow'))
})

test('negative: task packet fails validation when containing secrets in any nested field', () => {
  const valid = getValidTaskPacket()

  const withSecretObjective = {
    ...valid,
    objective: 'Run task with token ghp_123456789012345678901234567890123456',
  }
  assert.equal(safeParseTaskPacket(withSecretObjective).success, false)

  const withSecretScope = {
    ...valid,
    scope: {
      included: ['Normal task', 'Use API key sk-proj-12345678901234567890123456'],
      excluded: ['Nothing'],
    },
  }
  assert.equal(safeParseTaskPacket(withSecretScope).success, false)

  const withSecretCriteria = {
    ...valid,
    acceptanceCriteria: ['Read /home/user/.ssh/id_rsa'],
  }
  assert.equal(safeParseTaskPacket(withSecretCriteria).success, false)
})

test('negative: buildBaselineTaskPacket throws for unallowlisted project or BLOCKED project', () => {
  const muratProject = registry.projects.find((p) => p.id === 'murat-project-engineer')!
  assert.throws(() => buildBaselineTaskPacket(muratProject), /not allowlisted/)

  const blockedProject = {
    ...dashboardProject,
    triageState: 'BLOCKED' as const,
    blocker: 'Some blocker issue',
  }
  assert.throws(() => buildBaselineTaskPacket(blockedProject), /BLOCKED/)
})

test('harness: runHarness generates valid baseline packet in generate mode', async () => {
  const { runHarness } = await import('../scripts/task-packet-harness.js')
  const packet = await runHarness(['--generate'])
  assert.equal(packet.schemaVersion, '1.0.0')
  assert.equal(packet.projectId, 'salamat-projects-dashboard')
  assert.equal(packet.repo, 'Murkin1980/salamat-projects-dashboard')
})
