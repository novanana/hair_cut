import { useEffect, useRef } from 'react'

export type Tool = 'pen' | 'eraser'

export interface StrokePoint {
  x: number
  y: number
  pressure: number
}

export interface Stroke {
  id: string
  tool: Tool
  color: string
  width: number
  dashed: boolean
  points: StrokePoint[]
}

// crypto.randomUUID() only exists in secure contexts (https, or localhost) —
// opening the dev server from a phone over plain http://<lan-ip> doesn't
// qualify, so calling it there throws and silently aborts the pointerdown
// handler before any drawing happens. Fall back to a plain unique string.
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

interface DrawingCanvasProps {
  viewBoxWidth: number
  viewBoxHeight: number
  strokes: Stroke[]
  tool: Tool
  color: string
  lineWidth: number
  dashed: boolean
  onStrokeComplete: (stroke: Stroke) => void
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const { points } = stroke
  if (points.length === 0) return

  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
  ctx.strokeStyle = stroke.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash(stroke.dashed ? [stroke.width * 2.5, stroke.width * 2] : [])

  const avgPressure = points.reduce((sum, p) => sum + p.pressure, 0) / points.length
  ctx.lineWidth = stroke.width * (0.6 + avgPressure * 0.8)

  if (points.length === 1) {
    const p = points[0]
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + 0.1, p.y + 0.1)
    ctx.stroke()
    return
  }

  // draw the whole stroke as ONE continuous path (smoothed with running
  // midpoints) and stroke it once — dash patterns restart at each separate
  // stroke() call, so splitting into per-segment paths made dashes and solid
  // lines look identical
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    const mid = { x: (curr.x + next.x) / 2, y: (curr.y + next.y) / 2 }
    ctx.quadraticCurveTo(curr.x, curr.y, mid.x, mid.y)
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
  ctx.stroke()
}

export function DrawingCanvas({
  viewBoxWidth,
  viewBoxHeight,
  strokes,
  tool,
  color,
  lineWidth,
  dashed,
  onStrokeComplete,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeStrokeRef = useRef<Stroke | null>(null)
  const activePointerId = useRef<number | null>(null)

  const renderAll = (extra?: Stroke) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    for (const stroke of strokes) drawStroke(ctx, stroke)
    if (extra) drawStroke(ctx, extra)
  }

  // keep the backing resolution crisp on high-dpi phone screens and
  // redraw whenever the committed stroke list changes (e.g. undo/redo)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = viewBoxWidth * dpr
    canvas.height = viewBoxHeight * dpr
    const ctx = canvas.getContext('2d')
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, viewBoxWidth, viewBoxHeight])

  const toViewBoxPoint = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * viewBoxWidth
    const y = ((e.clientY - rect.top) / rect.height) * viewBoxHeight
    // mouse reports pressure 0; treat that as a default "full" press
    const pressure = e.pointerType === 'mouse' ? 0.5 : e.pressure || 0.5
    return { x, y, pressure }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    // some mobile WebKit versions throw here for touch pointers; a throw would
    // silently abort the rest of this handler (no stroke, nothing drawn), so
    // capture is best-effort only — touch input still targets this element
    // without it via the browser's implicit touch targeting
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore — fall back to implicit touch targeting
    }
    activePointerId.current = e.pointerId
    activeStrokeRef.current = {
      id: generateId(),
      tool,
      color,
      width: lineWidth,
      dashed,
      points: [toViewBoxPoint(e)],
    }
    renderAll(activeStrokeRef.current)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerId.current !== e.pointerId || !activeStrokeRef.current) return
    e.preventDefault()
    activeStrokeRef.current.points.push(toViewBoxPoint(e))
    renderAll(activeStrokeRef.current)
  }

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerId.current !== e.pointerId) return
    const finished = activeStrokeRef.current
    activeStrokeRef.current = null
    activePointerId.current = null
    if (finished && finished.points.length > 0) onStrokeComplete(finished)
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      onPointerLeave={endStroke}
    />
  )
}
