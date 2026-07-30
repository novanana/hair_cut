import { useState } from 'react'
import { CATEGORY_LABELS, db, type Diagram } from '../db'
import { useDiagrams, type CategoryFilter } from '../hooks/useDiagrams'
import { getTemplate } from '../templates/headTemplates'

interface HomeScreenProps {
  onCreateNew: () => void
  onOpenDiagram: (diagram: Diagram) => void
}

const FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  ...(Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
  })),
]

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

export function HomeScreen({ onCreateNew, onOpenDiagram }: HomeScreenProps) {
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const diagrams = useDiagrams(filter)

  const handleDelete = (e: React.MouseEvent, diagram: Diagram) => {
    e.stopPropagation()
    if (!window.confirm(`"${diagram.title || getTemplate(diagram.templateId).name + ' 도해도'}"를 삭제할까요?`)) return
    void db.diagrams.delete(diagram.id)
  }

  return (
    <div className="relative flex h-full flex-col">
      <header className="border-b border-zinc-800 px-4 py-4">
        <h1 className="text-lg font-semibold">헤어 도해도 노트</h1>
      </header>

      <div className="flex gap-1.5 overflow-x-auto border-b border-zinc-800 px-4 py-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              filter === f.value ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {diagrams.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-zinc-400">
          <p className="text-4xl">✂️</p>
          <p>{filter === 'all' ? '아직 저장된 도해도가 없어요.' : '이 카테고리에는 저장된 도해도가 없어요.'}</p>
          <p className="text-sm text-zinc-500">우측 하단 버튼으로 첫 도해도를 만들어보세요.</p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 content-start gap-4 overflow-y-auto p-4">
          {diagrams.map((diagram) => {
            const template = getTemplate(diagram.templateId)
            return (
              <div
                key={diagram.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenDiagram(diagram)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onOpenDiagram(diagram)
                }}
                className="relative flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left active:bg-zinc-800"
              >
                <span className="absolute right-2 top-2 z-10 rounded-full bg-zinc-950/80 px-2 py-0.5 text-[10px] text-zinc-300">
                  {CATEGORY_LABELS[diagram.category]}
                </span>
                <button
                  onClick={(e) => handleDelete(e, diagram)}
                  aria-label="삭제"
                  className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950/80 text-xs text-zinc-300"
                >
                  🗑
                </button>
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-zinc-950">
                  <svg
                    viewBox={`0 0 ${template.viewBox.width} ${template.viewBox.height}`}
                    className="absolute inset-0 h-full w-full"
                  >
                    <template.Guide />
                  </svg>
                  {diagram.thumbnail && (
                    <img src={diagram.thumbnail} alt="" className="absolute inset-0 h-full w-full" />
                  )}
                </div>
                <span className="w-full truncate text-sm text-zinc-200">
                  {diagram.title || `${template.name} 도해도`}
                </span>
                <span className="w-full text-xs text-zinc-500">{formatDate(diagram.updatedAt)}</span>
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={onCreateNew}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl text-zinc-900 shadow-lg"
        aria-label="새로 만들기"
      >
        +
      </button>
    </div>
  )
}
