import { z } from 'zod'
import { TriageStateSchema, type ProjectState, type TriageState } from './project-state.js'

export const TASK_PACKET_SCHEMA_VERSION = '1.0.0' as const

export const ALLOWED_REPOSITORIES = [
  'Murkin1980/salamat-projects-dashboard',
] as const

export const ALLOWED_PROJECT_IDS = [
  'salamat-projects-dashboard',
] as const

export type AllowedRepository = (typeof ALLOWED_REPOSITORIES)[number]
export type AllowedProjectId = (typeof ALLOWED_PROJECT_IDS)[number]

const NonEmptyStringSchema = z.string().trim().min(1, 'Field cannot be empty')
const SlugIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected a lowercase slug identifier')

const IsoDateTimeSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/, 'Expected an ISO 8601 UTC timestamp (YYYY-MM-DDTHH:mm:ssZ)')
  .refine((val) => !Number.isNaN(Date.parse(val)), 'Expected a valid calendar timestamp')

const EvidenceRefSchema = z.object({
  sourceId: NonEmptyStringSchema,
  url: z.url(),
}).strict()

export const TaskScopeSchema = z.object({
  included: z.array(NonEmptyStringSchema).min(1, 'At least one included scope item is required'),
  excluded: z.array(NonEmptyStringSchema).min(1, 'At least one excluded scope item is required'),
}).strict()

export type TaskScope = z.infer<typeof TaskScopeSchema>

// Secret and sensitive data heuristic detector
const SENSITIVE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'GitHub Personal Access Token (classic)', pattern: /\bghp_[A-Za-z0-9]{36,}\b/ },
  { name: 'GitHub OAuth Access Token', pattern: /\bgho_[A-Za-z0-9]{36,}\b/ },
  { name: 'GitHub Fine-Grained PAT', pattern: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { name: 'Bearer Token', pattern: /\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/i },
  { name: 'OpenAI / Anthropic Secret Key', pattern: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: 'AWS Access Key ID', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Private Key block', pattern: /-----BEGIN(?:[A-Z\s]+)?PRIVATE KEY-----/i },
  { name: 'Password assignment', pattern: /(?:password|secret|passwd|token|credentials)\s*[:=]\s*['"][^\s'"]+['"]/i },
  { name: 'Cookie header / token', pattern: /(?:set-cookie|cookie):\s*[^\r\n]+/i },
  { name: 'Unix absolute home/root path', pattern: /(?:^|\s)(?:\/home\/|\/Users\/|\/root\/|\/etc\/|\/var\/|\/tmp\/)[A-Za-z0-9_.-]+/ },
  { name: 'Windows absolute drive path', pattern: /(?:^|\s)[A-Za-z]:\\[A-Za-z0-9_.-]+/ },
]

export function detectSensitiveContent(value: unknown, currentPath = ''): string | null {
  if (typeof value === 'string') {
    for (const { name, pattern } of SENSITIVE_PATTERNS) {
      if (pattern.test(value)) {
        return `Sensitive or forbidden data detected at ${currentPath || 'root'}: matched ${name}`
      }
    }
    return null
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const match = detectSensitiveContent(value[i], `${currentPath}[${i}]`)
      if (match) return match
    }
    return null
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, propValue] of Object.entries(value)) {
      const subPath = currentPath ? `${currentPath}.${key}` : key
      const match = detectSensitiveContent(propValue, subPath)
      if (match) return match
    }
    return null
  }

  return null
}

const TaskPacketBaseSchema = z.object({
  schemaVersion: z.literal(TASK_PACKET_SCHEMA_VERSION),
  taskId: SlugIdSchema,
  projectId: z.enum(ALLOWED_PROJECT_IDS, {
    message: `projectId must be in allowlist: ${ALLOWED_PROJECT_IDS.join(', ')}`,
  }),
  repo: z.enum(ALLOWED_REPOSITORIES, {
    message: `repo must be in allowlist: ${ALLOWED_REPOSITORIES.join(', ')}`,
  }),
  checkpoint: NonEmptyStringSchema,
  triageState: TriageStateSchema,
  nextAction: NonEmptyStringSchema,
  objective: NonEmptyStringSchema,
  scope: TaskScopeSchema,
  acceptanceCriteria: z.array(NonEmptyStringSchema).min(1, 'At least one acceptance criterion is required'),
  createdAt: IsoDateTimeSchema,
  evidenceRef: EvidenceRefSchema,
}).strict()

export const TaskPacketSchema = TaskPacketBaseSchema.superRefine((packet, context) => {
  const sensitiveError = detectSensitiveContent(packet)
  if (sensitiveError) {
    context.addIssue({
      code: 'custom',
      message: sensitiveError,
    })
  }

  if (packet.triageState === 'BLOCKED') {
    context.addIssue({
      code: 'custom',
      path: ['triageState'],
      message: 'Cannot create execution task packet for a BLOCKED project',
    })
  }
})

export type TaskPacket = z.infer<typeof TaskPacketSchema>

export function parseTaskPacket(input: unknown): TaskPacket {
  return TaskPacketSchema.parse(input)
}

export function safeParseTaskPacket(input: unknown) {
  return TaskPacketSchema.safeParse(input)
}

export function isRepositoryAllowed(repo: string | null): repo is AllowedRepository {
  if (!repo) return false
  return (ALLOWED_REPOSITORIES as readonly string[]).includes(repo)
}

export function isProjectAllowed(projectId: string): projectId is AllowedProjectId {
  return (ALLOWED_PROJECT_IDS as readonly string[]).includes(projectId)
}

export function buildBaselineTaskPacket(
  project: ProjectState,
  overrides?: {
    objective?: string
    scope?: TaskScope
    acceptanceCriteria?: string[]
    createdAt?: string
  },
): TaskPacket {
  if (!isProjectAllowed(project.id) || !isRepositoryAllowed(project.repo)) {
    throw new Error(`Project ${project.id} (${project.repo ?? 'no repo'}) is not allowlisted for Task Packet creation`)
  }

  if (project.triageState === null) {
    throw new Error(`Cannot create task packet for project ${project.id} with unresolved triage state`)
  }

  if (project.triageState === 'BLOCKED') {
    throw new Error(`Cannot create task packet for project ${project.id} while it is BLOCKED: ${project.blocker}`)
  }

  const primaryEvidence = project.evidenceLinks[0] ?? {
    label: 'PROJECT_STATUS.md',
    url: `https://github.com/${project.repo}/blob/main/PROJECT_STATUS.md`,
    sourceId: `${project.source.id}:PROJECT_STATUS.md`,
  }

  const rawPacket = {
    schemaVersion: TASK_PACKET_SCHEMA_VERSION,
    taskId: `task-${project.id}-${Date.now().toString(36)}`,
    projectId: project.id as AllowedProjectId,
    repo: project.repo as AllowedRepository,
    checkpoint: project.checkpoint ?? 'CP-09 — Codex App Server Experiment',
    triageState: project.triageState as TriageState,
    nextAction: project.nextAction ?? 'Implement CP-09 baseline Task Packet contract',
    objective: overrides?.objective ?? 'Implement baseline Task Packet contract, fail-closed validation, and one-shot stdio harness for Codex App Server evaluation.',
    scope: overrides?.scope ?? {
      included: [
        'Strict Zod TaskPacket contract with schemaVersion 1.0.0',
        'Repository and project allowlist restricted to salamat-projects-dashboard',
        'Fail-closed validation with secret and absolute-path pattern scanning',
        'One-shot stdio harness for preview and validation without runtime execution',
        'Read-only UI preview and export with cancellation',
      ],
      excluded: [
        'Cross-repository execution or write-back',
        'Persistent orchestrator, database, Worker or server daemon',
        'Task execution or turn/start triggers from dashboard UI',
        'Storing tokens, credentials, cookies or local secrets',
      ],
    },
    acceptanceCriteria: overrides?.acceptanceCriteria ?? [
      'Task packet schema validation strictly rejects unapproved repos and unknown fields',
      'Secrets and absolute local paths are detected and fail validation immediately',
      'Dashboard UI offers read-only preview, copy, export and safe cancellation',
      'One-shot stdio harness validates payloads without starting a persistent process',
    ],
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    evidenceRef: {
      sourceId: primaryEvidence.sourceId,
      url: primaryEvidence.url,
    },
  }

  return parseTaskPacket(rawPacket)
}

export function serializeTaskPacket(packet: TaskPacket): string {
  return JSON.stringify(packet, null, 2)
}
