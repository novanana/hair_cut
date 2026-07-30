import type { JSX } from 'react'

export type TemplateCategory = 'cut' | 'perm' | 'color' | 'updo' | 'etc'

export interface HeadTemplate {
  id: string
  name: string
  /** shared canvas size every template renders into, so the drawing layer aligns 1:1 */
  viewBox: { width: number; height: number }
  Guide: () => JSX.Element
}

const OUTLINE = { stroke: '#71717a', strokeWidth: 1.75, fill: '#27272a' } as const
const FEATURE = { stroke: '#a1a1aa', strokeWidth: 1, fill: 'none' } as const
const HAIRLINE = { stroke: '#94a3b8', strokeWidth: 1.1, fill: 'none' } as const
const GUIDE_LINE = { stroke: '#52525b', strokeWidth: 1, fill: 'none', strokeDasharray: '4 4' } as const

/** 미용 도해도 기준점(E.P·S.P·C.P·T.P·G.P·B.P·N.P)을 작은 점 + 라벨로 표시 */
const POINT_DOT = { r: 2, fill: '#f59e0b', stroke: '#78350f', strokeWidth: 0.6 } as const
const POINT_LABEL = { fontSize: 6.5, fontWeight: 700, fill: '#f59e0b' } as const

const CANVAS_SIZE = { width: 300, height: 400 }

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
          <text x={p.x + (p.dx ?? 0)} y={p.y + (p.dy ?? -5)} textAnchor="middle" {...POINT_LABEL}>
            {p.label}
          </text>
        </g>
      ))}
    </>
  )
}

/** 앞모습: 이마 헤어라인(C.P·S.P)과 귀(E.P)가 기준점이 되는 정면 실루엣 */
function HeadFrontGuide() {
  const points: HeadPoint[] = [
    { id: 'cp', label: 'C.P', x: 150, y: 90, dy: -6 },
    { id: 'sp-l', label: 'S.P', x: 100, y: 118, dx: -11 },
    { id: 'sp-r', label: 'S.P', x: 200, y: 118, dx: 11 },
    { id: 'ep-l', label: 'E.P', x: 79, y: 196, dx: -11 },
    { id: 'ep-r', label: 'E.P', x: 221, y: 196, dx: 11 },
  ]
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {/* 목/어깨 (얼굴 뒤에 깔려 턱선과 자연스럽게 이어짐) */}
      <path
        d="M120,266 L120,320 C120,340 90,346 60,362 L60,400 L240,400 L240,362
           C210,346 180,340 180,320 L180,266 Z"
        {...OUTLINE}
      />
      {/* 얼굴 윤곽 */}
      <path
        d="M150,66
           C200,66 226,102 225,140
           C224,172 218,204 205,228
           C197,246 186,262 172,274
           C164,282 158,288 150,292
           C142,288 136,282 128,274
           C114,262 103,246 95,228
           C82,204 76,172 75,140
           C74,102 100,66 150,66 Z"
        {...OUTLINE}
      />
      {/* 귀 */}
      <path d="M76,178 C70,182 67,192 70,203 C72,211 78,215 84,211 C81,200 80,189 82,180 C80,178 78,177 76,178 Z" {...OUTLINE} />
      <path d="M224,178 C230,182 233,192 230,203 C228,211 222,215 216,211 C219,200 220,189 218,180 C220,178 222,177 224,178 Z" {...OUTLINE} />

      {/* 헤어라인 */}
      <path d="M100,118 Q150,90 200,118" {...HAIRLINE} />
      {/* 중심 가이드 */}
      <path d="M150,66 L150,400" {...GUIDE_LINE} />

      {/* 눈썹 */}
      <path d="M108,168 Q120,159 135,167" {...FEATURE} />
      <path d="M165,167 Q180,159 192,168" {...FEATURE} />
      {/* 눈 */}
      <path d="M107,180 Q120,172 133,180 Q120,188 107,180" {...FEATURE} />
      <path d="M167,180 Q180,172 193,180 Q180,188 167,180" {...FEATURE} />
      <circle cx={120} cy={180} r={1.6} fill="#a1a1aa" />
      <circle cx={180} cy={180} r={1.6} fill="#a1a1aa" />
      {/* 코 */}
      <path d="M150,182 C148,194 146,204 143,212 Q150,219 157,212 C154,204 152,194 150,182" {...FEATURE} />
      <path d="M144,213 Q150,217 156,213" {...FEATURE} />
      {/* 입술 */}
      <path d="M130,243 Q150,239 170,243" {...FEATURE} />
      <path d="M132,247 Q150,251 168,247" {...FEATURE} />

      <PointMarkers points={points} />
    </g>
  )
}

/** 옆모습(프로필): point.JPG의 E.P·S.P·C.P·T.P·G.P·B.P·N.P 7개 기준점을 모두 표시 */
function HeadSideGuide() {
  const points: HeadPoint[] = [
    { id: 'cp', label: 'C.P', x: 108, y: 92, dx: -12, dy: -3 },
    { id: 'sp', label: 'S.P', x: 130, y: 74, dy: -7 },
    { id: 'tp', label: 'T.P', x: 178, y: 58, dy: -7 },
    { id: 'gp', label: 'G.P', x: 222, y: 100, dx: 11, dy: -4 },
    { id: 'bp', label: 'B.P', x: 238, y: 148, dx: 12 },
    { id: 'ep', label: 'E.P', x: 200, y: 187, dx: 13 },
    { id: 'np', label: 'N.P', x: 198, y: 235, dx: 13 },
  ]
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {/* 두상 + 목 실루엣 (이마 → 코 → 입 → 턱 → 목 → 뒷목 → 뒤통수 → 정수리) */}
      <path
        d="M178,58
           C155,56 138,62 130,74
           C122,80 112,84 108,92
           C102,102 100,112 97,120
           C90,130 75,145 62,160
           C58,165 58,168 60,170
           C66,172 74,173 79,174
           C80,177 81,180 81,182
           C82,185 82,187 82,188
           C83,190 83,192 84,195
           C86,202 88,208 90,214
           C100,222 112,228 122,233
           C128,238 134,244 138,252
           L138,300
           L192,300
           C192,285 194,260 198,235
           C202,218 206,205 212,195
           C222,178 232,165 238,148
           C242,132 238,112 232,100
           C224,82 210,66 178,58 Z"
        {...OUTLINE}
      />
      {/* 귀 */}
      <path
        d="M192,168 C205,163 216,170 216,185 C216,200 206,210 195,208
           C188,206 186,196 188,185 C189,176 190,171 192,168 Z"
        {...OUTLINE}
      />
      <path d="M198,176 C204,175 208,181 206,189 C204,196 198,198 196,193" {...FEATURE} />

      {/* 눈썹 + 눈 */}
      <path d="M95,121 Q107,115 118,120" {...FEATURE} />
      <path d="M101,129 Q112,126 119,131" {...FEATURE} />
      <circle cx={110} cy={130} r={1.4} fill="#a1a1aa" />
      {/* 콧구멍 */}
      <path d="M70,171 Q75,175 79,173" {...FEATURE} />
      {/* 입술 라인 */}
      <path d="M81,183 Q84,185 82,188" {...FEATURE} />

      {/* 이마 헤어라인 (C.P → S.P 구간만 표시해 두상 윤곽과 겹치지 않게 함) */}
      <path d="M104,96 Q118,82 132,76" {...HAIRLINE} />

      <PointMarkers points={points} />
    </g>
  )
}

/** 뒷모습: 정중선(파팅 가이드)과 좌우 귀, 뒷목 E.P·B.P·N.P 기준 */
function HeadBackGuide() {
  const points: HeadPoint[] = [
    { id: 'tp', label: 'T.P', x: 150, y: 60, dy: -6 },
    { id: 'gp', label: 'G.P', x: 150, y: 105, dx: 13 },
    { id: 'bp', label: 'B.P', x: 150, y: 150, dx: 13 },
    { id: 'np', label: 'N.P', x: 150, y: 225, dy: 12 },
    { id: 'ep-l', label: 'E.P', x: 78, y: 175, dx: -11 },
    { id: 'ep-r', label: 'E.P', x: 222, y: 175, dx: 11 },
  ]
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {/* 두상 + 목 실루엣 */}
      <path
        d="M150,60
           C195,60 222,90 226,135
           C229,168 220,195 205,215
           C198,224 195,232 194,240
           L194,300 L106,300 L106,240
           C105,232 102,224 95,215
           C80,195 71,168 74,135
           C78,90 105,60 150,60 Z"
        {...OUTLINE}
      />
      {/* 귀 */}
      <path d="M74,155 C64,152 57,162 59,178 C61,194 71,202 81,198 C85,188 83,170 79,160 C77,157 76,155 74,155 Z" {...OUTLINE} />
      <path d="M226,155 C236,152 243,162 241,178 C239,194 229,202 219,198 C215,188 217,170 221,160 C223,157 224,155 226,155 Z" {...OUTLINE} />

      {/* 정수리 가마 힌트 + 목덜미 헤어라인 */}
      <path d="M118,98 Q150,84 182,98" {...HAIRLINE} />
      <path d="M122,222 Q150,233 178,222" {...HAIRLINE} />
      {/* 중심(파팅) 가이드 */}
      <path d="M150,60 L150,300" {...GUIDE_LINE} />

      <PointMarkers points={points} />
    </g>
  )
}

/** 위(탑)뷰: 정수리에서 내려다본 형태, 앞쪽(코 돌출)과 좌우 귀 위치가 기준 */
function HeadTopGuide() {
  const points: HeadPoint[] = [
    { id: 'cp', label: 'C.P', x: 150, y: 318, dy: 11 },
    { id: 'tp', label: 'T.P', x: 150, y: 192, dx: 14 },
    { id: 'gp', label: 'G.P', x: 150, y: 140, dx: 14 },
    { id: 'bp', label: 'B.P', x: 150, y: 92, dy: -6 },
    { id: 'ep-l', label: 'E.P', x: 60, y: 180, dx: -11 },
    { id: 'ep-r', label: 'E.P', x: 240, y: 180, dx: 11 },
  ]
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M150,86
           C202,86 238,122 238,172
           C238,214 220,250 196,278
           C178,300 164,312 150,314
           C136,312 122,300 104,278
           C80,250 62,214 62,172
           C62,122 98,86 150,86 Z"
        {...OUTLINE}
      />
      {/* 코 돌출부 */}
      <path d="M141,305 Q150,320 159,305 Q150,311 141,305 Z" {...OUTLINE} />
      {/* 귀 */}
      <ellipse cx={57} cy={180} rx={8} ry={14} {...OUTLINE} />
      <ellipse cx={243} cy={180} rx={8} ry={14} {...OUTLINE} />

      <path d="M150,86 L150,320" {...GUIDE_LINE} />
      <path d="M62,180 L238,180" {...GUIDE_LINE} />
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
