// Default React import: see NodeView.tsx — required by the tsx test runner's
// classic JSX transform, tree-shaken by the automatic-runtime build.
import React from 'react'
import {
  IconActivity,
  IconAlertTriangle,
  IconBolt,
  IconCircleCheck,
  IconClock,
  IconFlask,
  IconHourglass,
  IconPlayerPause,
  IconPlayerPlay,
  IconQuestionMark,
  IconRosetteDiscountCheck,
} from '@tabler/icons-react'
import iconMap from '../../config/icon-map.json'
import {
  type ArenaSession,
  type ArenaSessionState,
  type TriageState,
} from '../contract/project-state'
import { ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS } from '../monitoring/derived-state'
import { shouldShowSessionIndicator } from '../monitoring/portfolio-ordering'

/**
 * Shared status presentation for the portfolio cards (Triage / Portfolio) and the
 * Project Detail view (CP-16), so an operational status and an Arena session
 * state are rendered identically wherever they appear.
 */

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

export const triageMeta: Record<TriageState, { label: string; className: string; Icon: typeof IconBolt }> = {
  ACTION_NOW: { label: 'ACTION NOW', className: 'status-action', Icon: getTriageIcon(iconMap.triage.ACTION_NOW) },
  BLOCKED: { label: 'BLOCKED', className: 'status-blocked', Icon: getTriageIcon(iconMap.triage.BLOCKED) },
  READY: { label: 'READY', className: 'status-ready', Icon: getTriageIcon(iconMap.triage.READY) },
  IN_PROGRESS: { label: 'IN PROGRESS', className: 'status-progress', Icon: getTriageIcon(iconMap.triage.IN_PROGRESS) },
  VALIDATION: { label: 'VALIDATION', className: 'status-validation', Icon: getTriageIcon(iconMap.triage.VALIDATION) },
  HOLD: { label: 'HOLD', className: 'status-hold', Icon: getTriageIcon(iconMap.triage.HOLD) },
  DONE: { label: 'DONE', className: 'status-done', Icon: getTriageIcon(iconMap.triage.DONE) },
}

/**
 * Operational status badge. An unresolved source stays explicit as
 * `STATUS UNKNOWN` / `SOURCE CONFLICT` instead of being rendered as a state.
 */
export function StatusBadge({ state, resolution = 'KNOWN' }: { state: TriageState | null; resolution?: 'KNOWN' | 'UNKNOWN' | 'CONFLICT' }) {
  if (state === null) {
    return <span className="status-badge status-hold"><IconAlertTriangle size={15}/>{resolution === 'CONFLICT' ? 'SOURCE CONFLICT' : 'STATUS UNKNOWN'}</span>
  }
  const meta = triageMeta[state]
  const Icon = meta.Icon
  return <span className={`status-badge ${meta.className}`}><Icon size={15}/>{meta.label}</span>
}

/**
 * Compact Arena session indicator. It is shown only for the five states that
 * need attention or are genuine gaps (ACTIVE, WAITING_FOR_VALIDATION,
 * READY_TO_CLOSE, STALE_SESSION, UNKNOWN). `NOT_ACTIVE` and `CLOSED` are settled
 * states and get no indicator. The indicator is deliberately a separate element
 * with its own dashed border and "Arena ·" prefix so it never reads as, or
 * replaces, the operational project status badge.
 */
const sessionMeta: Record<ArenaSessionState, { short: string; className: string; Icon: typeof IconClock }> = {
  ACTIVE: { short: 'ACTIVE', className: 'session-active', Icon: IconActivity },
  WAITING_FOR_VALIDATION: { short: 'WAIT VALIDATION', className: 'session-waiting', Icon: IconHourglass },
  READY_TO_CLOSE: { short: 'READY TO CLOSE', className: 'session-ready', Icon: IconCircleCheck },
  STALE_SESSION: { short: 'STALE', className: 'session-stale', Icon: IconAlertTriangle },
  UNKNOWN: { short: 'UNKNOWN', className: 'session-unknown', Icon: IconQuestionMark },
  // Settled states are never surfaced as an indicator; entries kept for totality.
  NOT_ACTIVE: { short: '', className: '', Icon: IconClock },
  CLOSED: { short: '', className: '', Icon: IconClock },
}

export function SessionIndicator({ session }: { session: ArenaSession }) {
  if (!shouldShowSessionIndicator(session.sessionState)) return null
  const meta = sessionMeta[session.sessionState]
  const Icon = meta.Icon
  const thresholdNote = session.sessionState === 'STALE_SESSION'
    ? ` · порог бездействия ${ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS}ч`
    : ''
  return (
    <span
      className={`session-indicator ${meta.className}`}
      title={`Arena session: ${session.sessionState} — ${session.sessionStateReason}${thresholdNote}`}
    >
      <Icon size={13} />
      <span>Arena · {meta.short}</span>
    </span>
  )
}
