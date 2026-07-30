import Dexie, { type EntityTable } from 'dexie'
import type { Stroke } from './components/DrawingCanvas'
import type { TemplateCategory, TemplateLayout } from './templates/headTemplates'

export interface Diagram {
  id: string
  title: string
  category: TemplateCategory
  templateId: string
  strokes: Stroke[]
  memo: string
  thumbnail?: string
  createdAt: number
  updatedAt: number
}

/** a user's saved customization (ear position / hairline / head points) for one template */
export interface TemplateOverride {
  templateId: string
  layout: TemplateLayout
  updatedAt: number
}

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  cut: '커트',
  perm: '펌',
  color: '컬러',
  updo: '업스타일',
  etc: '기타',
}

class HairDiagramDB extends Dexie {
  diagrams!: EntityTable<Diagram, 'id'>
  templateOverrides!: EntityTable<TemplateOverride, 'templateId'>

  constructor() {
    super('hair-diagram-notes')
    this.version(1).stores({
      diagrams: 'id, category, updatedAt',
    })
    this.version(2).stores({
      diagrams: 'id, category, updatedAt',
      templateOverrides: 'templateId',
    })
  }
}

export const db = new HairDiagramDB()
