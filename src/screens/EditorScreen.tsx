import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { DrawingCanvas, type Stroke, type Tool } from '../components/DrawingCanvas'
import { Toolbar } from '../components/Toolbar'
import { CATEGORY_LABELS, db, type Diagram } from '../db'
import { useBackClose } from '../hooks/useBackClose'
import { useTemplateOverride } from '../hooks/useTemplateOverride'
import { getTemplate, type TemplateCategory } from '../templates/headTemplates'
import { TemplateSettingsScreen } from './TemplateSettingsScreen'

interface EditorScreenProps {
  templateId: string
  diagramId?: string
  onBack: () => void
}

const THIN_WIDTH = 2
const MIN_SCALE = 0.5
const MAX_SCALE = 4
const AUTOSAVE_DELAY_MS = 500
const THUMBNAIL_WIDTH = 180
// how much drawable margin surrounds the template, as a fraction of its own
// size on each side — lets strokes extend past the template's silhouette
// once it's zoomed/panned instead of being clipped to empty background
const CANVAS_PADDING_RATIO = 0.5
const WORLD_SCALE = 1 + CANVAS_PADDING_RATIO * 2

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as TemplateCategory[]

interface Point {
  x: number
  y: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function EditorScreen({ templateId, diagramId, onBack }: EditorScreenProps) {
  const template = getTemplate(templateId)
  // drawable world extends past the template's own box on every side; the
  // template keeps its original [0,width]x[0,height] coordinates so strokes
  // saved before this padding existed still land in the right place
  const worldWidth = template.viewBox.width * WORLD_SCALE
  const worldHeight = template.viewBox.height * WORLD_SCALE
  const originX = -template.viewBox.width * CANVAS_PADDING_RATIO
  const originY = -template.viewBox.height * CANVAS_PADDING_RATIO
  const savedLayout = useTemplateOverride(templateId)
  const layout = savedLayout ?? template.defaultLayout
  const [showTemplateSettings, setShowTemplateSettings] = useState(false)

  const [title, setTitle] = useState('')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [redoStack, setRedoStack] = useState<Stroke[]>([])
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#f4f4f5')
  const [dashed, setDashed] = useState(false)
  const [showMemo, setShowMemo] = useState(false)
  const [memo, setMemo] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('cut')

  // template position/zoom — unlocked lets two fingers pinch-zoom/pan the
  // template into place; locking freezes the transform so single-finger
  // touches go to drawing instead of accidentally nudging the view. declared
  // early because captureThumbnail/autosave below read the current transform.
  const [positionLocked, setPositionLocked] = useState(false)
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })

  // stable id for this diagram's IndexedDB record — reused across re-renders
  // whether we're editing an existing entry or creating a fresh one
  const [recordId] = useState(() => diagramId ?? uuidv4())
  const createdAtRef = useRef<number>(Date.now())
  // manual sort position for the home screen list — a brand new diagram sorts
  // first (very negative), an existing one keeps whatever position it had
  const orderRef = useRef<number>(-Date.now())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const photoImgRef = useRef<HTMLImageElement | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [ready, setReady] = useState(!diagramId)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // preload the template photo once so captureThumbnail can draw it synchronously
  useEffect(() => {
    const img = new Image()
    img.src = template.photo
    photoImgRef.current = img
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.photo])

  // load an existing diagram's saved state once, before autosave is allowed to run
  useEffect(() => {
    if (!diagramId) return
    let cancelled = false
    db.diagrams.get(diagramId).then((saved) => {
      if (cancelled) return
      if (saved) {
        setTitle(saved.title)
        setStrokes(saved.strokes)
        setMemo(saved.memo)
        setCategory(saved.category)
        createdAtRef.current = saved.createdAt
        orderRef.current = saved.order
      }
      setReady(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramId])

  // captures exactly what's currently visible in the viewport — photo and
  // strokes composited at the same pan/zoom the user left them at, so the
  // saved thumbnail matches the editor screen instead of always showing the
  // template at its default position
  const captureThumbnail = (): string | undefined => {
    const strokesCanvas = canvasRef.current
    const viewportEl = viewportRef.current
    const photoImg = photoImgRef.current
    if (!strokesCanvas || !viewportEl || !photoImg || !photoImg.complete || !photoImg.naturalWidth) {
      return undefined
    }
    const vw = viewportEl.clientWidth
    const vh = viewportEl.clientHeight
    if (!vw || !vh) return undefined

    const width = THUMBNAIL_WIDTH
    const height = Math.round(width * (template.viewBox.height / template.viewBox.width))
    const off = document.createElement('canvas')
    off.width = width
    off.height = height
    const ctx = off.getContext('2d')
    if (!ctx) return undefined

    // match the card's own background so this blends in seamlessly, including
    // in the letterboxed margins that appear when zoomed out
    ctx.fillStyle = '#09090b'
    ctx.fillRect(0, 0, width, height)

    // template-local (0,0)-(tw,th) maps to viewport CSS px as:
    //   screenX = x + Vw*(scale*px/tw + P*(scale-1)), and likewise for Y —
    // derived from the layer's `inset: -P*100%` position plus its
    // `translate(x,y) scale(scale)` transform (origin at the layer's own
    // top-left, i.e. P*100% up/left of the viewport). Converting that CSS-px
    // rect straight to thumbnail-px (same aspect ratio, so one factor works
    // for both axes) gives exactly where the photo appears on screen.
    const px2thumb = width / vw
    const { scale, x, y } = transform
    const photoDestX = (x + vw * CANVAS_PADDING_RATIO * (scale - 1)) * px2thumb
    const photoDestY = (y + vh * CANVAS_PADDING_RATIO * (scale - 1)) * px2thumb
    const photoDestW = vw * scale * px2thumb
    const photoDestH = vh * scale * px2thumb

    // the photo itself is fit into that box the same way the SVG's
    // preserveAspectRatio="xMidYMid meet" does — letterboxed on one axis
    const boxAspect = template.viewBox.width / template.viewBox.height
    const imgAspect = photoImg.naturalWidth / photoImg.naturalHeight
    let fitX = photoDestX
    let fitY = photoDestY
    let fitW = photoDestW
    let fitH = photoDestH
    if (imgAspect > boxAspect) {
      fitH = photoDestW / imgAspect
      fitY = photoDestY + (photoDestH - fitH) / 2
    } else {
      fitW = photoDestH * imgAspect
      fitX = photoDestX + (photoDestW - fitW) / 2
    }
    ctx.drawImage(photoImg, fitX, fitY, fitW, fitH)

    // the strokes canvas's backing bitmap covers the padded WORLD box, which
    // is the same photo rect expanded by CANVAS_PADDING_RATIO on every side
    const worldDestX = photoDestX - photoDestW * CANVAS_PADDING_RATIO
    const worldDestY = photoDestY - photoDestH * CANVAS_PADDING_RATIO
    const worldDestW = photoDestW * WORLD_SCALE
    const worldDestH = photoDestH * WORLD_SCALE
    ctx.drawImage(strokesCanvas, 0, 0, strokesCanvas.width, strokesCanvas.height, worldDestX, worldDestY, worldDestW, worldDestH)

    return off.toDataURL('image/png')
  }

  const persist = async () => {
    setSaveStatus('saving')
    const diagram: Diagram = {
      id: recordId,
      title: title.trim(),
      category,
      templateId,
      strokes,
      memo,
      thumbnail: captureThumbnail(),
      createdAt: createdAtRef.current,
      updatedAt: Date.now(),
      order: orderRef.current,
    }
    await db.diagrams.put(diagram)
    setSaveStatus('saved')
  }

  // debounced autosave — waits for a pause in input so rapid strokes don't
  // each trigger their own IndexedDB write
  useEffect(() => {
    if (!ready) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void persist()
    }, AUTOSAVE_DELAY_MS)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
    // transform is included so panning/zooming alone (without drawing) also
    // re-captures the thumbnail once the view settles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, title, strokes, memo, category, transform])

  const handleBack = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    if (ready) void persist()
    onBack()
  }

  useBackClose(true, handleBack)
  useBackClose(showTemplateSettings, () => setShowTemplateSettings(false))

  const activeGesturePointers = useRef(new Map<number, Point>())
  const lastGesture = useRef<{ dist: number; mid: Point } | null>(null)

  const handleGesturePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // some mobile WebKit versions throw here for touch pointers; capture is
    // best-effort only (see DrawingCanvas) — a throw must not abort the rest
    // of this handler, or the pointer never gets tracked for the pinch gesture
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore — fall back to implicit touch targeting
    }
    activeGesturePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activeGesturePointers.current.size === 2) {
      const [a, b] = Array.from(activeGesturePointers.current.values())
      lastGesture.current = { dist: distance(a, b), mid: midpoint(a, b) }
    }
  }

  const handleGesturePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeGesturePointers.current.has(e.pointerId)) return
    activeGesturePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activeGesturePointers.current.size === 2) {
      const [a, b] = Array.from(activeGesturePointers.current.values())
      const newDist = distance(a, b)
      const newMid = midpoint(a, b)
      const prev = lastGesture.current
      if (prev && prev.dist > 0) {
        setTransform((t) => {
          const nextScale = clamp(t.scale * (newDist / prev.dist), MIN_SCALE, MAX_SCALE)
          // keep the content point that was under the previous pinch midpoint
          // fixed under the new one, so zoom+pan both track the fingers
          const anchorX = (prev.mid.x - t.x) / t.scale
          const anchorY = (prev.mid.y - t.y) / t.scale
          return { scale: nextScale, x: newMid.x - anchorX * nextScale, y: newMid.y - anchorY * nextScale }
        })
      }
      lastGesture.current = { dist: newDist, mid: newMid }
    } else if (activeGesturePointers.current.size === 1) {
      setTransform((t) => ({ ...t, x: t.x + e.movementX, y: t.y + e.movementY }))
    }
  }

  const handleGesturePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    activeGesturePointers.current.delete(e.pointerId)
    if (activeGesturePointers.current.size < 2) lastGesture.current = null
  }

  const handleStrokeComplete = (stroke: Stroke) => {
    setStrokes((prev) => [...prev, stroke])
    setRedoStack([])
  }

  const handleUndo = () => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev
      setRedoStack((r) => [...r, prev[prev.length - 1]])
      return prev.slice(0, -1)
    })
  }

  const handleRedo = () => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev
      setStrokes((s) => [...s, prev[prev.length - 1]])
      return prev.slice(0, -1)
    })
  }

  return (
    <div className="relative flex h-full flex-col">
      {showTemplateSettings && (
        <TemplateSettingsScreen templateId={templateId} onClose={() => setShowTemplateSettings(false)} />
      )}
      <header className="flex items-center gap-3 border-b border-zinc-800 px-3 py-3">
        <button onClick={handleBack} aria-label="뒤로" className="text-xl">
          ←
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`${template.name} 도해도`}
          className="flex-1 bg-transparent text-base font-medium outline-none placeholder:text-zinc-500"
        />
        <span className="shrink-0 text-xs text-zinc-500">
          {saveStatus === 'saving' ? '저장 중…' : saveStatus === 'saved' ? '저장됨' : ''}
        </span>
        <button
          onClick={() => setShowTemplateSettings(true)}
          aria-label="템플릿 설정"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-base text-zinc-200"
        >
          ⚙️
        </button>
        <button
          onClick={() => setShowMemo((v) => !v)}
          aria-label="메모"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${
            showMemo ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-200'
          }`}
        >
          📝
        </button>
      </header>

      <div className="flex gap-1.5 overflow-x-auto border-b border-zinc-800 px-3 py-2">
        {CATEGORY_OPTIONS.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              category === c ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="relative flex-1 overflow-hidden bg-zinc-950">
        {!ready ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">불러오는 중…</div>
        ) : (
          <div ref={viewportRef} className="relative mx-auto aspect-[3/4] w-full max-h-full overflow-hidden">
            <div
              className="absolute"
              style={{
                inset: `${-CANVAS_PADDING_RATIO * 100}%`,
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: '0 0',
              }}
            >
              <svg
                viewBox={`${originX} ${originY} ${worldWidth} ${worldHeight}`}
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                <template.Guide layout={layout} />
              </svg>
              <DrawingCanvas
                ref={canvasRef}
                viewBoxWidth={worldWidth}
                viewBoxHeight={worldHeight}
                originX={originX}
                originY={originY}
                strokes={strokes}
                tool={tool}
                color={color}
                lineWidth={THIN_WIDTH}
                dashed={dashed}
                onStrokeComplete={handleStrokeComplete}
                resolutionScale={positionLocked ? transform.scale : 1}
              />
            </div>

            {!positionLocked && (
              <div
                className="absolute inset-0 touch-none"
                onPointerDown={handleGesturePointerDown}
                onPointerMove={handleGesturePointerMove}
                onPointerUp={handleGesturePointerEnd}
                onPointerCancel={handleGesturePointerEnd}
              />
            )}

            {!positionLocked && (
              <p className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-zinc-900/90 px-3 py-1 text-xs text-zinc-300">
                두 손가락으로 확대/축소 · 이동 후 🔓 버튼으로 고정하세요
              </p>
            )}

            <button
              onClick={() => setPositionLocked((v) => !v)}
              aria-label={positionLocked ? '위치 잠금 해제' : '위치 고정'}
              className={`absolute top-2 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full text-base shadow ${
                positionLocked ? 'bg-zinc-800 text-zinc-200' : 'bg-white text-zinc-900'
              }`}
            >
              {positionLocked ? '🔒' : '🔓'}
            </button>
          </div>
        )}

        {showMemo && (
          <div className="absolute inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-900/95 p-3 backdrop-blur">
            <textarea
              autoFocus
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="수업 중 메모를 남겨보세요 (예: 45도 시술, 크리에이티브 포인트 확인)"
              rows={3}
              className="w-full resize-none rounded-lg bg-zinc-800 p-2 text-sm outline-none placeholder:text-zinc-500"
            />
          </div>
        )}
      </div>

      <Toolbar
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        dashed={dashed}
        onDashedChange={setDashed}
        canUndo={strokes.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
    </div>
  )
}
