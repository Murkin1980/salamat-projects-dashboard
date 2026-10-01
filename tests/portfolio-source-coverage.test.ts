import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { fetchLiveRegistry } from '../src/hooks/use-live-registry.js'
import { parseProjectRegistry, type ProjectRegistry } from '../src/contract/project-state.js'

/**
 * Source coverage and committed-snapshot invariants.
 *
 * The dashboard may only claim a project state it can trace to a canonical
 * repository artifact. These tests keep the configured GitHub sources honest:
 * every source points at a portfolio project that really has that repository,
 * and every portfolio repository without a canonical status source is recorded
 * as an explicit gap instead of being invented.
 */

interface SourceRepoConfig {
  projectId: string
  repo: string
  statusPaths: string[]
  roadmapPaths: string[]
  alternateStatus?: { ref: string; path: string }
}

interface SourceGapConfig {
  projectId: string
  repo: string
  reason: string
}

interface SourceRepositoriesConfig {
  version: number
  sources: SourceRepoConfig[]
  gaps?: SourceGapConfig[]
}

interface PortfolioEntry {
  id: string
  repo: string | null
}

const repoUrl = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))

async function readJson(relative: string): Promise<unknown> {
  return JSON.parse(await readFile(repoUrl(relative), 'utf8'))
}

const sourceConfig = (await readJson('../config/source-repositories.json')) as SourceRepositoriesConfig
const portfolio = ((await readJson('../config/projects.json')) as { projects: PortfolioEntry[] }).projects

/** Portfolio projects that have a canonical GitHub repository. */
const portfolioRepositories = portfolio.filter((project) => project.repo !== null)
/** Portfolio projects represented only by fixture data. */
const fixtureOnlyProjects = portfolio.filter((project) => project.repo === null)

test('every configured source points at a real portfolio repository', () => {
  assert.ok(sourceConfig.sources.length > 0, 'the GitHub source adapter must stay configured')

  for (const source of sourceConfig.sources) {
    const entry = portfolio.find((project) => project.id === source.projectId)
    assert.ok(entry, `source ${source.projectId} is not a portfolio project`)
    assert.equal(
      entry.repo,
      source.repo,
      `source ${source.projectId} must use the canonical portfolio repository`,
    )
    assert.ok(/^[^/\s]+\/[^/\s]+$/.test(source.repo), `source ${source.projectId} has a malformed repository`)
  }
})

test('every portfolio repository is either synchronized or recorded as a gap', () => {
  const sourceIds = new Set(sourceConfig.sources.map((source) => source.projectId))
  const gapIds = new Set((sourceConfig.gaps ?? []).map((gap) => gap.projectId))

  for (const project of portfolioRepositories) {
    assert.ok(
      sourceIds.has(project.id) || gapIds.has(project.id),
      `portfolio repository ${project.id} is neither synchronized nor recorded as a gap`,
    )
  }

  for (const project of fixtureOnlyProjects) {
    assert.ok(
      !sourceIds.has(project.id) && !gapIds.has(project.id),
      `fixture-only project ${project.id} must not claim a GitHub source or a repository gap`,
    )
  }
})

test('no project is both synchronized and recorded as a gap', () => {
  const sourceIds = new Set(sourceConfig.sources.map((source) => source.projectId))
  for (const gap of sourceConfig.gaps ?? []) {
    assert.ok(!sourceIds.has(gap.projectId), `${gap.projectId} cannot be both a source and a gap`)
  }
})

test('every gap names its portfolio repository and explains the missing canonical status source', () => {
  const gaps = sourceConfig.gaps ?? []
  assert.ok(gaps.length > 0, 'uncovered portfolio repositories must stay visible as gaps')

  for (const gap of gaps) {
    const entry = portfolio.find((project) => project.id === gap.projectId)
    assert.ok(entry, `gap ${gap.projectId} is not a portfolio project`)
    assert.equal(entry.repo, gap.repo, `gap ${gap.projectId} must name the canonical repository`)
    assert.ok(gap.reason.trim().length > 20, `gap ${gap.projectId} needs a real explanation`)
    assert.ok(
      /PROJECT_STATUS\.md|STATUS\.md/.test(gap.reason),
      `gap ${gap.projectId} must state which canonical status artifact is missing`,
    )
  }
})

test('sources prefer PROJECT_STATUS.md, allow STATUS.md, and keep ROADMAP.md supporting only', () => {
  for (const source of sourceConfig.sources) {
    assert.ok(source.statusPaths.length > 0, `${source.projectId} needs status paths`)
    for (const statusPath of source.statusPaths) {
      assert.ok(
        statusPath === 'PROJECT_STATUS.md' || statusPath === 'STATUS.md',
        `${source.projectId} may only read canonical status artifacts, got ${statusPath}`,
      )
    }
    if (source.statusPaths.includes('PROJECT_STATUS.md')) {
      assert.equal(
        source.statusPaths[0],
        'PROJECT_STATUS.md',
        `${source.projectId} must prefer PROJECT_STATUS.md over STATUS.md`,
      )
    }
    for (const roadmapPath of source.roadmapPaths) {
      assert.ok(
        !source.statusPaths.includes(roadmapPath),
        `${source.projectId} must not treat ${roadmapPath} as a status artifact`,
      )
    }
  }
})

test('the committed cache and the browser runtime snapshot are the same snapshot', async () => {
  const cache = await readFile(repoUrl('../config/projects.github.json'), 'utf8')
  const runtime = await readFile(repoUrl('../public/project-state.json'), 'utf8')

  assert.equal(cache, runtime, 'one synchronization must publish byte-identical artifacts')

  const registry = parseProjectRegistry(JSON.parse(cache))
  assert.equal(registry.projects.length, portfolio.length, 'no portfolio project may be dropped')

  for (const project of portfolio) {
    assert.ok(
      registry.projects.some((entry) => entry.id === project.id),
      `portfolio project ${project.id} is missing from the committed snapshot`,
    )
  }
})

test('generated artifacts carry no credentials', async () => {
  const secretPatterns = [
    /\bgh[pousr]_[A-Za-z0-9]{16,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
    /Bearer\s+[A-Za-z0-9._\-]{16,}/i,
    /(GH_TOKEN|GITHUB_TOKEN|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)["']?\s*[=:]\s*["']?[A-Za-z0-9._\-]{8,}/i,
  ]

  for (const relativePath of ['../config/projects.github.json', '../public/project-state.json']) {
    const content = await readFile(repoUrl(relativePath), 'utf8')
    for (const pattern of secretPatterns) {
      assert.ok(!pattern.test(content), `${relativePath} must not contain credential material`)
    }
  }
})

test('the browser keeps polling the runtime snapshot and never writes back', async () => {
  const requested: string[] = []
  const registry = parseProjectRegistry(
    JSON.parse(await readFile(repoUrl('../public/project-state.json'), 'utf8')),
  ) as ProjectRegistry

  await fetchLiveRegistry(async (input, init) => {
    requested.push(typeof input === 'string' ? input : input.url)
    assert.equal((init as RequestInit | undefined)?.cache, 'no-store')
    assert.equal((init as RequestInit | undefined)?.method, undefined, 'the dashboard must stay read-only')
    return new Response(JSON.stringify(registry), { status: 200 })
  })

  assert.equal(requested.length, 1)
  assert.match(requested[0], /^\/project-state\.json\?t=\d+$/)
})
