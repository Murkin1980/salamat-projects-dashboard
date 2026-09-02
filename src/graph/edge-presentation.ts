import type { GraphEdgeType } from './node-graph'

export type EdgePresentation = {
  label: string
  color: string
  dash?: string
  description: string
}

export const edgePresentation: Record<GraphEdgeType, EdgePresentation> = {
  uses: { label: 'Использует', color: '#2563eb', description: 'Источник использует возможности получателя.' },
  depends_on: { label: 'Зависит от', color: '#d97706', description: 'Источник зависит от результата получателя.' },
  evidence_for: { label: 'Подтверждает', color: '#7c3aed', dash: '3 4', description: 'Источник является evidence для получателя.' },
  reports_to: { label: 'Передаёт результат', color: '#059669', description: 'Источник передаёт результат получателю.' },
  diverged_from: { label: 'Ответвляется от', color: '#dc2626', dash: '8 5', description: 'Источник является отдельной веткой от получателя.' },
}
