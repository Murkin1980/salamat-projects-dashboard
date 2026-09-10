import type { GraphEdgeType } from './node-graph'

export type EdgePresentation = {
  label: string
  color: string
  dash?: string
  description: string
}

export const edgePresentation: Record<GraphEdgeType, EdgePresentation> = {
  uses: { label: 'Использует', color: '#9B6BFF', description: 'Источник использует возможности получателя.' },
  depends_on: { label: 'Зависит от', color: '#F4BC00', description: 'Источник зависит от результата получателя.' },
  evidence_for: { label: 'Подтверждает', color: '#35D0E0', dash: '3 4', description: 'Источник является evidence для получателя.' },
  reports_to: { label: 'Передаёт результат', color: '#20C978', description: 'Источник передаёт результат получателю.' },
  diverged_from: { label: 'Ответвляется от', color: '#E0004F', dash: '8 5', description: 'Источник является отдельной веткой от получателя.' },
}
