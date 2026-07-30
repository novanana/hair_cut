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
const FEATURE = { stroke: '#52525b', strokeWidth: 1.5, fill: 'none' } as const
const HAIRLINE = { stroke: '#94a3b8', strokeWidth: 1.75, fill: 'none' } as const
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

function HeadFrontGuide() {
  const points: HeadPoint[] = [
    { id: 'cp', label: 'CP', x: 150, y: 128, dy: -10 },
    { id: 'scp-l', label: 'SCP', x: 104, y: 145, dx: -16 },
    { id: 'scp-r', label: 'SCP', x: 196, y: 145, dx: 16 },
    { id: 'sp-l', label: 'SP', x: 84, y: 190, dx: -12 },
    { id: 'sp-r', label: 'SP', x: 216, y: 190, dx: 12 },
    { id: 'ep-l', label: 'EP', x: 80, y: 210, dx: -12 },
    { id: 'ep-r', label: 'EP', x: 220, y: 210, dx: 12 },
  ]
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M150,90 C188,90 214,120 216,168 C218,210 208,255 182,288
           C170,304 160,312 150,315 C140,312 130,304 118,288
           C92,255 82,210 84,168 C86,120 112,90 150,90 Z"
        {...OUTLINE}
      />
      <path d="M104,148 Q150,118 196,148" {...HAIRLINE} />
      <path d="M150,90 L150,315" {...GUIDE_LINE} />

      <path d="M110,205 Q122,196 134,205 Q122,214 110,205" {...FEATURE} />
      <path d="M166,205 Q178,196 190,205 Q178,214 166,205" {...FEATURE} />
      <path d="M108,192 Q122,184 136,192" {...FEATURE} />
      <path d="M164,192 Q178,184 192,192" {...FEATURE} />
      <path d="M150,210 L150,246 M142,246 Q150,252 158,246" {...FEATURE} />
      <path d="M130,270 Q150,280 170,270 Q150,278 130,270" {...FEATURE} />

      <PointMarkers points={points} />
    </g>
  )
}

function HeadSideGuide() {
  const points: HeadPoint[] = [
    { id: 'cp', label: 'CP', x: 96, y: 128, dx: -16 },
    { id: 'sp', label: 'SP', x: 118, y: 90, dy: -10 },
    { id: 'tp', label: 'TP', x: 158, y: 68, dy: -10 },
    { id: 'gp', label: 'GP', x: 198, y: 90, dx: 16 },
    { id: 'bp', label: 'BP', x: 215, y: 132, dx: 16 },
    { id: 'ep', label: 'EP', x: 200, y: 155, dx: 16 },
    { id: 'np', label: 'NP', x: 197, y: 232, dx: 16 },
  ]
  const hairlinePath = 'M96,128 Q100,95 158,68 Q208,90 215,132'
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M155,68
           C130,68 108,80 100,100
           C95,112 92,120 88,128
           C86,136 80,142 68,150
           C76,155 80,158 80,162
           C78,168 82,172 80,178
           C84,186 88,190 90,196
           C94,204 100,208 112,213
           C124,219 128,229 128,246
           L128,300 L192,300 L192,240
           C197,225 207,210 212,190
           C219,170 219,150 216,130
           C213,105 200,80 178,72
           C170,69 162,68 155,68 Z"
        {...OUTLINE}
      />
      <path
        d="M195,133 C206,131 211,141 209,153 C207,165 199,175 189,173
           C183,171 183,153 189,141 C191,136 193,133 195,133 Z"
        {...FEATURE}
      />
      <path d="M193,146 Q200,150 195,160" {...FEATURE} />
      <path d={hairlinePath} {...HAIRLINE} />
      <PointMarkers points={points} />
    </g>
  )
}

function HeadBackGuide() {
  const points: HeadPoint[] = [
    { id: 'tp', label: 'TP', x: 150, y: 95, dy: -10 },
    { id: 'gp', label: 'GP', x: 150, y: 150, dx: 16 },
    { id: 'bp', label: 'BP', x: 150, y: 205, dx: 16 },
    { id: 'np', label: 'NP', x: 150, y: 268, dy: 16 },
    { id: 'ep-l', label: 'EP', x: 80, y: 210, dx: -12 },
    { id: 'ep-r', label: 'EP', x: 220, y: 210, dx: 12 },
    { id: 'nsp-l', label: 'NSP', x: 112, y: 252, dx: -18 },
    { id: 'nsp-r', label: 'NSP', x: 188, y: 252, dx: 18 },
  ]
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M150,88 C190,88 216,120 217,165 C218,205 210,240 195,262
           L195,300 L105,300 L105,262
           C90,240 82,205 83,165 C84,120 110,88 150,88 Z"
        {...OUTLINE}
      />
      <path d="M110,150 Q150,128 190,150" {...HAIRLINE} />
      <path d="M150,88 L150,300" {...GUIDE_LINE} />
      <path d="M95,205 L205,205" {...GUIDE_LINE} />
      <path d="M100,250 L200,250" {...GUIDE_LINE} />
      <PointMarkers points={points} />
    </g>
  )
}

function HeadTopGuide() {
  const points: HeadPoint[] = [
    { id: 'cp', label: 'CP', x: 150, y: 302, dy: 16 },
    { id: 'tp', label: 'TP', x: 150, y: 195, dx: 18 },
    { id: 'gp', label: 'GP', x: 150, y: 140, dx: 18 },
    { id: 'bp', label: 'BP', x: 150, y: 95, dy: -10 },
    { id: 'ep-l', label: 'EP', x: 62, y: 205, dx: -16 },
    { id: 'ep-r', label: 'EP', x: 238, y: 205, dx: 16 },
  ]
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M150,90 C205,90 240,130 240,180
           C240,225 220,260 195,285
           C178,300 162,300 150,315
           C138,300 122,300 105,285
           C80,260 60,225 60,180
           C60,130 95,90 150,90 Z"
        {...OUTLINE}
      />
      <path d={`M150,90 L150,315`} {...GUIDE_LINE} />
      <path d={`M60,190 L240,190`} {...GUIDE_LINE} />
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
