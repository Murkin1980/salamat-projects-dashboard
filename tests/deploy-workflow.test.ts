import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

/**
 * Scheduled deployment contract.
 *
 * The Cloudflare Pages workflow is the only production path for the portfolio
 * snapshot. It must refresh project state from GitHub *before* the build, use
 * only the existing read-only credential mechanism, and never publish a stale
 * snapshot when the GitHub sync fails.
 */

const workflowPath = fileURLToPath(new URL('../.github/workflows/deploy-cloudflare-pages.yml', import.meta.url))
const workflow = await readFile(workflowPath, 'utf8')

interface WorkflowStep {
  name: string
  body: string
}

/** Extracts the ordered job steps of the single production job. */
function extractSteps(yaml: string): WorkflowStep[] {
  const steps: WorkflowStep[] = []
  let current: { name: string; body: string[] } | null = null

  for (const line of yaml.split('\n')) {
    const match = /^      - (?:name: (.*)|uses: (.*))$/.exec(line)
    if (match) {
      if (current) steps.push({ name: current.name, body: current.body.join('\n') })
      current = { name: (match[1] ?? match[2] ?? '').trim(), body: [] }
    } else if (current && /^ {7,}\S/.test(line)) {
      current.body.push(line)
    }
  }
  if (current) steps.push({ name: current.name, body: current.body.join('\n') })
  return steps
}

const steps = extractSteps(workflow)
const stepNames = steps.map((step) => step.name)
const stepAt = (name: string): WorkflowStep => {
  const step = steps.find((candidate) => candidate.name === name)
  assert.ok(step, `workflow is missing the "${name}" step`)
  return step
}
const indexOfStep = (name: string): number => {
  const index = stepNames.indexOf(name)
  assert.ok(index >= 0, `workflow is missing the "${name}" step`)
  return index
}

test('the schedule stays at the approved six-hour cadence', () => {
  assert.match(workflow, /cron:\s*"17 \*\/6 \* \* \*"/, 'the sync frequency must not change')
  assert.ok(!/cron:\s*"\* \* \* \* \*"/.test(workflow), 'no per-minute scheduling may be introduced')
})

test('the scheduled run refreshes GitHub portfolio state before the build', () => {
  const order = [
    'Checkout',
    'Setup Node.js',
    'Install dependencies',
    'Run tests',
    'Verify GitHub credentials are configured',
    'Sync GitHub portfolio state',
    'Refresh Murat House discovery analytics',
    'Build',
    'Deploy existing Cloudflare Pages project',
    'Verify production snapshot',
  ]

  let previous = -1
  for (const name of order) {
    const index = indexOfStep(name)
    assert.ok(index > previous, `"${name}" is out of order in the deployment sequence`)
    previous = index
  }

  const sync = stepAt('Sync GitHub portfolio state')
  assert.match(sync.body, /npm run sync:github -- --output config\/projects\.github\.json/)
  assert.ok(
    indexOfStep('Sync GitHub portfolio state') < indexOfStep('Build'),
    'the GitHub sync must run before npm run build',
  )
})

test('the GitHub sync uses only the existing read-only credential mechanism', () => {
  for (const name of ['Verify GitHub credentials are configured', 'Sync GitHub portfolio state']) {
    const body = stepAt(name).body
    assert.match(body, /GH_TOKEN: \$\{\{ secrets\.GH_TOKEN \}\}/, `${name} must read GH_TOKEN`)
    assert.match(body, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/, `${name} must fall back to the workflow token`)
  }

  const credentials = stepAt('Verify GitHub credentials are configured').body
  assert.match(credentials, /::error::/)
  assert.ok(!/echo\s+"?\$\{?GH_TOKEN/.test(credentials), 'credentials must never be printed')

  // No credential value may ever be written into the repository or its artifacts.
  assert.ok(!/\bgh[pousr]_[A-Za-z0-9]{16,}\b/.test(workflow), 'no token literal may be committed')
  assert.ok(!/\bgithub_pat_[A-Za-z0-9_]{20,}\b/.test(workflow), 'no token literal may be committed')
})

test('a failing GitHub sync blocks deployment instead of publishing a stale snapshot', () => {
  const sync = stepAt('Sync GitHub portfolio state')
  assert.ok(!/continue-on-error:\s*true/.test(sync.body), 'a failed sync must block deployment')

  const verify = stepAt('Verify published portfolio snapshot').body
  assert.match(verify, /npm run verify:snapshot/, 'the snapshot must be verified before build')
  assert.ok(
    indexOfStep('Verify published portfolio snapshot') < indexOfStep('Build'),
    'snapshot verification must happen before the build',
  )
})

test('production verification still hashes the deployed runtime snapshot', () => {
  const verification = stepAt('Verify production snapshot').body
  assert.match(verification, /sha256sum public\/project-state\.json/)
  assert.match(verification, /https:\/\/projects\.salamat-mebel\.kz\/project-state\.json/)
  assert.match(verification, /::error::/)
})

test('the workflow adds no backend, worker, database or new runtime', () => {
  assert.match(workflow, /npx wrangler pages deploy dist --project-name salamat-projects-dashboard --branch main/)

  const forbidden = [
    /wrangler deploy(?!\s+dist)/,
    /\bd1\b/,
    /\bKV\b/,
    /\bR2\b/,
    /pages functions/i,
    /new Worker/i,
    /\bPOST\b/,
    /\bPUT\b/,
  ]
  for (const pattern of forbidden) {
    assert.ok(!pattern.test(workflow), `the deployment must not introduce ${pattern}`)
  }
})
