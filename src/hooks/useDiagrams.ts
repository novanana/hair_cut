import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db, type Diagram } from '../db'
import type { TemplateCategory } from '../templates/headTemplates'

export type CategoryFilter = TemplateCategory | 'all'

export function useDiagrams(category: CategoryFilter) {
  const [diagrams, setDiagrams] = useState<Diagram[]>([])

  useEffect(() => {
    const subscription = liveQuery(() =>
      category === 'all'
        ? db.diagrams.orderBy('updatedAt').reverse().toArray()
        : db.diagrams
            .where('category')
            .equals(category)
            .sortBy('updatedAt')
            .then((rows) => rows.reverse())
    ).subscribe({
      next: setDiagrams,
      error: (err) => console.error('저장된 도해도를 불러오지 못했습니다', err),
    })
    return () => subscription.unsubscribe()
  }, [category])

  return diagrams
}
