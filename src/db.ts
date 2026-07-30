import Dexie, { type EntityTable } from 'dexie'
import type { Stroke } from './components/DrawingCanvas'
import type { TemplateCategory } from './templates/headTemplates'

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

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  cut: '커트',
  perm: '펌',
  color: '컬러',
  updo: '업스타일',
  etc: '기타',
}

class HairDiagramDB extends Dexie {
  diagrams!: EntityTable<Diagram, 'id'>

  constructor() {
    super('hair-diagram-notes')
    this.version(1).stores({
      diagrams: 'id, category, updatedAt',
    })
  }
}

export const db = new HairDiagramDB()
