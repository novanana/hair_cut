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
  groupId?: string
  createdAt: number
  updatedAt: number
  /** manual sort position for the home screen list — smaller sorts first */
  order: number
}

/** a user's saved customization (ear position / hairline / head points) for one template */
export interface TemplateOverride {
  templateId: string
  layout: TemplateLayout
  updatedAt: number
}

export interface DiagramGroup {
  id: string
  name: string
  createdAt: number
}

/** a photo or video the user attached to a folder — e.g. a shot taken during the lesson */
export interface GroupMedia {
  id: string
  groupId: string
  type: 'image' | 'video'
  blob: Blob
  name: string
  createdAt: number
  /** manual sort position within the folder's media strip — smaller sorts first (left) */
  order: number
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
  groups!: EntityTable<DiagramGroup, 'id'>
  media!: EntityTable<GroupMedia, 'id'>

  constructor() {
    super('hair-diagram-notes')
    this.version(1).stores({
      diagrams: 'id, category, updatedAt',
    })
    this.version(2).stores({
      diagrams: 'id, category, updatedAt',
      templateOverrides: 'templateId',
    })
    this.version(3)
      .stores({
        diagrams: 'id, category, updatedAt, order',
        templateOverrides: 'templateId',
      })
      .upgrade(async (tx) => {
        // backfill `order` for diagrams saved before manual reordering existed,
        // preserving their existing newest-first order so the list doesn't reshuffle
        const rows = await tx.table('diagrams').orderBy('updatedAt').reverse().toArray()
        await Promise.all(rows.map((row, i) => tx.table('diagrams').update(row.id, { order: i })))
      })
    this.version(4).stores({
      diagrams: 'id, category, updatedAt, order, groupId',
      templateOverrides: 'templateId',
      groups: 'id, createdAt',
    })
    this.version(5).stores({
      diagrams: 'id, category, updatedAt, order, groupId',
      templateOverrides: 'templateId',
      groups: 'id, createdAt',
      media: 'id, groupId, createdAt',
    })
    this.version(6)
      .stores({
        diagrams: 'id, category, updatedAt, order, groupId',
        templateOverrides: 'templateId',
        groups: 'id, createdAt',
        media: 'id, groupId, createdAt, order',
      })
      .upgrade(async (tx) => {
        // backfill `name` and `order` for media saved before either existed,
        // preserving upload order left-to-right
        const rows = await tx.table('media').orderBy('createdAt').toArray()
        await Promise.all(rows.map((row, i) => tx.table('media').update(row.id, { name: '', order: i })))
      })
  }
}

export const db = new HairDiagramDB()
