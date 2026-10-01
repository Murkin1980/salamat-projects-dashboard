/**
 * Read-only guard for the committed portfolio snapshot.
 *
 * This script performs no synchronization and no network access. It only proves
 * that the two artifacts published by `npm run sync:github` are present, schema
 * valid, byte-identical and free of credential material. The Cloudflare Pages
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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

/** Credential shapes that must never appear in a generated artifact. */
const SECRET_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'GitHub personal access token', pattern: /\bgh[pousr]_[A-Za-z0-9]{16,}\b/ },
  { label: 'GitHub fine-grained token', pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { label: 'Authorization header value', pattern: /Bearer\s+[A-Za-z0-9._\-]{16,}/i },
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

  process.stdout.write(
    `verify-project-state: snapshot OK — schemaVersion ${registry.schemaVersion}, `
    + `version ${registry.version}, updatedAt ${registry.updatedAt}, `
    + `${registry.projects.length} projects, no credentials detected.\n`,
  )
}

await main()
