import { readFile, rename, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { tmpdir } from 'node:os'
import {
  adaptGithubSource,
  readStatusRevisionLabels,
  type RepositoryArtifact,
  type RepositorySnapshot,
} from '../src/adapters/github-source.js'
import {
  HISTORY_LIMITS,
  type CommitEvidence,
  type PullRequestEvidence,
  type RepositoryHistoryEvidence,
  type StatusRevisionEvidence,
} from '../src/monitoring/history-derivation.js'
import {
  parseProjectRegistry,
  type ProjectRegistry,
  type ProjectState,
} from '../src/contract/project-state.js'

// --- Config ---------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

/** Committed reviewable cache: the single normalized snapshot this repository owns. */
export const CANONICAL_CACHE_RELATIVE_PATH = path.join('config', 'projects.github.json')
/** Browser runtime snapshot served next to the static build output. */
export const RUNTIME_SNAPSHOT_RELATIVE_PATH = path.join('public', 'project-state.json')

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

/**
 * Portfolio repository that has no reliable canonical status source.
 * Recorded as a gap instead of inventing a status artifact for it.
 */
export interface SourceGapConfig {
  projectId: string
  repo: string
  reason: string
}

interface SourceRepositoriesConfig {
  version: number
  sources: SourceRepoConfig[]
  gaps?: SourceGapConfig[]
}

export interface SyncOptions {
  /** Repository root holding `config/` and `public/`; defaults to this checkout. */
  repoRoot?: string
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

/** Fail-closed error; the CLI boundary turns it into stderr output and exit code 1. */
export class SyncError extends Error {}

/**
 * Reads the read-only GitHub token from the environment. Empty or whitespace-only
 * values count as absent, so an unset secret can never silently disable authentication.
 */
export function getToken(): string | null {
  for (const candidate of [process.env.GH_TOKEN, process.env.GITHUB_TOKEN]) {
    if (candidate && candidate.trim().length > 0) return candidate.trim()
  }
  return null
}

function failClosed(message: string, cause?: unknown): never {
  if (cause instanceof Error) {
    throw new SyncError(`${message}: ${cause.message}`)
  }
  throw new SyncError(message)
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

// --- History evidence (CP-17) ---------------------------------------------

interface GithubCommitListItem {
  sha: string
  html_url: string
  commit: { message: string; committer: { date: string } | null }
}

interface GithubPullListItem {
  number: number
  title: string
  html_url: string
  created_at: string
  merged_at: string | null
  closed_at: string | null
  merge_commit_sha: string | null
}

function toCommitEvidence(item: GithubCommitListItem): CommitEvidence {
  return {
    sha: item.sha,
    committedAt: item.commit.committer?.date ?? '',
    message: item.commit.message,
    url: item.html_url,
  }
}

/**
 * Reads the recent, bounded history window of one repository with the same
 * read-only credentials and the same fail-closed client as the rest of the sync.
 * Raw status-artifact content is parsed into labels immediately and never kept.
 */
async function collectHistoryEvidence(
  repo: string,
  branch: string,
  statusPath: string | null,
  token: string | null,
): Promise<RepositoryHistoryEvidence> {
  const commits = (await githubRequest(
    `/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${HISTORY_LIMITS.commits}`,
    token,
  )) as GithubCommitListItem[]

  const pulls = (await githubRequest(
    `/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=${HISTORY_LIMITS.pullRequests}`,
    token,
  )) as GithubPullListItem[]

  let statusRevisions: StatusRevisionEvidence[] | null = null
  if (statusPath) {
    const revisionCommits = (await githubRequest(
      `/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&path=${encodePath(statusPath)}&per_page=${HISTORY_LIMITS.statusRevisions}`,
      token,
    )) as GithubCommitListItem[]
    statusRevisions = []
    for (const revision of revisionCommits) {
      const artifact = await fetchArtifact(repo, revision.sha, statusPath, token)
      statusRevisions.push({
        sha: revision.sha,
        committedAt: revision.commit.committer?.date ?? '',
        url: revision.html_url,
        labels: artifact ? readStatusRevisionLabels(artifact.content) : null,
      })
    }
  }

  const pullRequests: PullRequestEvidence[] = pulls.map((pull) => ({
    number: pull.number,
    title: pull.title,
    url: pull.html_url,
    createdAt: pull.created_at,
    mergedAt: pull.merged_at,
    closedAt: pull.closed_at,
    mergeCommitSha: pull.merge_commit_sha,
  }))

  return { repo, commits: commits.map(toCommitEvidence), pullRequests, statusRevisions }
}

// --- Sync ------------------------------------------------------------------

export function mergeSelected(
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

export function parseArgs(argv: string[]): { outputPath: string | null; watchSeconds: number | null } {
  let outputPath: string | null = null
  let watchSeconds: number | null = null
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--output') {
      outputPath = argv[i + 1]
      if (!outputPath) failClosed('--output requires a path')
      i += 1
    } else if (arg === '--watch') {
      const rawInterval = argv[i + 1]
      watchSeconds = Number(rawInterval)
      if (!rawInterval || !Number.isInteger(watchSeconds) || watchSeconds < 15) {
        failClosed('--watch requires an integer interval of at least 15 seconds')
      }
      i += 1
    } else if (arg === '-h' || arg === '--help') {
      process.stdout.write(
        'Usage: sync-github-projects.ts [--output <path>] [--watch <seconds>]\n',
      )
      process.exit(0)
    } else {
      failClosed(`unknown argument: ${arg}`)
    }
  }
  if (watchSeconds !== null && outputPath === null) failClosed('--watch requires --output')
  return { outputPath, watchSeconds }
}

export function resolveSafeOutput(outputPath: string, root: string = repoRoot): string {
  const resolved = path.resolve(root, outputPath)
  const canonicalCache = path.join(root, CANONICAL_CACHE_RELATIVE_PATH)
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

export async function writeAtomic(outputPath: string, json: string): Promise<void> {
  const temporaryPath = `${outputPath}.next`
  await writeFile(temporaryPath, json, 'utf8')
  await rename(temporaryPath, outputPath)
}

export async function syncOnce(
  outputPath: string | null,
  token: string | null,
  options: SyncOptions = {},
): Promise<void> {
  const root = options.repoRoot ?? repoRoot

  // Validate the destination before doing any network work: a rejected output
  // path must never leave a partially refreshed snapshot behind.
  const resolvedOutput = outputPath ? resolveSafeOutput(outputPath, root) : null

  // One observation time for the whole run. It is recorded as the snapshot
  // generation timestamp only and is never used as project or session activity.
  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const snapshotSourceId = CANONICAL_CACHE_RELATIVE_PATH.split(path.sep).join('/')

  const sourceConfig = JSON.parse(
    await readFile(path.join(root, 'config', 'source-repositories.json'), 'utf8'),
  ) as SourceRepositoriesConfig
  const registry = parseProjectRegistry(
    JSON.parse(
      await readFile(path.join(root, 'config', 'projects.json'), 'utf8'),
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
      generatedAt,
      snapshotSourceId,
      artifacts,
      alternateStatus,
      historyEvidence: await collectHistoryEvidence(
        source.repo,
        meta.default_branch,
        primary?.path ?? null,
        token,
      ),
    }

    selected.push(adaptGithubSource(snapshot))
  }

  const merged = mergeSelected(registry, selected)
  // Re-parse to enforce schema validation (fail closed on schema errors).
  const validated = parseProjectRegistry(merged)
  const json = `${JSON.stringify(validated, null, 2)}\n`

  if (resolvedOutput) {
    await writeAtomic(resolvedOutput, json)
    // Publishing the canonical cache must also refresh the browser runtime
    // snapshot: one synchronization, two committed artifacts, never two mechanisms.
    if (resolvedOutput === path.join(root, CANONICAL_CACHE_RELATIVE_PATH)) {
      await writeAtomic(path.join(root, RUNTIME_SNAPSHOT_RELATIVE_PATH), json)
    }
  } else {
    process.stdout.write(json)
  }
}

async function main(): Promise<void> {
  const { outputPath, watchSeconds } = parseArgs(process.argv.slice(2))
  const token = getToken()
  do {
    try {
      await syncOnce(outputPath, token)
    } catch (error) {
      failClosed('sync failed', error)
    }
    if (watchSeconds === null) return
    process.stderr.write(`sync-github-projects: refreshed; next run in ${watchSeconds}s\n`)
    await new Promise((resolve) => setTimeout(resolve, watchSeconds * 1_000))
  } while (true)
}

// Stdio runner
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    const detail = error instanceof Error ? error.message : String(error)
    process.stderr.write(`sync-github-projects: ${detail}\n`)
    process.exit(1)
  })
}
