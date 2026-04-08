'use client'

import * as React from 'react'
import * as RechartsPrimitive from 'recharts'
import type { LegendPayload, TooltipContentProps } from 'recharts'
import type { Payload as RechartsTooltipPayload } from 'recharts/types/component/DefaultTooltipContent'

import { cn } from '@/lib/utils'

const THEMES = { light: '', dark: '.dark' } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType<{ className?: string }>
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Partial<Record<keyof typeof THEMES, string>> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />')
  }
  return context
}

const INITIAL_DIMENSION = { width: 320, height: 200 } as const

function ChartContainer({
  id,
  className,
  children,
  config,
  initialDimension = INITIAL_DIMENSION,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >['children']
  initialDimension?: { width: number; height: number }
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        data-slot="chart"
        className={cn(
          'flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke="#ccc"]]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke="#fff"]]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke="#ccc"]]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke="#ccc"]]:stroke-border [&_.recharts-sector[stroke="#fff"]]:stroke-transparent [&_.recharts-surface]:outline-none',
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer initialDimension={initialDimension}>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(
    ([, itemConfig]) => itemConfig.theme || itemConfig.color
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .filter(Boolean)
  .join('\n')}
}
`
          )
          .join('\n'),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  formatter,
  color,
  nameKey,
  labelKey,
  labelFormatter,
  labelClassName,
  indicator = 'dot',
  hideLabel = false,
  hideIndicator = false,
  valueFormatter,
}: Partial<TooltipContentProps<number | string, string>> &
  React.ComponentProps<'div'> & {
    indicator?: 'line' | 'dot' | 'dashed'
    hideLabel?: boolean
    hideIndicator?: boolean
    nameKey?: string
    labelKey?: string
    /** When set, numeric values use this instead of `toLocaleString()` (keeps row layout + indicators). */
    valueFormatter?: (value: number) => React.ReactNode
  }) {
  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null
    }

    const [item] = payload
    const key = `${labelKey ?? item?.dataKey ?? item?.name ?? 'value'}`
    const itemConfig = getPayloadConfigFromPayload(config, item, key)
    const value =
      !labelKey && typeof label === 'string'
        ? (config[label as keyof typeof config]?.label ?? label)
        : itemConfig?.label

    if (labelFormatter) {
      return (
        <div className={cn('font-medium', labelClassName)}>
          {labelFormatter(
            value,
            payload as ReadonlyArray<RechartsTooltipPayload<number | string, string>>
          )}
        </div>
      )
    }

    if (value === undefined || value === null || value === '') {
      return null
    }

    return <div className={cn('font-medium', labelClassName)}>{value}</div>
  }, [
    label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ])

  if (!active || !payload?.length) {
    return null
  }

  const nestLabel = payload.length === 1 && indicator !== 'dot'

  return (
    <div
      className={cn(
        'animate-in fade-in-0 zoom-in-95 z-50 grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs shadow-md',
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload
          .filter((item) => item.type !== 'none')
          .map((item, index) => {
            const key = `${nameKey ?? item.name ?? item.dataKey ?? 'value'}`
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const indicatorColor =
              color ??
              (item.payload as { fill?: string } | undefined)?.fill ??
              item.color

            return (
              <div
                key={`${String(item.dataKey ?? item.name)}-${index}`}
                className={cn(
                  'flex w-full flex-wrap items-stretch gap-2',
                  indicator === 'dot' && 'items-center'
                )}
              >
                {formatter &&
                item?.value !== undefined &&
                item.name !== undefined ? (
                  formatter(
                    item.value,
                    item.name,
                    item,
                    index,
                    payload as ReadonlyArray<RechartsTooltipPayload<number | string, string>>
                  )
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon className="h-2.5 w-2.5 text-muted-foreground" />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn('shrink-0 rounded-[2px]', {
                            'h-2.5 w-2.5': indicator === 'dot',
                            'w-0.5 self-stretch': indicator === 'line',
                            'w-0 border border-dashed bg-transparent p-[2px]':
                              indicator === 'dashed',
                          })}
                          style={{
                            backgroundColor:
                              indicator === 'dashed'
                                ? 'transparent'
                                : indicatorColor,
                            borderColor: indicatorColor,
                          }}
                        />
                      )
                    )}
                    <div
                      className={cn(
                        'flex flex-1 justify-between gap-4 leading-none',
                        nestLabel ? 'items-end' : 'items-center'
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label ?? item.name}
                        </span>
                      </div>
                      {item.value != null && (
                        <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                          {typeof item.value === 'number'
                            ? (valueFormatter?.(item.value) ?? item.value.toLocaleString())
                            : String(item.value)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}

ChartTooltipContent.displayName = 'ChartTooltipContent'

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = 'bottom',
  nameKey,
  hiddenKeys,
  onLegendItemClick,
  onLegendItemHover,
}: {
  payload?: ReadonlyArray<LegendPayload>
  verticalAlign?: 'top' | 'bottom' | 'middle'
} & React.ComponentProps<'div'> & {
  hideIcon?: boolean
  nameKey?: string
  /** Series hidden via legend toggle (click). Omitted = no toggle UI. */
  hiddenKeys?: ReadonlySet<string>
  onLegendItemClick?: (dataKey: string) => void
  onLegendItemHover?: (dataKey: string | null) => void
}) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  const interactive = Boolean(onLegendItemClick || onLegendItemHover)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-3',
        verticalAlign === 'top' ? 'pb-3 pt-0' : '',
        className
      )}
    >
      {payload
        .filter((item) => item.type !== 'none')
        .map((item) => {
          const key = `${nameKey ?? item.dataKey ?? 'value'}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)
          const dataKey = String(item.dataKey ?? '')
          const isHidden = hiddenKeys?.has(dataKey) ?? false

          const rowInner = (
            <>
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-[2px] transition-opacity duration-150',
                    isHidden && 'opacity-40'
                  )}
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              <span
                className={cn(
                  'text-muted-foreground transition-opacity duration-150',
                  isHidden && 'opacity-40 line-through'
                )}
              >
                {itemConfig?.label}
              </span>
            </>
          )

          if (!interactive) {
            return (
              <div
                key={`${String(item.dataKey)}-${String(item.value)}`}
                className="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              >
                {rowInner}
              </div>
            )
          }

          return (
            <button
              key={`${String(item.dataKey)}-${String(item.value)}`}
              type="button"
              className={cn(
                'flex items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors duration-150',
                '[&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground',
                'hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              )}
              onClick={() => onLegendItemClick?.(dataKey)}
              onMouseEnter={() => onLegendItemHover?.(dataKey)}
              onMouseLeave={() => onLegendItemHover?.(null)}
              title={
                isHidden
                  ? 'Clic para mostrar en el gráfico'
                  : 'Clic para ocultar del gráfico (leyenda)'
              }
            >
              {rowInner}
            </button>
          )
        })}
    </div>
  )
}

ChartLegendContent.displayName = 'ChartLegendContent'

function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== 'object' || payload === null) {
    return undefined
  }

  const payloadPayload =
    'payload' in payload &&
    typeof (payload as { payload?: unknown }).payload === 'object' &&
    (payload as { payload?: unknown }).payload !== null
      ? (payload as { payload: Record<string, unknown> }).payload
      : undefined

  let configLabelKey: string = key

  if (
    key in payload &&
    typeof (payload as Record<string, unknown>)[key] === 'string'
  ) {
    configLabelKey = (payload as Record<string, unknown>)[key] as string
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key] === 'string'
  ) {
    configLabelKey = payloadPayload[key] as string
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  useChart,
}
