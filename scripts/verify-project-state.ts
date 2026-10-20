/**
 * Read-only guard for the committed portfolio snapshot.
 *
 * This script performs no synchronization and no network access. It only proves
 * that the two artifacts published by `npm run sync:github` are present, schema
 * valid, byte-identical and free of credential material, and that CP-19 coverage
 * and data-quality invariants hold for every project. The Cloudflare Pages
 * workflow runs it after the GitHub sync so a failed sync can never publish a
 * damaged or empty snapshot: the last valid committed snapshot is kept instead.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  CANONICAL_CACHE_RELATIVE_PATH,
  RUNTIME_SNAPSHOT_RELATIVE_PATH,
} from './sync-github-projects.js'
import { parseProjectRegistry } from '../src/contract/project-state.js'
import { classifyProject } from '../src/monitoring/portfolio-coverage.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

/** Credential shapes that must never appear in a generated artifact. */
const SECRET_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'GitHub personal access token', pattern: /\bgh[pousr]_[A-Za-z0-9]{16,}\b/ },
  { label: 'GitHub fine-grained token', pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { label: 'Authorization header value', pattern: /Bearer\s+[A-Za-z0-9._\-]{16,}/i },
  { label: 'AWS access key id', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'Generic private-key header', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  {
    label: 'credential environment value',
    pattern: /(GH_TOKEN|GITHUB_TOKEN|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)["']?\s*[=:]\s*["']?[A-Za-z0-9._\-]{8,}/i,
  },
]

function fail(message: string): never {
  process.stderr.write(`verify-project-state: ${message}\n`)
  process.exit(1)
}

function assertNoSecrets(label: string, content: string): void {
  for (const { label: secretLabel, pattern } of SECRET_PATTERNS) {
    const match = pattern.exec(content)
    if (match) {
      fail(`${label} contains a ${secretLabel}-shaped value; generated artifacts must never carry credentials.`)
    }
  }
}

async function main(): Promise<void> {
  const cachePath = path.join(repoRoot, CANONICAL_CACHE_RELATIVE_PATH)
  const runtimePath = path.join(repoRoot, RUNTIME_SNAPSHOT_RELATIVE_PATH)

  let cacheRaw: string
  let runtimeRaw: string
  try {
    cacheRaw = await readFile(cachePath, 'utf8')
  } catch {
    fail(`${CANONICAL_CACHE_RELATIVE_PATH} is missing; the last valid snapshot must be preserved, not replaced.`)
  }
  try {
    runtimeRaw = await readFile(runtimePath, 'utf8')
  } catch {
    fail(`${RUNTIME_SNAPSHOT_RELATIVE_PATH} is missing; the browser would lose its runtime snapshot.`)
  }

  if (cacheRaw.trim().length === 0) fail(`${CANONICAL_CACHE_RELATIVE_PATH} is empty.`)
  if (runtimeRaw.trim().length === 0) fail(`${RUNTIME_SNAPSHOT_RELATIVE_PATH} is empty.`)

  assertNoSecrets(CANONICAL_CACHE_RELATIVE_PATH, cacheRaw)
  assertNoSecrets(RUNTIME_SNAPSHOT_RELATIVE_PATH, runtimeRaw)

  if (Buffer.compare(Buffer.from(cacheRaw, 'utf8'), Buffer.from(runtimeRaw, 'utf8')) !== 0) {
    fail(`${CANONICAL_CACHE_RELATIVE_PATH} and ${RUNTIME_SNAPSHOT_RELATIVE_PATH} differ; one synchronization must publish both artifacts.`)
  }

  let registry
  try {
    registry = parseProjectRegistry(JSON.parse(cacheRaw))
  } catch (error) {
    fail(`snapshot is not a valid ProjectState registry: ${error instanceof Error ? error.message : String(error)}`)
  }

  // --- CP-19 coverage & data-quality invariants ------------------------------
  //
  // Every project must carry an attributable source classification and must
  // not silently invent data that the source cannot support:
  //
  //  * FIXTURE projects must not claim a repository.
  //  * REPOSITORY projects with an UNAVAILABLE/UNKNOWN/CONFLICT triage source
  //    must not carry a fabricated triageState, blocker, nextAction or activity.
  //  * No project may attribute project or session activity to the SNAPSHOT
  //    source (that is the dashboard's own clock, not evidence).
  //  * Session state is separate from project status; only CONFIRMED closure
  //    with explicit evidence may be CLOSED. (Enforced by the Zod schema.)
  //  * Every REPOSITORY project must be classified in source-repositories.json
  //    as either a synchronized source or an explicit gap.
  //  * Primary classification buckets (CURRENT/STALE/UNKNOWN/UNAVAILABLE/FIXTURE)
  //    are a mutually exclusive partition of the project set and must sum to
  //    the project total. Same for session and history coverage.

  let sourceRepositories: { sources: Array<{ projectId: string }>; gaps?: Array<{ projectId: string }> }
  try {
    sourceRepositories = JSON.parse(
      await readFile(path.join(repoRoot, 'config', 'source-repositories.json'), 'utf8'),
    )
  } catch (error) {
    fail(`cannot read config/source-repositories.json: ${error instanceof Error ? error.message : String(error)}`)
  }
  const sourceIds = new Set(sourceRepositories.sources.map((s) => s.projectId))
  const gapIds = new Set((sourceRepositories.gaps ?? []).map((g) => g.projectId))

  const counts = {
    current: 0, stale: 0, unknown: 0, unavailable: 0, fixture: 0,
    sessionKnown: 0, sessionUnknown: 0,
    historyKnown: 0, historyUnavailable: 0,
  }

  for (const project of registry.projects) {
    const isFixture = project.source.kind === 'FIXTURE'
    const isRepository = project.source.kind === 'REPOSITORY'

    if (isRepository) {
      if (project.repo === null) {
        fail(`repository project ${project.id} must name its canonical repository`)
      }
      if (!sourceIds.has(project.id) && !gapIds.has(project.id)) {
        fail(`repository project ${project.id} is neither a synchronized source nor an explicit gap in config/source-repositories.json`)
      }
    }

    // Primary classification — exactly one bucket per project. Uses the same
    // pure classifier as the UI CoveragePanel so verifier and UI cannot disagree.
    const classification = classifyProject(project).classification

    if (isFixture) {
      if (project.repo !== null) fail(`fixture project ${project.id} must not claim a repository`)
      if (classification !== 'FIXTURE') {
        fail(`fixture project ${project.id} must classify as FIXTURE, got ${classification}`)
      }
      counts.fixture += 1
    } else {
      if (classification === 'FIXTURE') {
        fail(`repository project ${project.id} must not classify as FIXTURE`)
      }
      if (classification === 'UNAVAILABLE') counts.unavailable += 1
      else if (classification === 'UNKNOWN') counts.unknown += 1
      else if (classification === 'STALE') counts.stale += 1
      else counts.current += 1
    }

    // Invariants per triage-resolution (checked regardless of bucket).
    const triageResolution = project.triageSource.status
    if (triageResolution === 'UNAVAILABLE') {
      if (project.triageState !== null) fail(`UNAVAILABLE project ${project.id} must not carry a triageState`)
      if (project.blocker !== null) fail(`UNAVAILABLE project ${project.id} must not carry a fabricated blocker`)
      if (project.nextAction !== null) fail(`UNAVAILABLE project ${project.id} must not carry a fabricated nextAction`)
      if (project.stage !== null) fail(`UNAVAILABLE project ${project.id} must not carry a fabricated stage`)
      if (project.checkpoint !== null) fail(`UNAVAILABLE project ${project.id} must not carry a fabricated checkpoint`)
      if (project.activity.lastMeaningfulActivity.status !== 'UNAVAILABLE') {
        fail(`UNAVAILABLE project ${project.id} must not fabricate lastMeaningfulActivity`)
      }
      if (project.activity.statusUpdatedAt.status !== 'UNAVAILABLE') {
        fail(`UNAVAILABLE project ${project.id} must not fabricate statusUpdatedAt`)
      }
      if (project.history.status !== 'UNAVAILABLE') {
        fail(`UNAVAILABLE project ${project.id} must not fabricate history events`)
      }
      if (project.session.sessionState !== 'UNKNOWN') {
        fail(`UNAVAILABLE project ${project.id} must not assert a session state without evidence`)
      }
    } else if (triageResolution === 'UNKNOWN' || triageResolution === 'CONFLICT') {
      if (project.triageState !== null) fail(`${triageResolution} project ${project.id} must not carry a triageState`)
    }

    if (project.session.sessionState === 'UNKNOWN') counts.sessionUnknown += 1
    else counts.sessionKnown += 1
    if (project.history.status === 'KNOWN') counts.historyKnown += 1
    else counts.historyUnavailable += 1
  }

  const primarySum = counts.current + counts.stale + counts.unknown + counts.unavailable + counts.fixture
  if (primarySum !== registry.projects.length) {
    fail(`coverage classification buckets must sum to total projects (${registry.projects.length}); got ${primarySum} (current=${counts.current} stale=${counts.stale} unknown=${counts.unknown} unavailable=${counts.unavailable} fixture=${counts.fixture})`)
  }
  if (counts.sessionKnown + counts.sessionUnknown !== registry.projects.length) {
    fail(`session coverage buckets must sum to ${registry.projects.length}`)
  }
  if (counts.historyKnown + counts.historyUnavailable !== registry.projects.length) {
    fail(`history coverage buckets must sum to ${registry.projects.length}`)
  }

  process.stdout.write(
    `verify-project-state: snapshot OK — schemaVersion ${registry.schemaVersion}, `
    + `version ${registry.version}, updatedAt ${registry.updatedAt}, `
    + `${registry.projects.length} projects, no credentials detected.\n`,
  )
  process.stdout.write(
    `verify-project-state: coverage — current ${counts.current}, stale ${counts.stale}, `
    + `unknown ${counts.unknown}, unavailable ${counts.unavailable}, fixture ${counts.fixture} `
    + `(sum ${primarySum}/${registry.projects.length}); `
    + `session known ${counts.sessionKnown}, session unknown ${counts.sessionUnknown}; `
    + `history known ${counts.historyKnown}, history unavailable ${counts.historyUnavailable}.\n`,
  )
}

await main()
