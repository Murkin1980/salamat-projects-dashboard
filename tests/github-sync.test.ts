import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  SyncError,
  getToken,
  mergeSelected,
  parseArgs,
  resolveSafeOutput,
  syncOnce,
} from '../scripts/sync-github-projects.js'
import {
  PROJECT_STATE_SCHEMA_VERSION,
  parseProjectRegistry,
  type ProjectRegistry,
  type ProjectState,
} from '../src/contract/project-state.js'

/**
 * The dashboard's portfolio state is produced by exactly one synchronization:
 * `npm run sync:github`. These tests pin that mechanism's contract — read-only
 * credentials, a single canonical output, one atomic publication of both
 * artifacts, and fail-closed behaviour that never leaves a damaged snapshot.
 */

// --- Fixtures --------------------------------------------------------------

function project(
  overrides: Partial<ProjectState> & { id: string; name: string },
): ProjectState {
  return {
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    summary: 'Fixture summary.',
    repo: null,
    triageState: null,
    triageSource: { status: 'UNKNOWN', reason: 'fixture' },
    stage: null,
    checkpoint: null,
    progress: null,
    lastUpdated: '2026-01-01',
    blocker: null,
    nextAction: null,
    evidenceLinks: [],
    dependencies: [],
    tools: [],
    approvals: [],
    source: { kind: 'FIXTURE', id: 'fixture-registry' },
    staleAfterDays: 7,
    ...overrides,
  }
}

const STATUS_CONTENT = `# PROJECT STATUS

Current checkpoint: \`CP-09 — Adapter Contract\`
Status: \`IN_PROGRESS\`

## Next
\`Wire the scheduled synchronization.\`

## Blocker
\`None\`

Last updated: 2026-09-20
`

function registryFixture(): ProjectRegistry {
  return {
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    version: 7,
    updatedAt: '2026-09-01',
    projects: [
      project({ id: 'demo-alpha', name: 'Demo Alpha', repo: 'Murkin1980/demo-alpha' }),
      project({ id: 'demo-beta', name: 'Demo Beta' }),
    ],
  }
}

const SOURCES = {
  version: 1,
  sources: [
    {
      projectId: 'demo-alpha',
      repo: 'Murkin1980/demo-alpha',
      statusPaths: ['PROJECT_STATUS.md', 'STATUS.md'],
      roadmapPaths: ['ROADMAP.md'],
    },
  ],
}

const originalEnv = { GH_TOKEN: process.env.GH_TOKEN, GITHUB_TOKEN: process.env.GITHUB_TOKEN }
const originalFetch = globalThis.fetch

function restoreEnv(): void {
  for (const key of ['GH_TOKEN', 'GITHUB_TOKEN'] as const) {
    const value = originalEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

function encodeContent(content: string): string {
  return Buffer.from(content, 'utf8').toString('base64')
}

/** Minimal GitHub REST surface used by the synchronization. */
function installGithubStub(options: { statusContent?: string; failOn?: string } = {}): void {
  const statusContent = options.statusContent ?? STATUS_CONTENT
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const pathname = url.replace('https://api.github.com', '')

    if (options.failOn && pathname.startsWith(options.failOn)) {
      return new Response('{"message":"Not Found"}', { status: 404 })
    }
    if (pathname === '/repos/Murkin1980/demo-alpha') {
      return Response.json({ default_branch: 'main' })
    }
    if (pathname === '/repos/Murkin1980/demo-alpha/commits/main') {
      return Response.json({
        sha: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555',
        commit: { committer: { date: '2026-09-21T10:00:00Z' } },
      })
    }
    if (pathname.startsWith('/repos/Murkin1980/demo-alpha/contents/PROJECT_STATUS.md')) {
      return Response.json({
        type: 'file',
        path: 'PROJECT_STATUS.md',
        sha: '0123456789abcdef0123456789abcdef01234567',
        html_url: 'https://github.com/Murkin1980/demo-alpha/blob/main/PROJECT_STATUS.md',
        content: encodeContent(statusContent),
      })
    }
    if (pathname.startsWith('/repos/Murkin1980/demo-alpha/contents/ROADMAP.md')) {
      return new Response('{"message":"Not Found"}', { status: 404 })
    }
    return new Response('{"message":"Unexpected request"}', { status: 500 })
  }) as typeof fetch
}

let fixtureRoot: string

before(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), 'salamat-sync-'))
  await mkdir(path.join(fixtureRoot, 'config'), { recursive: true })
  await mkdir(path.join(fixtureRoot, 'public'), { recursive: true })
  await writeFile(
    path.join(fixtureRoot, 'config', 'projects.json'),
    `${JSON.stringify(registryFixture(), null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    path.join(fixtureRoot, 'config', 'source-repositories.json'),
    `${JSON.stringify(SOURCES, null, 2)}\n`,
    'utf8',
  )
})

after(async () => {
  globalThis.fetch = originalFetch
  restoreEnv()
  await rm(fixtureRoot, { recursive: true, force: true })
})

beforeEach(() => {
  globalThis.fetch = originalFetch
  restoreEnv()
})

// --- Credentials -----------------------------------------------------------

test('sync reads the token from GH_TOKEN first and GITHUB_TOKEN second', () => {
  process.env.GH_TOKEN = 'ghp_primarytokenvalue'
  process.env.GITHUB_TOKEN = 'ghs_secondarytokenvalue'
  assert.equal(getToken(), 'ghp_primarytokenvalue')

  delete process.env.GH_TOKEN
  assert.equal(getToken(), 'ghs_secondarytokenvalue')
})

test('empty or whitespace-only credentials are treated as absent', () => {
  process.env.GH_TOKEN = '   '
  process.env.GITHUB_TOKEN = ''
  assert.equal(getToken(), null, 'an unset secret must never disable authentication')

  process.env.GH_TOKEN = ''
  process.env.GITHUB_TOKEN = 'ghs_realvalue'
  assert.equal(getToken(), 'ghs_realvalue')
})

// --- Output safety ---------------------------------------------------------

test('the canonical cache is the only in-repository output allowed', () => {
  const canonical = resolveSafeOutput('config/projects.github.json', fixtureRoot)
  assert.equal(canonical, path.join(fixtureRoot, 'config', 'projects.github.json'))
})

/** The real checkout, so the temporary-directory allowance cannot mask a bad path. */
const checkoutRoot = path.resolve(fileURLToPath(import.meta.url), '..', '..')

test('arbitrary in-repository output paths are rejected', () => {
  assert.throws(() => resolveSafeOutput('src/project-state.json', checkoutRoot), SyncError)
  assert.throws(() => resolveSafeOutput('config/icon-map.json', checkoutRoot), SyncError)
  assert.throws(() => resolveSafeOutput('public/other.json', checkoutRoot), SyncError)
})

test('a system temporary output path stays allowed for dry runs', () => {
  const tempOutput = path.join(tmpdir(), 'salamat-sync-dry-run.json')
  assert.equal(resolveSafeOutput(tempOutput, fixtureRoot), tempOutput)
})

// --- Argument parsing ------------------------------------------------------

test('argument parsing rejects unknown flags and watch without output', () => {
  assert.deepEqual(parseArgs([]), { outputPath: null, watchSeconds: null })
  assert.deepEqual(parseArgs(['--output', 'config/projects.github.json']), {
    outputPath: 'config/projects.github.json',
    watchSeconds: null,
  })
  assert.throws(() => parseArgs(['--nope']), SyncError)
  assert.throws(() => parseArgs(['--watch', '60']), SyncError)
  assert.throws(() => parseArgs(['--watch', '5', '--output', 'config/projects.github.json']), SyncError)
})

// --- Merge -----------------------------------------------------------------

test('merging refreshes selected projects and preserves every other project', () => {
  const registry = registryFixture()
  const refreshed = project({
    id: 'demo-alpha',
    name: 'Demo Alpha',
    repo: 'Murkin1980/demo-alpha',
    triageState: 'IN_PROGRESS',
    triageSource: { status: 'KNOWN', sourceId: 'sha:PROJECT_STATUS.md' },
  })

  const merged = mergeSelected(registry, [refreshed])

  assert.equal(merged.projects.length, 2)
  assert.deepEqual(merged.projects[0], refreshed)
  assert.deepEqual(merged.projects[1], registry.projects[1], 'untouched projects must survive a sync')
  assert.equal(merged.version, registry.version + 1)
  assert.equal(merged.updatedAt, new Date().toISOString().slice(0, 10))
})

// --- Synchronization -------------------------------------------------------

test('sync publishes the canonical cache and the runtime snapshot from one run', async () => {
  installGithubStub()
  process.env.GH_TOKEN = 'ghp_stubbedtokenvalue'

  await syncOnce('config/projects.github.json', getToken(), { repoRoot: fixtureRoot })

  const cache = await readFile(path.join(fixtureRoot, 'config', 'projects.github.json'), 'utf8')
  const runtime = await readFile(path.join(fixtureRoot, 'public', 'project-state.json'), 'utf8')

  assert.equal(cache, runtime, 'one synchronization must publish byte-identical artifacts')
  const registry = parseProjectRegistry(JSON.parse(cache))
  assert.equal(registry.projects.length, 2)

  const alpha = registry.projects.find((entry) => entry.id === 'demo-alpha')!
  assert.equal(alpha.triageState, 'IN_PROGRESS')
  assert.equal(alpha.triageSource.status, 'KNOWN')
  assert.equal(alpha.checkpoint, 'CP-09 — Adapter Contract')
  assert.equal(alpha.lastUpdated, '2026-09-20')
  assert.equal(alpha.evidenceLinks[0]?.sourceId, '0123456789abcdef0123456789abcdef01234567:PROJECT_STATUS.md')
  assert.equal(alpha.source.kind, 'REPOSITORY')

  const beta = registry.projects.find((entry) => entry.id === 'demo-beta')!
  assert.equal(beta.source.kind, 'FIXTURE', 'fixture-only projects are not invented into repositories')
})

test('sync authenticates against the GitHub REST API with the read-only token', async () => {
  const seen: Array<{ url: string; authorization: string | null }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const headers = new Headers(init?.headers)
    seen.push({ url, authorization: headers.get('authorization') })
    return installGithubStubResponse(url)
  }) as typeof fetch

  await syncOnce('config/projects.github.json', 'ghp_readonlytoken', { repoRoot: fixtureRoot })

  assert.ok(seen.length > 0, 'the synchronization must talk to the GitHub API')
  for (const request of seen) {
    assert.ok(request.url.startsWith('https://api.github.com/repos/'), `unexpected endpoint ${request.url}`)
    assert.equal(request.authorization, 'Bearer ghp_readonlytoken')
  }
})

function installGithubStubResponse(url: string): Response {
  const pathname = url.replace('https://api.github.com', '')
  if (pathname === '/repos/Murkin1980/demo-alpha') {
    return Response.json({ default_branch: 'main' })
  }
  if (pathname === '/repos/Murkin1980/demo-alpha/commits/main') {
    return Response.json({
      sha: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555',
      commit: { committer: { date: '2026-09-21T10:00:00Z' } },
    })
  }
  if (pathname.startsWith('/repos/Murkin1980/demo-alpha/contents/PROJECT_STATUS.md')) {
    return Response.json({
      type: 'file',
      path: 'PROJECT_STATUS.md',
      sha: '0123456789abcdef0123456789abcdef01234567',
      html_url: 'https://github.com/Murkin1980/demo-alpha/blob/main/PROJECT_STATUS.md',
      content: encodeContent(STATUS_CONTENT),
    })
  }
  return new Response('{"message":"Not Found"}', { status: 404 })
}

test('sync fails closed and writes nothing when GitHub is unavailable', async () => {
  installGithubStub({ failOn: '/repos/Murkin1980/demo-alpha' })
  const cachePath = path.join(fixtureRoot, 'config', 'projects.github.json')
  const runtimePath = path.join(fixtureRoot, 'public', 'project-state.json')

  await rm(cachePath, { force: true })
  await rm(runtimePath, { force: true })

  await assert.rejects(
    () => syncOnce('config/projects.github.json', 'ghp_readonlytoken', { repoRoot: fixtureRoot }),
    /Not found: \/repos\/Murkin1980\/demo-alpha/,
  )

  await assert.rejects(readFile(cachePath, 'utf8'), { code: 'ENOENT' })
  await assert.rejects(readFile(runtimePath, 'utf8'), { code: 'ENOENT' })
})

test('sync writes no credential material into the generated artifacts', async () => {
  installGithubStub()
  await syncOnce('config/projects.github.json', 'ghp_supersecrettokenvalue', { repoRoot: fixtureRoot })

  for (const relativePath of ['config/projects.github.json', 'public/project-state.json']) {
    const content = await readFile(path.join(fixtureRoot, relativePath), 'utf8')
    assert.ok(!content.includes('ghp_supersecrettokenvalue'), `${relativePath} must not contain the token`)
    assert.ok(!/Authorization/i.test(content), `${relativePath} must not contain an authorization header`)
  }
})

test('sync fails closed when a configured source is missing from the registry', async () => {
  const emptyRoot = await mkdtemp(path.join(tmpdir(), 'salamat-sync-empty-'))
  try {
    await mkdir(path.join(emptyRoot, 'config'), { recursive: true })
    await writeFile(
      path.join(emptyRoot, 'config', 'projects.json'),
      `${JSON.stringify(registryFixture(), null, 2)}\n`,
      'utf8',
    )
    await writeFile(
      path.join(emptyRoot, 'config', 'source-repositories.json'),
      `${JSON.stringify({ version: 1, sources: [{ ...SOURCES.sources[0], projectId: 'ghost-project' }] }, null, 2)}\n`,
      'utf8',
    )
    installGithubStub()

    await assert.rejects(
      () => syncOnce('config/projects.github.json', null, { repoRoot: emptyRoot }),
      /ghost-project/,
    )
  } finally {
    await rm(emptyRoot, { recursive: true, force: true })
  }
})
