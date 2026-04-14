type ChartDotProps = {
  cx?: number
  cy?: number
  index?: number
  stroke?: string
  fill?: string
}

type LastPointDotOptions = {
  radius?: number
  strokeWidth?: number
}

export function createLastPointDot(totalPoints: number, options: LastPointDotOptions = {}) {
  const { radius = 4.5, strokeWidth = 1.5 } = options

  return function LastPointDot(props: ChartDotProps) {
    if (props.index !== totalPoints - 1) return null
    if (typeof props.cx !== 'number' || typeof props.cy !== 'number') return null

    const color = props.stroke ?? props.fill ?? 'currentColor'

    return (
      <circle
        cx={props.cx}
        cy={props.cy}
        r={radius}
        fill={color}
        stroke="hsl(var(--background))"
        strokeWidth={strokeWidth}
      />
    )
  }
}
