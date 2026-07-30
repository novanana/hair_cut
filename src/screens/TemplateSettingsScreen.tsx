import { useEffect, useRef, useState } from 'react'
import { db } from '../db'
import { getTemplate, type Point, type TemplateLayout } from '../templates/headTemplates'

interface TemplateSettingsScreenProps {
  templateId: string
  onClose: () => void
}

type Mode = 'ears' | 'hairline' | 'points'

const MODE_LABELS: Record<Mode, string> = {
  ears: '귀 위치',
  hairline: '헤어라인',
  points: '두상 포인트',
}

const MODE_HINTS: Record<Mode, string> = {
  ears: '파란 점을 끌어서 귀 위치를 옮기세요.',
  hairline: '화면을 손가락으로 그으면 헤어라인이 새로 그려집니다.',
  points: '주황 점을 끌어서 기준점 위치를 옮기세요.',
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function TemplateSettingsScreen({ templateId, onClose }: TemplateSettingsScreenProps) {
  const template = getTemplate(templateId)
  const [mode, setMode] = useState<Mode>('ears')
  const [draft, setDraft] = useState<TemplateLayout>(template.defaultLayout)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ kind: 'ear' | 'point'; key: string } | null>(null)
  const drawingRef = useRef(false)

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

  const beginEarDrag = (key: string) => (e: React.PointerEvent) => {
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore — fall back to implicit touch targeting
    }
    dragRef.current = { kind: 'ear', key }
  }

  const beginPointDrag = (index: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore — fall back to implicit touch targeting
    }
    dragRef.current = { kind: 'point', key: String(index) }
  }

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode !== 'hairline') return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore — fall back to implicit touch targeting
    }
    drawingRef.current = true
    const p = toPoint(e)
    setDraft((d) => ({ ...d, hairline: [p] }))
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
    if (!dragRef.current) return
    const p = toPoint(e)
    const drag = dragRef.current
    setDraft((d) => {
      if (drag.kind === 'ear') {
        return { ...d, ears: { ...d.ears, [drag.key]: p } }
      }
      const points = d.points.slice()
      const idx = Number(drag.key)
      points[idx] = { ...points[idx], x: p.x, y: p.y }
      return { ...d, points }
    })
  }

  const endInteraction = () => {
    dragRef.current = null
    drawingRef.current = false
  }

  const handleSave = async () => {
    setSaving(true)
    await db.templateOverrides.put({ templateId, layout: draft, updatedAt: Date.now() })
    setSaving(false)
    onClose()
  }

  const handleResetDraft = () => {
    setDraft(template.defaultLayout)
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
            onClick={() => setMode(m)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              mode === m ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <p className="px-3 py-2 text-center text-xs text-zinc-400">{MODE_HINTS[mode]}</p>

      <div className="relative flex-1 overflow-hidden bg-zinc-950 px-4 pb-4">
        {!ready ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">불러오는 중…</div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${template.viewBox.width} ${template.viewBox.height}`}
            className="mx-auto aspect-[3/4] h-full max-w-full touch-none"
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={endInteraction}
            onPointerCancel={endInteraction}
          >
            <template.Guide layout={draft} />

            {mode === 'ears' &&
              Object.entries(draft.ears).map(([key, pos]) => (
                <circle
                  key={key}
                  cx={pos.x}
                  cy={pos.y}
                  r={9}
                  fill="#38bdf8"
                  fillOpacity={0.5}
                  stroke="#0ea5e9"
                  strokeWidth={1.5}
                  onPointerDown={beginEarDrag(key)}
                />
              ))}

            {mode === 'points' &&
              draft.points.map((p, idx) => (
                <circle
                  key={p.id}
                  cx={p.x}
                  cy={p.y}
                  r={7}
                  fill="#f59e0b"
                  fillOpacity={0.55}
                  stroke="#78350f"
                  strokeWidth={1.2}
                  onPointerDown={beginPointDrag(idx)}
                />
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
