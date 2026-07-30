import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db } from '../db'
import type { TemplateLayout } from '../templates/headTemplates'

/** the saved layout override for a template, or undefined until loaded / if none saved */
export function useTemplateOverride(templateId: string): TemplateLayout | undefined {
  const [layout, setLayout] = useState<TemplateLayout | undefined>(undefined)

  useEffect(() => {
    setLayout(undefined)
    const subscription = liveQuery(() => db.templateOverrides.get(templateId)).subscribe({
      next: (row) => setLayout(row?.layout),
      error: (err) => console.error('템플릿 설정을 불러오지 못했습니다', err),
    })
    return () => subscription.unsubscribe()
  }, [templateId])

  return layout
}
