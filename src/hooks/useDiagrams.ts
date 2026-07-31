import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db, type Diagram, type DiagramGroup, type GroupMedia } from '../db'
import type { TemplateCategory } from '../templates/headTemplates'

export type CategoryFilter = TemplateCategory | 'all'

export function useDiagrams(category: CategoryFilter) {
  const [diagrams, setDiagrams] = useState<Diagram[]>([])

  useEffect(() => {
    const subscription = liveQuery(() =>
      category === 'all'
        ? db.diagrams.orderBy('order').toArray()
        : db.diagrams.where('category').equals(category).sortBy('order')
    ).subscribe({
      next: setDiagrams,
      error: (err) => console.error('저장된 도해도를 불러오지 못했습니다', err),
    })
    return () => subscription.unsubscribe()
  }, [category])

  return diagrams
}

export function useGroups() {
  const [groups, setGroups] = useState<DiagramGroup[]>([])

  useEffect(() => {
    const subscription = liveQuery(() => db.groups.orderBy('createdAt').toArray()).subscribe({
      next: setGroups,
      error: (err) => console.error('그룹을 불러오지 못했습니다', err),
    })
    return () => subscription.unsubscribe()
  }, [])

  return groups
}

export function useGroupMedia(groupId: string | null) {
  const [media, setMedia] = useState<GroupMedia[]>([])

  useEffect(() => {
    if (!groupId) {
      setMedia([])
      return
    }
    const subscription = liveQuery(() =>
      db.media.where('groupId').equals(groupId).sortBy('createdAt')
    ).subscribe({
      next: (rows) => setMedia(rows.reverse()),
      error: (err) => console.error('사진/동영상을 불러오지 못했습니다', err),
    })
    return () => subscription.unsubscribe()
  }, [groupId])

  return media
}
