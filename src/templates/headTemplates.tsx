import type { JSX } from 'react'
import backPhoto from '../assets/templates/back.png'
import frontPhoto from '../assets/templates/front.png'
import sidePhoto from '../assets/templates/side.png'
import topPhoto from '../assets/templates/top.png'

export type TemplateCategory = 'cut' | 'perm' | 'color' | 'updo' | 'etc'

export interface Point {
  x: number
  y: number
}

export interface HeadPoint extends Point {
  id: string
  label: string
  dx?: number
  dy?: number
}

/** everything about a template a user can customize and save per templateId */
export interface TemplateLayout {
  /** anatomical reference points (C.P·S.P·E.P·T.P·G.P·B.P·N.P) */
  points: HeadPoint[]
  /** hairline boundary, drawn as straight segments through these points — empty means no hairline drawn */
  hairline: Point[]
}

export interface HeadTemplate {
  id: string
  name: string
  /** shared canvas size every template renders into, so the drawing layer aligns 1:1 */
  viewBox: { width: number; height: number }
  /** reference photo used as the base template art */
  photo: string
  defaultLayout: TemplateLayout
  Guide: (props?: { layout?: TemplateLayout }) => JSX.Element
}

const HAIRLINE = { stroke: '#38bdf8', strokeWidth: 1.3, fill: 'none' } as const
const GUIDE_LINE = { stroke: '#52525b', strokeWidth: 1, fill: 'none', strokeDasharray: '4 4' } as const

/** 미용 도해도 기준점(E.P·S.P·C.P·T.P·G.P·B.P·N.P)을 작은 점 + 라벨로 표시 */
const POINT_DOT = { r: 2.4, fill: '#f59e0b', stroke: '#78350f', strokeWidth: 0.6 } as const
const POINT_LABEL = { fontSize: 7, fontWeight: 700, fill: '#f59e0b', stroke: '#000', strokeWidth: 2, paintOrder: 'stroke' } as const

const CANVAS_SIZE = { width: 300, height: 400 }

function PointMarkers({ points }: { points: HeadPoint[] }) {
  return (
    <>
      {points.map((p) => (
        <g key={p.id}>
          <circle cx={p.x} cy={p.y} {...POINT_DOT} />
          <text x={p.x + (p.dx ?? 0)} y={p.y + (p.dy ?? -6)} textAnchor="middle" {...POINT_LABEL}>
            {p.label}
          </text>
        </g>
      ))}
    </>
  )
}

/** renders the user-drawn/edited hairline as straight segments through its points —
 * dense freehand points read as a smooth line, sparse manual points read as crisp corners */
function Hairline({ points }: { points: Point[] }) {
  if (points.length < 2) return null
  const d = `M${points[0].x},${points[0].y} ${points
    .slice(1)
    .map((p) => `L${p.x},${p.y}`)
    .join(' ')}`
  return <path d={d} {...HAIRLINE} />
}

/** photo fills the canvas width and is vertically centered, matching how the
 * <image> below is placed with preserveAspectRatio="xMidYMid meet" — every
 * default point below was measured against that same placement */
function Photo({ href }: { href: string }) {
  return (
    <image
      href={href}
      x={0}
      y={0}
      width={CANVAS_SIZE.width}
      height={CANVAS_SIZE.height}
      preserveAspectRatio="xMidYMid meet"
    />
  )
}

const FRONT_DEFAULT_LAYOUT: TemplateLayout = {
  points: [
    { id: 'cp', label: 'C.P', x: 139, y: 103, dy: -6 },
    { id: 'sp-l', label: 'S.P', x: 90, y: 128, dx: -11 },
    { id: 'sp-r', label: 'S.P', x: 188, y: 128, dx: 11 },
    { id: 'ep-l', label: 'E.P', x: 63, y: 208, dx: -11 },
    { id: 'ep-r', label: 'E.P', x: 225, y: 208, dx: 11 },
  ],
  hairline: [
    { x: 72, y: 142 },
    { x: 90, y: 128 },
    { x: 108, y: 112 },
    { x: 123, y: 107 },
    { x: 139, y: 103 },
    { x: 154, y: 107 },
    { x: 170, y: 112 },
    { x: 188, y: 128 },
    { x: 206, y: 142 },
  ],
}

/** 앞모습: front_view.png 사진을 그대로 기본 템플릿으로 사용, 헤어라인/기준점은 사진 위 오버레이 */
function HeadFrontGuide({ layout = FRONT_DEFAULT_LAYOUT }: { layout?: TemplateLayout } = {}) {
  return (
    <g>
      <Photo href={frontPhoto} />
      {/* 중심 가이드 */}
      <path d="M146,0 L146,400" {...GUIDE_LINE} />
      <Hairline points={layout.hairline} />
      <PointMarkers points={layout.points} />
    </g>
  )
}

const SIDE_DEFAULT_LAYOUT: TemplateLayout = {
  points: [
    { id: 'cp', label: 'C.P', x: 118, y: 183, dx: -12, dy: -3 },
    { id: 'sp', label: 'S.P', x: 147, y: 151, dy: -7 },
    { id: 'tp', label: 'T.P', x: 186, y: 91, dy: -7 },
    { id: 'gp', label: 'G.P', x: 235, y: 144, dx: 11, dy: -4 },
    { id: 'bp', label: 'B.P', x: 255, y: 202, dx: 12 },
    { id: 'ep', label: 'E.P', x: 233, y: 247, dx: 13 },
    { id: 'np', label: 'N.P', x: 230, y: 320, dx: 13 },
  ],
  hairline: [
    { x: 118, y: 183 },
    { x: 132, y: 166 },
    { x: 147, y: 151 },
    { x: 162, y: 136 },
  ],
}

/** 옆모습(프로필): side_view.png 사진을 그대로 기본 템플릿으로 사용 */
function HeadSideGuide({ layout = SIDE_DEFAULT_LAYOUT }: { layout?: TemplateLayout } = {}) {
  return (
    <g>
      <Photo href={sidePhoto} />
      <Hairline points={layout.hairline} />
      <PointMarkers points={layout.points} />
    </g>
  )
}

const BACK_DEFAULT_LAYOUT: TemplateLayout = {
  points: [
    { id: 'tp', label: 'T.P', x: 154, y: 85, dy: -6 },
    { id: 'gp', label: 'G.P', x: 154, y: 144, dx: 13 },
    { id: 'bp', label: 'B.P', x: 154, y: 194, dx: 13 },
    { id: 'np', label: 'N.P', x: 154, y: 279, dy: 12 },
    { id: 'ep-l', label: 'E.P', x: 88, y: 221, dx: -11 },
    { id: 'ep-r', label: 'E.P', x: 220, y: 221, dx: 11 },
  ],
  hairline: [
    { x: 133, y: 278 },
    { x: 144, y: 281 },
    { x: 154, y: 282 },
    { x: 164, y: 281 },
    { x: 175, y: 278 },
  ],
}

/** 뒷모습: back_view.png 사진을 그대로 기본 템플릿으로 사용 */
function HeadBackGuide({ layout = BACK_DEFAULT_LAYOUT }: { layout?: TemplateLayout } = {}) {
  return (
    <g>
      <Photo href={backPhoto} />
      {/* 중심(파팅) 가이드 */}
      <path d="M154,0 L154,400" {...GUIDE_LINE} />
      <Hairline points={layout.hairline} />
      <PointMarkers points={layout.points} />
    </g>
  )
}

const TOP_DEFAULT_LAYOUT: TemplateLayout = {
  points: [
    { id: 'cp', label: 'C.P', x: 153, y: 288, dy: 11 },
    { id: 'tp', label: 'T.P', x: 153, y: 177, dx: 14 },
    { id: 'gp', label: 'G.P', x: 153, y: 134, dx: 14 },
    { id: 'bp', label: 'B.P', x: 153, y: 89, dy: -6 },
    { id: 'ep-l', label: 'E.P', x: 60, y: 188, dx: -11 },
    { id: 'ep-r', label: 'E.P', x: 245, y: 188, dx: 11 },
  ],
  hairline: [],
}

/** 위(탑)뷰: top_view.png 사진을 그대로 기본 템플릿으로 사용 */
function HeadTopGuide({ layout = TOP_DEFAULT_LAYOUT }: { layout?: TemplateLayout } = {}) {
  return (
    <g>
      <Photo href={topPhoto} />
      <path d="M153,0 L153,400" {...GUIDE_LINE} />
      <path d="M60,188 L245,188" {...GUIDE_LINE} />
      <Hairline points={layout.hairline} />
      <PointMarkers points={layout.points} />
    </g>
  )
}

export const HEAD_TEMPLATES: HeadTemplate[] = [
  { id: 'front', name: '앞모습', viewBox: CANVAS_SIZE, photo: frontPhoto, defaultLayout: FRONT_DEFAULT_LAYOUT, Guide: HeadFrontGuide },
  { id: 'side', name: '옆모습', viewBox: CANVAS_SIZE, photo: sidePhoto, defaultLayout: SIDE_DEFAULT_LAYOUT, Guide: HeadSideGuide },
  { id: 'back', name: '뒷모습', viewBox: CANVAS_SIZE, photo: backPhoto, defaultLayout: BACK_DEFAULT_LAYOUT, Guide: HeadBackGuide },
  { id: 'top', name: '탑(위)뷰', viewBox: CANVAS_SIZE, photo: topPhoto, defaultLayout: TOP_DEFAULT_LAYOUT, Guide: HeadTopGuide },
]

export function getTemplate(id: string): HeadTemplate {
  return HEAD_TEMPLATES.find((t) => t.id === id) ?? HEAD_TEMPLATES[0]
}
