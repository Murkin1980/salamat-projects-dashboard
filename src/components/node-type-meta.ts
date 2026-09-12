import {
  IconBox,
  IconClock,
  IconFileCheck,
  IconFolderCode,
  IconGitBranch,
  IconRoute,
} from '@tabler/icons-react'
import type { GraphEdgeType, GraphNodeType } from '../graph/node-graph'

/**
 * Presentation metadata for graph node types. Shared by the desktop React
 * Flow branch (canvas nodes + type filters) and the dedicated mobile Nodes
 * branch so both render the same vocabulary from the same source.
 */
export const nodeTypeMeta = {
  PROJECT: { label: 'Проект', Icon: IconFolderCode },
  SUBSYSTEM: { label: 'Подсистема', Icon: IconBox },
  EVIDENCE: { label: 'Evidence', Icon: IconFileCheck },
  BRANCH: { label: 'Ветка', Icon: IconGitBranch },
  STAGE: { label: 'Этап', Icon: IconRoute },
  FUTURE: { label: 'Будущее', Icon: IconClock },
} satisfies Record<GraphNodeType, { label: string; Icon: typeof IconBox }>

export const allNodeTypes = Object.keys(nodeTypeMeta) as GraphNodeType[]

export const allEdgeTypes: GraphEdgeType[] = ['uses', 'depends_on', 'evidence_for', 'reports_to', 'diverged_from']
