const API = 'https://api.github.com'
const REPO = 'Murkin1980/murat-project-engineer'
const SOURCE_PATH = 'experiments/EXPERIMENT_REGISTRY.json'
const OUTPUT = 'config/experiments.github.json'

function token() { return process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim() || null }
async function get(path) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'salamat-projects-dashboard-experiment-sync' }
  const t = token(); if (t) headers.Authorization = `Bearer ${t}`
  const response = await fetch(`${API}${path}`, { headers })
  if (!response.ok) throw new Error(`GitHub request failed (HTTP ${response.status}) for ${path}`)
  return response.json()
}
function evidenceUrl(experiment) {
  const links = Array.isArray(experiment.evidence_links) ? experiment.evidence_links : []
  const absolute = links.find((x) => typeof x === 'string' && x.startsWith('https://github.com/'))
  if (absolute) return absolute
  const path = links.find((x) => typeof x === 'string' && x) || experiment.experiment_path
  return typeof path === 'string' && path ? `https://github.com/${experiment.repo}/blob/main/${path}` : `https://github.com/${experiment.repo}`
}
function normalizeStatus(status) { return status === 'RETIRED' ? 'RETIRED' : status }
async function main() {
  const source = await get(`/repos/${REPO}/contents/${SOURCE_PATH}?ref=main`)
  const raw = JSON.parse(Buffer.from(source.content.replace(/\\n/g, ''), 'base64').toString('utf8'))
  const experiments = raw.experiments.map((e) => ({ experiment_id:e.experiment_id, name:e.name, owning_project:e.owning_project, status:normalizeStatus(e.status), next_action:e.next_action, updated_at:e.updated_at, repo:e.repo, evidence_url:evidenceUrl(e) }))
  await import('node:fs/promises').then(({writeFile}) => writeFile(OUTPUT, JSON.stringify({schema_version:'1.0.0',updated_at:raw.updated_at,source:REPO,source_url:`https://github.com/${REPO}/blob/main/${SOURCE_PATH}`,experiments},null,2)+'\\n'))
  console.log(`sync-mpe-experiments: synchronized ${experiments.length} experiments from ${REPO} at ${raw.updated_at}`)
}
main().catch((error) => { console.error(`sync-mpe-experiments: ${error.message}`); process.exit(1) })
