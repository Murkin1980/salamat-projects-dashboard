import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { tmpdir } from 'node:os'
import {
  adaptGithubSource,
  type RepositoryArtifact,
  type RepositorySnapshot,
} from '../src/adapters/github-source.js'
import {
  parseProjectRegistry,
  type ProjectRegistry,
  type ProjectState,
} from '../src/contract/project-state.js'

// --- Config ---------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

interface AlternateStatusConfig {
  ref: string
  path: string
}

interface SourceRepoConfig {
  projectId: string
  repo: string
  statusPaths: string[]
  roadmapPaths: string[]
  alternateStatus?: AlternateStatusConfig
}

interface SourceRepositoriesConfig {
  version: number
  sources: SourceRepoConfig[]
}

// --- GitHub REST client ----------------------------------------------------

const API_BASE = 'https://api.github.com'

interface RepoMeta {
  default_branch: string
}

interface HeadCommit {
  sha: string
  commit: {
    committer: {
      date: string
    }
  }
}

interface GithubContent {
  type: string
  path: string
  sha: string
  html_url: string
  content: string
}

class NotFoundError extends Error {
  constructor(public readonly pathname: string) {
    super(`Not found: ${pathname}`)
  }
}

function getToken(): string | null {
  return process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? null
}

function failClosed(message: string, cause?: unknown): never {
  if (cause instanceof Error) {
    process.stderr.write(`sync-github-projects: ${message}: ${cause.message}\n`)
  } else {
    process.stderr.write(`sync-github-projects: ${message}\n`)
  }
  process.exit(1)
}

async function githubRequest(
  pathname: string,
  token: string | null,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'salamat-projects-dashboard-sync',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_BASE}${pathname}`, { headers })
  } catch (error) {
    failClosed(`network request failed for ${pathname}`, error)
  }

  if (response.status === 404) throw new NotFoundError(pathname)
  if (response.status === 401 || response.status === 403) {
    failClosed(`GitHub rejected the request (HTTP ${response.status}) for ${pathname}`)
  }
  if (!response.ok) {
    failClosed(`GitHub request failed (HTTP ${response.status}) for ${pathname}`)
  }
  return response.json()
}

function encodePath(filePath: string): string {
  return filePath.split('/').map(encodeURIComponent).join('/')
}

function decodeBase64(content: string): string {
  return Buffer.from(content.replace(/\n/g, ''), 'base64').toString('utf8')
}

async function fetchArtifact(
  repo: string,
  ref: string,
  filePath: string,
  token: string | null,
): Promise<RepositoryArtifact | null> {
  try {
    const data = (await githubRequest(
      `/repos/${repo}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(ref)}`,
      token,
    )) as GithubContent
    if (!data || data.type !== 'file' || !data.content) return null
    return {
      path: filePath,
      ref,
      sha: data.sha,
      htmlUrl: data.html_url,
      content: decodeBase64(data.content),
    }
  } catch (error) {
    if (error instanceof NotFoundError) return null
    throw error
  }
}

async function firstExistingArtifact(
  candidates: string[],
  repo: string,
  ref: string,
  token: string | null,
): Promise<RepositoryArtifact | null> {
  for (const candidate of candidates) {
    const artifact = await fetchArtifact(repo, ref, candidate, token)
    if (artifact) return artifact
  }
  return null
}

// --- Sync ------------------------------------------------------------------

function mergeSelected(
  registry: ProjectRegistry,
  selected: ProjectState[],
): ProjectRegistry {
  const selectedById = new Map(selected.map((state) => [state.id, state]))
  const existingIds = new Set(registry.projects.map((project) => project.id))
  const merged = [
    ...registry.projects.map((project) => selectedById.get(project.id) ?? project),
    ...selected.filter((state) => !existingIds.has(state.id)),
  ]
  return {
    ...registry,
    version: registry.version + 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    projects: merged,
  }
}

function parseArgs(argv: string[]): { outputPath: string | null } {
  let outputPath: string | null = null
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--output') {
      outputPath = argv[i + 1]
      if (!outputPath) failClosed('--output requires a path')
      i += 1
    } else if (arg === '-h' || arg === '--help') {
      process.stdout.write(
        'Usage: sync-github-projects.ts [--output <path>]\n',
      )
      process.exit(0)
    } else {
      failClosed(`unknown argument: ${arg}`)
    }
  }
  return { outputPath }
}

function resolveSafeOutput(outputPath: string): string {
  const resolved = path.resolve(repoRoot, outputPath)
  const canonicalCache = path.join(repoRoot, 'config', 'projects.github.json')
  const allowedTempRoots = [path.resolve(tmpdir()), path.resolve('C:\\tmp')]
  const isInTemp = allowedTempRoots.some((tempRoot) => {
    const relativeToTemp = path.relative(tempRoot, resolved)
    return relativeToTemp !== '' && !relativeToTemp.startsWith('..') && !path.isAbsolute(relativeToTemp)
  })

  if (resolved !== canonicalCache && !isInTemp) {
    failClosed('--output must be config/projects.github.json or a file inside the system temp directory')
  }
  return resolved
}

async function main(): Promise<void> {
  const { outputPath } = parseArgs(process.argv.slice(2))
  const token = getToken()

  const sourceConfig = JSON.parse(
    await readFile(path.join(repoRoot, 'config', 'source-repositories.json'), 'utf8'),
  ) as SourceRepositoriesConfig
  const registry = parseProjectRegistry(
    JSON.parse(
      await readFile(path.join(repoRoot, 'config', 'projects.json'), 'utf8'),
    ),
  )

  const selected: ProjectState[] = []
  for (const source of sourceConfig.sources) {
    const fixtureProject = registry.projects.find((project) => project.id === source.projectId)
    if (!fixtureProject) failClosed(`source project is absent from validated registry: ${source.projectId}`)

    const meta = (await githubRequest(
      `/repos/${source.repo}`,
      token,
    )) as RepoMeta
    const head = (await githubRequest(
      `/repos/${source.repo}/commits/${encodeURIComponent(meta.default_branch)}`,
      token,
    )) as HeadCommit

    const artifacts: RepositoryArtifact[] = []
    const primary = await firstExistingArtifact(
      source.statusPaths,
      source.repo,
      meta.default_branch,
      token,
    )
    if (primary) artifacts.push(primary)

    const roadmap = await firstExistingArtifact(
      source.roadmapPaths,
      source.repo,
      meta.default_branch,
      token,
    )
    if (roadmap) artifacts.push(roadmap)

    let alternateStatus: RepositorySnapshot['alternateStatus']
    if (source.alternateStatus) {
      const alternate = await fetchArtifact(
        source.repo,
        source.alternateStatus.ref,
        source.alternateStatus.path,
        token,
      )
      if (alternate) {
        alternateStatus = {
          branch: source.alternateStatus.ref,
          artifact: alternate,
        }
      }
    }

    const snapshot: RepositorySnapshot = {
      projectId: source.projectId,
      name: fixtureProject.name,
      summary: fixtureProject.summary,
      repo: source.repo,
      defaultBranch: meta.default_branch,
      headSha: head.sha,
      headCommittedAt: head.commit.committer.date,
      retrievedAt: new Date().toISOString().slice(0, 10),
      artifacts,
      alternateStatus,
    }

    selected.push(adaptGithubSource(snapshot))
  }

  const merged = mergeSelected(registry, selected)
  // Re-parse to enforce schema validation (fail closed on schema errors).
  const validated = parseProjectRegistry(merged)
  const json = `${JSON.stringify(validated, null, 2)}\n`

  if (outputPath) {
    await writeFile(resolveSafeOutput(outputPath), json, 'utf8')
  } else {
    process.stdout.write(json)
  }
}

main().catch((error) => failClosed('sync failed', error))
