'use client'

import { useTranslations } from 'next-intl'

interface ProjectPhaseBadgeProps {
  phase: string
}

/** Phase badge class names using --phase-* tokens (consistent in light/dark) */
const PHASE_CLASSES: Record<string, string> = {
  PRE_CONSTRUCTION: 'badge-phase-pre-construction',
  CONSTRUCTION: 'badge-phase-construction',
  CLOSEOUT: 'badge-phase-closeout',
  COMPLETE: 'badge-phase-complete',
}

export function ProjectPhaseBadge({ phase }: ProjectPhaseBadgeProps) {
  const t = useTranslations('projects')

  const getLabel = (p: string): string => {
    const labels: Record<string, string> = {
      PRE_CONSTRUCTION: t('phases.PRE_CONSTRUCTION'),
      CONSTRUCTION: t('phases.CONSTRUCTION'),
      POST_CONSTRUCTION: t('phases.POST_CONSTRUCTION'),
      CLOSEOUT: t('phases.CLOSEOUT'),
      COMPLETE: t('phases.COMPLETE'),
    }
    return labels[p] || p
  }

  const className = PHASE_CLASSES[phase] ?? PHASE_CLASSES.PRE_CONSTRUCTION

  return <span className={className}>{getLabel(phase)}</span>
}
