'use client'

import { useRef, useEffect, useState } from 'react'
import {
  format,
  eachDayOfInterval,
  isSameDay,
  addDays,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { addWorkingDays, countWorkingDays } from '@/lib/schedule/working-days'
import { GANTT_HEADER_HEIGHT, GANTT_ROW_HEIGHT } from '@/lib/schedule/gantt-constants'

interface GanttTask {
  id: string
  name: string
  startDate: Date
  endDate: Date
  progress: number
  isCritical: boolean
  level: number
  taskType: 'TASK' | 'SUMMARY' | 'MILESTONE'
  dependencies: Array<{
    id: string
    targetId: string
    type: 'FS' | 'SS' | 'FF' | 'SF'
  }>
}

interface GanttTimelineDynamicProps {
  tasks: GanttTask[]
  visibleStartDate: Date
  visibleEndDate: Date
  zoom: 'day' | 'week' | 'month'
  showCriticalPath: boolean
  showDependencies: boolean
  showTodayLine: boolean
  workingDaysPerWeek: number
  onTaskClick?: (taskId: string) => void
  onTaskDragEnd?: (taskId: string, newStartDate: Date, newEndDate: Date) => void
  highlightedTask: string | null
  onTaskHover?: (taskId: string | null) => void
}

export function GanttTimelineDynamic({
  tasks,
  visibleStartDate,
  visibleEndDate,
  zoom,
  showCriticalPath,
  showDependencies,
  showTodayLine,
  workingDaysPerWeek,
  onTaskClick,
  onTaskDragEnd,
  highlightedTask,
  onTaskHover,
}: GanttTimelineDynamicProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredTask, setHoveredTask] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  const [dragState, setDragState] = useState<{
    taskId: string
    dragType: 'move' | 'resize-start' | 'resize-end'
    startX: number
    initialStartDate: Date
    initialEndDate: Date
    originalStartDate: Date
    originalEndDate: Date
  } | null>(null)

  const days = eachDayOfInterval({
    start: visibleStartDate,
    end: visibleEndDate,
  })

  const DAY_WIDTH = containerWidth > 0 ? containerWidth / days.length : 40
  const timelineWidth = days.length * DAY_WIDTH
  const canvasHeight = GANTT_HEADER_HEIGHT + tasks.length * GANTT_ROW_HEIGHT

  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || containerWidth === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = timelineWidth * dpr
    canvas.height = canvasHeight * dpr
    canvas.style.width = `${timelineWidth}px`
    canvas.style.height = `${canvasHeight}px`
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, timelineWidth, canvasHeight)

    drawBackground(ctx)
    drawHeader(ctx)
    drawGrid(ctx)

    if (showTodayLine) {
      drawTodayLine(ctx)
    }

    drawTasks(ctx)

    if (showDependencies) {
      drawDependencies(ctx)
    }
  }, [
    tasks,
    days,
    DAY_WIDTH,
    timelineWidth,
    canvasHeight,
    containerWidth,
    showCriticalPath,
    showDependencies,
    showTodayLine,
    hoveredTask,
    highlightedTask,
    dragState,
  ])

  function drawBackground(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, timelineWidth, canvasHeight)
  }

  function drawHeader(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, timelineWidth, GANTT_HEADER_HEIGHT)

    ctx.fillStyle = '#ffffff'
    ctx.font = '11px Inter, sans-serif'

    const yDay = GANTT_HEADER_HEIGHT - 8
    const yMonth = 10
    if (zoom === 'day') {
      days.forEach((day, idx) => {
        const x = idx * DAY_WIDTH

        ctx.fillText(
          format(day, 'd'),
          x + DAY_WIDTH / 2 - 6,
          yDay
        )

        if (day.getDate() === 1 || idx === 0) {
          ctx.font = 'bold 10px Inter, sans-serif'
          ctx.fillText(
            format(day, 'MMM yyyy', { locale: es }),
            x + 2,
            yMonth
          )
          ctx.font = '11px Inter, sans-serif'
        }

        if (day.getDate() === 1 && idx > 0) {
          ctx.strokeStyle = '#64748b'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, GANTT_HEADER_HEIGHT)
          ctx.stroke()
        }
      })
    } else if (zoom === 'week') {
      days.forEach((day, idx) => {
        if (day.getDay() === 1) {
          const x = idx * DAY_WIDTH
          ctx.fillText(
            format(day, 'dd/MM', { locale: es }),
            x + 2,
            GANTT_HEADER_HEIGHT - 15
          )
        }

        if (day.getDate() === 1 || idx === 0) {
          const x = idx * DAY_WIDTH
          ctx.font = 'bold 11px Inter, sans-serif'
          ctx.fillText(
            format(day, 'MMM yyyy', { locale: es }),
            x + 2,
            GANTT_HEADER_HEIGHT - 35
          )
          ctx.font = '11px Inter, sans-serif'
        }
      })
    } else {
      let lastMonth: Date | null = null
      days.forEach((day, idx) => {
        const monthStart = new Date(day.getFullYear(), day.getMonth(), 1)

        if (!lastMonth || monthStart.getTime() !== lastMonth.getTime()) {
          lastMonth = monthStart
          const x = idx * DAY_WIDTH

          ctx.font = 'bold 10px Inter, sans-serif'
          ctx.fillText(
            format(day, 'MMMM yyyy', { locale: es }),
            x + 4,
            GANTT_HEADER_HEIGHT / 2 + 4
          )
          ctx.font = '11px Inter, sans-serif'
        }
      })
    }
  }

  function drawGrid(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1

    days.forEach((day, idx) => {
      const x = idx * DAY_WIDTH

      ctx.beginPath()
      ctx.moveTo(x, GANTT_HEADER_HEIGHT)
      ctx.lineTo(x, canvasHeight)
      ctx.stroke()

      if (day.getDay() === 0) {
        ctx.fillStyle = 'rgba(248, 250, 252, 0.5)'
        ctx.fillRect(x, GANTT_HEADER_HEIGHT, DAY_WIDTH, canvasHeight - GANTT_HEADER_HEIGHT)
      }
    })

    tasks.forEach((_, idx) => {
      const y = GANTT_HEADER_HEIGHT + (idx + 1) * GANTT_ROW_HEIGHT

      ctx.strokeStyle = '#f1f5f9'
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(timelineWidth, y)
      ctx.stroke()
    })
  }

  function drawTodayLine(ctx: CanvasRenderingContext2D) {
    const today = new Date()
    const todayIdx = days.findIndex((d) => isSameDay(d, today))

    if (todayIdx !== -1) {
      const x = todayIdx * DAY_WIDTH

      ctx.strokeStyle = '#dc2626'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(x, GANTT_HEADER_HEIGHT)
      ctx.lineTo(x, canvasHeight)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = '#dc2626'
      ctx.font = 'bold 10px Inter'
      ctx.fillText('HOY', x + 4, GANTT_HEADER_HEIGHT - 4)
    }
  }

  function drawTasks(ctx: CanvasRenderingContext2D) {
    tasks.forEach((task, idx) => {
      const y = GANTT_HEADER_HEIGHT + idx * GANTT_ROW_HEIGHT
      const isDragging = dragState?.taskId === task.id

      if (isDragging && dragState) {
        const ghostStartDay = days.findIndex((d) =>
          isSameDay(d, dragState.initialStartDate)
        )
        const ghostEndDay = days.findIndex((d) =>
          isSameDay(d, dragState.initialEndDate)
        )
        if (
          ghostStartDay !== -1 &&
          ghostEndDay !== -1 &&
          dragState.initialStartDate.getTime() !==
            dragState.initialEndDate.getTime()
        ) {
          const ghostX = ghostStartDay * DAY_WIDTH
          const ghostW = Math.max(
            (ghostEndDay - ghostStartDay + 1) * DAY_WIDTH,
            DAY_WIDTH * 0.5
          )
          const barY = y + 8
          const barHeight = task.taskType === 'SUMMARY' ? 24 : 20
          ctx.fillStyle = 'rgba(148, 163, 184, 0.35)'
          ctx.strokeStyle = '#94a3b8'
          ctx.setLineDash([4, 4])
          ctx.lineWidth = 1.5
          ctx.strokeRect(ghostX, barY, ghostW, barHeight)
          ctx.fillRect(ghostX, barY, ghostW, barHeight)
          ctx.setLineDash([])
        }
      }

      let startDate = task.startDate
      let endDate = task.endDate

      if (isDragging && dragState) {
        startDate = dragState.originalStartDate
        endDate = dragState.originalEndDate
      }

      const startDay = days.findIndex((d) => isSameDay(d, startDate))
      const endDay = days.findIndex((d) => isSameDay(d, endDate))

      if (startDay === -1 || endDay === -1) return
      if (startDate.getTime() === endDate.getTime()) return

      const barX = startDay * DAY_WIDTH
      const barWidth = Math.max(
        (endDay - startDay + 1) * DAY_WIDTH,
        DAY_WIDTH * 0.5
      )
      const barY = y + 8
      const barHeight = task.taskType === 'SUMMARY' ? 24 : 20

      const isHovered = hoveredTask === task.id
      const isHighlighted = highlightedTask === task.id

      let barColor = '#3b82f6'
      let borderColor = '#1e40af'

      if (task.isCritical && showCriticalPath) {
        barColor = '#dc2626'
        borderColor = '#991b1b'
      }

      if (task.taskType === 'SUMMARY') {
        barColor = '#0ea5e9'
        borderColor = '#0369a1'
      }

      if (isHighlighted) {
        barColor = '#8b5cf6'
        borderColor = '#6d28d9'
      }

      ctx.fillStyle = isHovered ? barColor : barColor + 'dd'

      if (task.taskType === 'SUMMARY') {
        ctx.beginPath()
        ctx.moveTo(barX, barY + barHeight / 2)
        ctx.lineTo(barX + 6, barY)
        ctx.lineTo(barX + barWidth - 6, barY)
        ctx.lineTo(barX + barWidth, barY + barHeight / 2)
        ctx.lineTo(barX + barWidth - 6, barY + barHeight)
        ctx.lineTo(barX + 6, barY + barHeight)
        ctx.closePath()
        ctx.fill()

        ctx.strokeStyle = borderColor
        ctx.lineWidth = isHovered ? 2 : 1.5
        ctx.stroke()
      } else if (task.taskType === 'MILESTONE') {
        const centerX = barX + DAY_WIDTH / 2
        const centerY = barY + barHeight / 2
        const size = 12

        ctx.beginPath()
        ctx.moveTo(centerX, centerY - size)
        ctx.lineTo(centerX + size, centerY)
        ctx.lineTo(centerX, centerY + size)
        ctx.lineTo(centerX - size, centerY)
        ctx.closePath()
        ctx.fill()

        ctx.strokeStyle = borderColor
        ctx.lineWidth = 2
        ctx.stroke()
      } else {
        ctx.fillRect(barX, barY, barWidth, barHeight)

        if (task.progress > 0) {
          ctx.fillStyle = '#1e3a8a'
          const progressWidth = (barWidth * task.progress) / 100
          ctx.fillRect(barX, barY, progressWidth, barHeight)
        }

        ctx.strokeStyle = borderColor
        ctx.lineWidth = isHovered ? 2 : 1
        ctx.strokeRect(barX, barY, barWidth, barHeight)

        if (task.progress > 0 && barWidth > 40) {
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 10px Inter'
          const progressText = `${task.progress}%`
          const textWidth = ctx.measureText(progressText).width
          ctx.fillText(
            progressText,
            barX + barWidth / 2 - textWidth / 2,
            barY + barHeight / 2 + 4
          )
        }
      }

      if (isHovered && task.taskType === 'TASK') {
        ctx.fillStyle = '#1e40af'
        ctx.fillRect(barX - 2, barY, 4, barHeight)
        ctx.fillRect(barX + barWidth - 2, barY, 4, barHeight)
      }
    })
  }

  function drawDependencies(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])

    tasks.forEach((task, idx) => {
      task.dependencies.forEach((dep) => {
        const targetIdx = tasks.findIndex((t) => t.id === dep.targetId)
        if (targetIdx === -1) return

        const targetTask = tasks[targetIdx]

        const startDay = days.findIndex((d) => isSameDay(d, task.endDate))
        const endDay = days.findIndex((d) => isSameDay(d, targetTask.startDate))

        if (startDay === -1 || endDay === -1) return

        const x1 = (startDay + 1) * DAY_WIDTH
        const y1 = GANTT_HEADER_HEIGHT + idx * GANTT_ROW_HEIGHT + GANTT_ROW_HEIGHT / 2

        const x2 = endDay * DAY_WIDTH
        const y2 =
          GANTT_HEADER_HEIGHT + targetIdx * GANTT_ROW_HEIGHT + GANTT_ROW_HEIGHT / 2

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()

        const headlen = 8
        const angle = Math.atan2(y2 - y1, x2 - x1)
        ctx.beginPath()
        ctx.moveTo(x2, y2)
        ctx.lineTo(
          x2 - headlen * Math.cos(angle - Math.PI / 6),
          y2 - headlen * Math.sin(angle - Math.PI / 6)
        )
        ctx.moveTo(x2, y2)
        ctx.lineTo(
          x2 - headlen * Math.cos(angle + Math.PI / 6),
          y2 - headlen * Math.sin(angle + Math.PI / 6)
        )
        ctx.stroke()
      })
    })

    ctx.setLineDash([])
  }

  function getTaskAndPositionAtPoint(
    x: number,
    y: number
  ): {
    task: GanttTask
    taskIndex: number
    position: 'start' | 'end' | 'middle'
  } | null {
    const taskIndex = Math.floor((y - GANTT_HEADER_HEIGHT) / GANTT_ROW_HEIGHT)
    if (taskIndex < 0 || taskIndex >= tasks.length) return null

    const task = tasks[taskIndex]
    if (task.taskType === 'SUMMARY') return null

    const startDay = days.findIndex((d) => isSameDay(d, task.startDate))
    const endDay = days.findIndex((d) => isSameDay(d, task.endDate))

    if (startDay === -1 || endDay === -1) return null
    if (task.startDate.getTime() === task.endDate.getTime()) return null

    const barX = startDay * DAY_WIDTH
    const barWidth = Math.max(
      (endDay - startDay + 1) * DAY_WIDTH,
      DAY_WIDTH * 0.5
    )

    if (x < barX || x > barX + barWidth) return null

    const HANDLE_WIDTH = 8

    if (x >= barX && x <= barX + HANDLE_WIDTH) {
      return { task, taskIndex, position: 'start' }
    }
    if (x >= barX + barWidth - HANDLE_WIDTH && x <= barX + barWidth) {
      return { task, taskIndex, position: 'end' }
    }
    return { task, taskIndex, position: 'middle' }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const result = getTaskAndPositionAtPoint(x, y)
    if (!result) return

    const { task, position } = result

    let dragType: 'move' | 'resize-start' | 'resize-end'

    if (position === 'start') {
      dragType = 'resize-start'
    } else if (position === 'end') {
      dragType = 'resize-end'
    } else {
      dragType = 'move'
    }

    setDragState({
      taskId: task.id,
      dragType,
      startX: x,
      initialStartDate: new Date(task.startDate),
      initialEndDate: new Date(task.endDate),
      originalStartDate: new Date(task.startDate),
      originalEndDate: new Date(task.endDate),
    })

    canvas.style.cursor = dragType === 'move' ? 'grabbing' : 'ew-resize'
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (dragState) {
      const deltaX = x - dragState.startX
      const daysDelta = Math.round(deltaX / DAY_WIDTH)

      if (daysDelta !== 0) {
        const task = tasks.find((t) => t.id === dragState.taskId)
        if (!task) return

        if (dragState.dragType === 'move') {
          const newStart = addWorkingDays(
            dragState.originalStartDate,
            daysDelta,
            workingDaysPerWeek
          )
          const duration = countWorkingDays(
            dragState.originalStartDate,
            dragState.originalEndDate,
            workingDaysPerWeek
          )
          const newEnd = addWorkingDays(
            newStart,
            duration,
            workingDaysPerWeek
          )

          setDragState({
            ...dragState,
            originalStartDate: newStart,
            originalEndDate: newEnd,
          })
        } else if (dragState.dragType === 'resize-start') {
          const newStart = addWorkingDays(
            dragState.originalStartDate,
            daysDelta,
            workingDaysPerWeek
          )

          if (newStart < dragState.originalEndDate) {
            setDragState({
              ...dragState,
              originalStartDate: newStart,
            })
          }
        } else if (dragState.dragType === 'resize-end') {
          const newEnd = addWorkingDays(
            dragState.originalEndDate,
            daysDelta,
            workingDaysPerWeek
          )

          if (newEnd > dragState.originalStartDate) {
            setDragState({
              ...dragState,
              originalEndDate: newEnd,
            })
          }
        }
      }

      return
    }

    const result = getTaskAndPositionAtPoint(x, y)

    if (result) {
      setHoveredTask(result.task.id)
      onTaskHover?.(result.task.id)

      if (result.position === 'start' || result.position === 'end') {
        canvas.style.cursor = 'ew-resize'
      } else {
        canvas.style.cursor = 'grab'
      }
    } else {
      setHoveredTask(null)
      onTaskHover?.(null)
      canvas.style.cursor = 'default'
    }
  }

  function handleMouseUp(_e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return

    if (dragState) {
      if (onTaskDragEnd) {
        onTaskDragEnd(
          dragState.taskId,
          dragState.originalStartDate,
          dragState.originalEndDate
        )
      }

      setDragState(null)
      canvas.style.cursor = 'default'
    }
  }

  function handleMouseLeave() {
    setHoveredTask(null)
    onTaskHover?.(null)

    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default'
    }
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (dragState) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const result = getTaskAndPositionAtPoint(x, y)
    if (result) {
      onTaskClick?.(result.task.id)
    }
  }

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto bg-card"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{
          display: 'block',
          minWidth: `${timelineWidth}px`,
        }}
      />
    </div>
  )
}
