'use client'

import { useCallback, useState } from 'react'

/** Emphasized stroke when a series is hovered (legend or chart leave resets hover). */
const HOVER_STROKE = 2.75
const FADED_STROKE_OPACITY = 0.3
const AREA_FILL_FADED = 0.04

/**
 * Local-only state for multi-series chart focus: legend hover dimming + legend click hide/show.
 * Does not mutate data; hidden series are skipped at render time.
 */
export function useChartSeriesInteraction() {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set())
  const [hoverKey, setHoverKey] = useState<string | null>(null)

  const toggleKey = useCallback((key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const isVisible = useCallback(
    (key: string) => !hiddenKeys.has(key),
    [hiddenKeys]
  )

  const linePresentation = useCallback(
    (key: string, baseStroke: number) => {
      if (hiddenKeys.has(key)) return null
      const highlightOn = hoverKey !== null
      const isTarget = hoverKey === key
      const faded = highlightOn && !isTarget
      return {
        strokeOpacity: faded ? FADED_STROKE_OPACITY : 1,
        strokeWidth: isTarget ? Math.max(HOVER_STROKE, baseStroke) : baseStroke,
      }
    },
    [hiddenKeys, hoverKey]
  )

  const areaPresentation = useCallback(
    (key: string, baseStroke: number, normalFillOpacity: number) => {
      if (hiddenKeys.has(key)) return null
      const highlightOn = hoverKey !== null
      const isTarget = hoverKey === key
      const faded = highlightOn && !isTarget
      return {
        strokeOpacity: faded ? FADED_STROKE_OPACITY : 1,
        strokeWidth: isTarget ? Math.max(HOVER_STROKE, baseStroke) : baseStroke,
        fillOpacity: faded ? AREA_FILL_FADED : normalFillOpacity,
      }
    },
    [hiddenKeys, hoverKey]
  )

  return {
    hiddenKeys,
    hoverKey,
    setHoverKey,
    toggleKey,
    isVisible,
    linePresentation,
    areaPresentation,
  }
}
