import { HEAD_TEMPLATES } from '../templates/headTemplates'

interface TemplateSelectScreenProps {
  onBack: () => void
  onSelect: (templateId: string) => void
}

export function TemplateSelectScreen({ onBack, onSelect }: TemplateSelectScreenProps) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-4">
        <button onClick={onBack} aria-label="뒤로" className="text-xl">
          ←
        </button>
        <h1 className="text-lg font-semibold">템플릿 선택</h1>
      </header>

      <div className="grid flex-1 grid-cols-2 gap-4 overflow-y-auto p-4">
        {HEAD_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template.id)}
            className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 active:bg-zinc-800"
          >
            <svg
              viewBox={`0 0 ${template.viewBox.width} ${template.viewBox.height}`}
              className="aspect-[3/4] w-full"
            >
              <template.Guide />
            </svg>
            <span className="text-sm text-zinc-200">{template.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
