import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  buildBaselineTaskPacket,
  parseTaskPacket,
  serializeTaskPacket,
  type TaskPacket,
} from '../src/contract/task-packet.js'
import { parseProjectRegistry } from '../src/contract/project-state.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function failClosed(message: string, cause?: unknown): never {
  if (cause instanceof Error) {
    process.stderr.write(`task-packet-harness: ERROR: ${message}\nDetail: ${cause.message}\n`)
  } else {
    process.stderr.write(`task-packet-harness: ERROR: ${message}\n`)
  }
  process.exit(1)
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

interface HarnessArgs {
  mode: 'generate' | 'validate' | 'help'
  filePath: string | null
  fromStdin: boolean
}

function parseHarnessArgs(argv: string[]): HarnessArgs {
  let mode: 'generate' | 'validate' | 'help' = 'generate'
  let filePath: string | null = null
  let fromStdin = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--generate') {
      mode = 'generate'
    } else if (arg === '--validate') {
      mode = 'validate'
    } else if (arg === '--stdin') {
      fromStdin = true
      mode = 'validate'
    } else if (arg === '--file') {
      filePath = argv[i + 1] ?? null
      if (!filePath) failClosed('--file requires a file path argument')
      mode = 'validate'
      i += 1
    } else if (arg === '-h' || arg === '--help') {
      return { mode: 'help', filePath: null, fromStdin: false }
    } else {
      failClosed(`unrecognized argument: ${arg}`)
    }
  }

  return { mode, filePath, fromStdin }
}

export async function runHarness(argv: string[]): Promise<TaskPacket> {
  const { mode, filePath, fromStdin } = parseHarnessArgs(argv)

  if (mode === 'help') {
    process.stdout.write(
      'Usage: tsx scripts/task-packet-harness.ts [options]\n\n' +
      'Options:\n' +
      '  --generate          Generate and validate baseline Task Packet for salamat-projects-dashboard (default)\n' +
      '  --validate --stdin  Read JSON Task Packet from stdin and validate\n' +
      '  --file <path>       Read JSON Task Packet from file and validate\n' +
      '  -h, --help          Show this help text\n\n' +
      'Safety: One-shot stdio validation only. No task execution or background runtime.\n',
    )
    process.exit(0)
  }

  if (mode === 'generate') {
    const projectsJsonPath = path.join(repoRoot, 'config', 'projects.github.json')
    const rawContent = await readFile(projectsJsonPath, 'utf8')
    const registry = parseProjectRegistry(JSON.parse(rawContent))
    const dashboardProject = registry.projects.find((p) => p.id === 'salamat-projects-dashboard')
    if (!dashboardProject) {
      failClosed('allowlisted project salamat-projects-dashboard not found in registry')
    }

    const packet = buildBaselineTaskPacket(dashboardProject)
    return packet
  }

  // Validation mode
  let rawInput = ''
  if (fromStdin) {
    rawInput = await readStdin()
  } else if (filePath) {
    const resolvedPath = path.resolve(process.cwd(), filePath)
    rawInput = await readFile(resolvedPath, 'utf8')
  } else {
    failClosed('validation mode requires either --stdin or --file <path>')
  }

  if (!rawInput.trim()) {
    failClosed('empty input received')
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawInput)
  } catch (err) {
    failClosed('input is not valid JSON', err)
  }

  try {
    const validatedPacket = parseTaskPacket(parsedJson)
    return validatedPacket
  } catch (err) {
    failClosed('TaskPacket validation failed (fail-closed)', err)
  }
}

// Stdio runner
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runHarness(process.argv.slice(2))
    .then((packet) => {
      process.stdout.write(`${serializeTaskPacket(packet)}\n`)
    })
    .catch((err) => {
      failClosed('unexpected harness error', err)
    })
}
