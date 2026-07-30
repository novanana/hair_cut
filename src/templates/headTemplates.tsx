import type { JSX } from 'react'

export type TemplateCategory = 'cut' | 'perm' | 'color' | 'updo' | 'etc'

export interface HeadTemplate {
  id: string
  name: string
  /** shared canvas size every template renders into, so the drawing layer aligns 1:1 */
  viewBox: { width: number; height: number }
  Guide: () => JSX.Element
}

const OUTLINE = { stroke: '#71717a', strokeWidth: 2, fill: '#27272a' } as const
const GUIDE_LINE = { stroke: '#52525b', strokeWidth: 1.5, fill: 'none', strokeDasharray: '6 6' } as const
const POINT_DOT = { r: 3.5, fill: '#f59e0b', stroke: '#78350f', strokeWidth: 1 } as const
const POINT_LABEL = { fontSize: 10, fontWeight: 700, fill: '#f59e0b' } as const

const CANVAS_SIZE = { width: 300, height: 400 }

/** 미용 도해도 기준점(예: CP·TP·GP·BP·NP 등)을 점 + 라벨로 표시 */
interface HeadPoint {
  id: string
  label: string
  x: number
  y: number
  dx?: number
  dy?: number
}

function PointMarkers({ points }: { points: HeadPoint[] }) {
  return (
    <>
      {points.map((p) => (
        <g key={p.id}>
          <circle cx={p.x} cy={p.y} {...POINT_DOT} />
          <text x={p.x + (p.dx ?? 0)} y={p.y + (p.dy ?? -8)} textAnchor="middle" {...POINT_LABEL}>
            {p.label}
          </text>
        </g>
      ))}
    </>
  )
}

// shared head oval used by front/back views
const HEAD_OVAL = { cx: 150, cy: 185, rx: 70, ry: 105 } as const

function HeadFrontGuide() {
  const points: HeadPoint[] = [
    { id: 'cp', label: 'CP', x: 150, y: 118 },
    { id: 'scp-l', label: 'SCP', x: 113, y: 128, dx: -14 },
    { id: 'scp-r', label: 'SCP', x: 187, y: 128, dx: 14 },
    { id: 'sp-l', label: 'SP', x: 85, y: 178, dx: -10 },
    { id: 'sp-r', label: 'SP', x: 215, y: 178, dx: 10 },
    { id: 'ep-l', label: 'EP', x: 78, y: 185, dx: -12 },
    { id: 'ep-r', label: 'EP', x: 222, y: 185, dx: 12 },
  ]
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <ellipse {...HEAD_OVAL} {...OUTLINE} />
      <ellipse cx={78} cy={185} rx={9} ry={17} {...OUTLINE} />
      <ellipse cx={222} cy={185} rx={9} ry={17} {...OUTLINE} />
      <path d="M150,80 L150,290" {...GUIDE_LINE} />
      <path d="M113,150 L113,290" {...GUIDE_LINE} />
      <path d="M187,150 L187,290" {...GUIDE_LINE} />
      <PointMarkers points={points} />
    </g>
  )
}

function HeadSideGuide() {
  const points: HeadPoint[] = [
    { id: 'cp', label: 'CP', x: 100, y: 100, dx: -12 },
    { id: 'sp', label: 'SP', x: 120, y: 90, dy: -10 },
    { id: 'tp', label: 'TP', x: 155, y: 70, dy: -10 },
    { id: 'gp', label: 'GP', x: 188, y: 85, dx: 12 },
    { id: 'bp', label: 'BP', x: 210, y: 120, dx: 14 },
    { id: 'ep', label: 'EP', x: 185, y: 165, dx: 14 },
    { id: 'np', label: 'NP', x: 185, y: 225, dx: 14 },
  ]
  const guideCurve = points.map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <rect x={120} y={230} width={60} height={70} rx={12} {...OUTLINE} />
      <ellipse cx={150} cy={155} rx={68} ry={88} {...OUTLINE} />
      <ellipse cx={185} cy={165} rx={9} ry={15} {...OUTLINE} />
      <polyline points={guideCurve} {...GUIDE_LINE} />
      <PointMarkers points={points} />
    </g>
  )
}

function HeadBackGuide() {
  const points: HeadPoint[] = [
    { id: 'tp', label: 'TP', x: 150, y: 95, dy: -10 },
    { id: 'gp', label: 'GP', x: 150, y: 150, dx: 16 },
    { id: 'bp', label: 'BP', x: 150, y: 205, dx: 16 },
    { id: 'np', label: 'NP', x: 150, y: 270, dy: 16 },
    { id: 'ep-l', label: 'EP', x: 78, y: 185, dx: -12 },
    { id: 'ep-r', label: 'EP', x: 222, y: 185, dx: 12 },
    { id: 'nsp-l', label: 'NSP', x: 112, y: 255, dx: -16 },
    { id: 'nsp-r', label: 'NSP', x: 188, y: 255, dx: 16 },
  ]
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <ellipse {...HEAD_OVAL} {...OUTLINE} />
      <ellipse cx={78} cy={185} rx={9} ry={17} {...OUTLINE} />
      <ellipse cx={222} cy={185} rx={9} ry={17} {...OUTLINE} />
      <path d="M150,80 L150,290" {...GUIDE_LINE} />
      <path d="M100,150 L200,150" {...GUIDE_LINE} />
      <path d="M95,210 L205,210" {...GUIDE_LINE} />
      <path d="M108,270 L192,270" {...GUIDE_LINE} />
      <PointMarkers points={points} />
    </g>
  )
}

function HeadTopGuide() {
  const cx = 150
  const cy = 210
  const r = 110
  const points: HeadPoint[] = [
    { id: 'cp', label: 'CP', x: cx, y: cy - r, dy: -10 },
    { id: 'tp', label: 'TP', x: cx, y: cy, dx: 18 },
    { id: 'gp', label: 'GP', x: cx, y: cy + r * 0.5, dx: 18 },
    { id: 'bp', label: 'BP', x: cx, y: cy + r, dy: 16 },
    { id: 'ep-l', label: 'EP', x: cx - r, y: cy, dx: -14 },
    { id: 'ep-r', label: 'EP', x: cx + r, y: cy, dx: 14 },
  ]
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <circle cx={cx} cy={cy} r={r} {...OUTLINE} />
      <path d={`M${cx},${cy - r} L${cx},${cy + r}`} {...GUIDE_LINE} />
      <path d={`M${cx - r},${cy} L${cx + r},${cy}`} {...GUIDE_LINE} />
      <PointMarkers points={points} />
    </g>
  )
}

export const HEAD_TEMPLATES: HeadTemplate[] = [
  { id: 'front', name: '앞모습', viewBox: CANVAS_SIZE, Guide: HeadFrontGuide },
  { id: 'side', name: '옆모습', viewBox: CANVAS_SIZE, Guide: HeadSideGuide },
  { id: 'back', name: '뒷모습', viewBox: CANVAS_SIZE, Guide: HeadBackGuide },
  { id: 'top', name: '탑(위)뷰', viewBox: CANVAS_SIZE, Guide: HeadTopGuide },
]

export function getTemplate(id: string): HeadTemplate {
  return HEAD_TEMPLATES.find((t) => t.id === id) ?? HEAD_TEMPLATES[0]
}
