import { useEffect, useRef, useState } from 'react'
import { db } from '../db'
import { getTemplate, type Point, type TemplateLayout } from '../templates/headTemplates'

interface TemplateSettingsScreenProps {
  templateId: string
  onClose: () => void
}

type Mode = 'hairline' | 'points'

const MODE_LABELS: Record<Mode, string> = {
  hairline: '헤어라인',
  points: '두상 포인트',
}

const MODE_HINTS: Record<Mode, string> = {
  hairline: '화면을 손가락으로 그으면 헤어라인이 새로 그려집니다.',
  points: '빈 곳을 탭하면 포인트 추가, 점을 탭하면 이름 변경/삭제, 끌면 이동합니다.',
}

// how far a pointer has to travel before a touch counts as a drag rather
// than a tap — taps add/delete points, drags move them
const TAP_THRESHOLD = 4

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function TemplateSettingsScreen({ templateId, onClose }: TemplateSettingsScreenProps) {
  const template = getTemplate(templateId)
  const [mode, setMode] = useState<Mode>('hairline')
  const [draft, setDraft] = useState<TemplateLayout>(template.defaultLayout)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragIndexRef = useRef<number | null>(null)
  const dragStartRef = useRef<Point | null>(null)
  const addStartRef = useRef<Point | null>(null)
  const pointerMovedRef = useRef(false)
  const drawingRef = useRef(false)
  const nextPointNumberRef = useRef(1)

  useEffect(() => {
    let cancelled = false
    db.templateOverrides.get(templateId).then((row) => {
      if (cancelled) return
      setDraft(row?.layout ?? template.defaultLayout)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  const toPoint = (e: React.PointerEvent): Point => {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * template.viewBox.width,
      y: ((e.clientY - rect.top) / rect.height) * template.viewBox.height,
    }
  }

  const beginPointDrag = (index: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore — fall back to implicit touch targeting
    }
    dragIndexRef.current = index
    dragStartRef.current = toPoint(e)
    pointerMovedRef.current = false
  }

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode === 'hairline') {
      e.preventDefault()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // ignore — fall back to implicit touch targeting
      }
      drawingRef.current = true
      const p = toPoint(e)
      setDraft((d) => ({ ...d, hairline: [p] }))
      return
    }
    if (mode === 'points') {
      // only reached for taps that didn't start on an existing marker — those
      // stop propagation in beginPointDrag before this handler ever sees them
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // ignore — fall back to implicit touch targeting
      }
      addStartRef.current = toPoint(e)
      pointerMovedRef.current = false
    }
  }

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode === 'hairline' && drawingRef.current) {
      const p = toPoint(e)
      setDraft((d) => {
        const last = d.hairline[d.hairline.length - 1]
        if (last && distance(last, p) < 3) return d
        return { ...d, hairline: [...d.hairline, p] }
      })
      return
    }
    if (dragIndexRef.current !== null) {
      const p = toPoint(e)
      if (dragStartRef.current && distance(dragStartRef.current, p) > TAP_THRESHOLD) {
        pointerMovedRef.current = true
      }
      const idx = dragIndexRef.current
      setDraft((d) => {
        const points = d.points.slice()
        points[idx] = { ...points[idx], x: p.x, y: p.y }
        return { ...d, points }
      })
      return
    }
    if (mode === 'points' && addStartRef.current) {
      const p = toPoint(e)
      if (distance(addStartRef.current, p) > TAP_THRESHOLD) pointerMovedRef.current = true
    }
  }

  const endInteraction = () => {
    if (dragIndexRef.current !== null) {
      if (!pointerMovedRef.current) {
        // a tap (no drag) on an existing marker selects it for renaming/deleting,
        // or deselects it if it was already selected
        const idx = dragIndexRef.current
        setSelectedIndex((current) => (current === idx ? null : idx))
      }
    } else if (mode === 'points' && addStartRef.current && !pointerMovedRef.current) {
      // a tap (no drag) on empty space adds a new point there, pre-selected so
      // its auto-generated name is immediately ready to rename
      const p = addStartRef.current
      const label = `P${nextPointNumberRef.current++}`
      setDraft((d) => {
        const points = [...d.points, { id: `custom-${Date.now()}`, label, x: p.x, y: p.y }]
        setSelectedIndex(points.length - 1)
        return { ...d, points }
      })
    }
    dragIndexRef.current = null
    dragStartRef.current = null
    addStartRef.current = null
    pointerMovedRef.current = false
    drawingRef.current = false
  }

  const selectedPoint = selectedIndex !== null ? draft.points[selectedIndex] : undefined

  const renameSelected = (label: string) => {
    if (selectedIndex === null) return
    setDraft((d) => {
      const points = d.points.slice()
      points[selectedIndex] = { ...points[selectedIndex], label }
      return { ...d, points }
    })
  }

  const deleteSelected = () => {
    if (selectedIndex === null) return
    const idx = selectedIndex
    setSelectedIndex(null)
    setDraft((d) => ({ ...d, points: d.points.filter((_, i) => i !== idx) }))
  }

  const handleSave = async () => {
    setSaving(true)
    await db.templateOverrides.put({ templateId, layout: draft, updatedAt: Date.now() })
    setSaving(false)
    onClose()
  }

  const handleResetDraft = () => {
    setDraft(template.defaultLayout)
    setSelectedIndex(null)
  }

  const changeMode = (m: Mode) => {
    setMode(m)
    setSelectedIndex(null)
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-zinc-950">
      <header className="flex items-center gap-3 border-b border-zinc-800 px-3 py-3">
        <button onClick={onClose} aria-label="닫기" className="text-xl">
          ←
        </button>
        <h1 className="flex-1 text-base font-medium">{template.name} 템플릿 설정</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-50"
        >
          저장
        </button>
      </header>

      <div className="flex gap-1.5 border-b border-zinc-800 px-3 py-2">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => changeMode(m)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              mode === m ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {mode === 'points' && selectedPoint ? (
        <div className="flex items-center gap-2 px-3 py-2">
          <input
            value={selectedPoint.label}
            onChange={(e) => renameSelected(e.target.value)}
            placeholder="포인트 이름"
            className="min-w-0 flex-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm outline-none placeholder:text-zinc-500"
          />
          <button
            onClick={deleteSelected}
            className="shrink-0 rounded-full bg-red-500/20 px-3 py-1.5 text-xs text-red-300"
          >
            삭제
          </button>
          <button
            onClick={() => setSelectedIndex(null)}
            className="shrink-0 rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300"
          >
            완료
          </button>
        </div>
      ) : (
        <p className="px-3 py-2 text-center text-xs text-zinc-400">{MODE_HINTS[mode]}</p>
      )}

      <div className="relative flex-1 overflow-hidden bg-zinc-950 px-4 pb-4">
        {!ready ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">불러오는 중…</div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${template.viewBox.width} ${template.viewBox.height}`}
            className="mx-auto aspect-[3/4] w-full max-h-full touch-none"
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={endInteraction}
            onPointerCancel={endInteraction}
          >
            <template.Guide layout={draft} />

            {mode === 'points' &&
              draft.points.map((p, idx) => (
                <g key={p.id}>
                  {idx === selectedIndex && (
                    <circle cx={p.x} cy={p.y} r={11} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={7}
                    fill="#f59e0b"
                    fillOpacity={0.55}
                    stroke="#78350f"
                    strokeWidth={1.2}
                    onPointerDown={beginPointDrag(idx)}
                  />
                </g>
              ))}
          </svg>
        )}
      </div>

      <div className="flex justify-center border-t border-zinc-800 px-3 py-3">
        <button onClick={handleResetDraft} className="rounded-full bg-zinc-800 px-4 py-2 text-xs text-zinc-300">
          기본값으로 되돌리기
        </button>
      </div>
    </div>
  )
}
