import {
  IconAlertTriangle,
  IconBolt,
  IconCircleCheck,
  IconFlask,
  IconPlayerPause,
  IconPlayerPlay,
  IconRosetteDiscountCheck,
} from '@tabler/icons-react'
import iconMap from '../../config/icon-map.json'
import type { TriageState } from '../contract/project-state.js'
import { Badge, toneColor, type BadgeTone } from './ui'

const triageIcons = {
  bolt: IconBolt,
  'alert-triangle': IconAlertTriangle,
  'circle-check': IconCircleCheck,
  'player-play': IconPlayerPlay,
  flask: IconFlask,
  'player-pause': IconPlayerPause,
  'rosette-discount-check': IconRosetteDiscountCheck,
} as const

function getTriageIcon(name: string) {
  const Icon = triageIcons[name as keyof typeof triageIcons]
  if (!Icon) throw new Error(`Unsupported triage icon in config/icon-map.json: ${name}`)
  return Icon
}

export interface TriageMeta {
  label: string
  tone: BadgeTone
  /** Legacy class kept so existing markup keeps resolving to the same palette. */
  legacyClassName: string
  Icon: typeof IconBolt
}

export const triageMeta: Record<TriageState, TriageMeta> = {
  ACTION_NOW: { label: 'ACTION NOW', tone: 'attention', legacyClassName: 'status-action', Icon: getTriageIcon(iconMap.triage.ACTION_NOW) },
  BLOCKED: { label: 'BLOCKED', tone: 'critical', legacyClassName: 'status-blocked', Icon: getTriageIcon(iconMap.triage.BLOCKED) },
  READY: { label: 'READY', tone: 'positive', legacyClassName: 'status-ready', Icon: getTriageIcon(iconMap.triage.READY) },
  IN_PROGRESS: { label: 'IN PROGRESS', tone: 'active', legacyClassName: 'status-progress', Icon: getTriageIcon(iconMap.triage.IN_PROGRESS) },
  VALIDATION: { label: 'VALIDATION', tone: 'attention', legacyClassName: 'status-validation', Icon: getTriageIcon(iconMap.triage.VALIDATION) },
  HOLD: { label: 'HOLD', tone: 'muted', legacyClassName: 'status-hold', Icon: getTriageIcon(iconMap.triage.HOLD) },
  DONE: { label: 'DONE', tone: 'positive', legacyClassName: 'status-done', Icon: getTriageIcon(iconMap.triage.DONE) },
}

export function triageTone(state: TriageState | null, resolution: 'KNOWN' | 'UNKNOWN' | 'CONFLICT' = 'KNOWN'): BadgeTone {
  if (state === null) return resolution === 'CONFLICT' ? 'critical' : 'muted'
  return triageMeta[state].tone
}

export function triageDotColor(state: TriageState | null, resolution: 'KNOWN' | 'UNKNOWN' | 'CONFLICT' = 'KNOWN'): string {
  return toneColor[triageTone(state, resolution)]
}

/**
 * StatusBadge — compact status pill for triage states.
 * Status is never encoded by colour alone: every badge carries an icon and a
 * text label (see docs/VISUAL_SYSTEM.md §9).
 */
export function StatusBadge({
  state,
  resolution = 'KNOWN',
  className = '',
}: {
  state: TriageState | null
  resolution?: 'KNOWN' | 'UNKNOWN' | 'CONFLICT'
  className?: string
}) {
  if (state === null) {
    return (
      <Badge tone={triageTone(null, resolution)} className={['status-badge', 'status-hold', className].filter(Boolean).join(' ')}>
        <IconAlertTriangle size={13} />
        {resolution === 'CONFLICT' ? 'SOURCE CONFLICT' : 'STATUS UNKNOWN'}
      </Badge>
    )
  }

  const meta = triageMeta[state]
  const Icon = meta.Icon
  return (
    <Badge tone={meta.tone} className={['status-badge', meta.legacyClassName, className].filter(Boolean).join(' ')}>
      <Icon size={13} />
      {meta.label}
    </Badge>
  )
}
