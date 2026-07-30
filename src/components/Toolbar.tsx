import type { Tool } from './DrawingCanvas'

const COLORS = [
  { value: '#f4f4f5', label: '기본선' },
  { value: '#ef4444', label: '커트선' },
  { value: '#3b82f6', label: '가이드' },
  { value: '#22c55e', label: '보조' },
]

const WIDTHS = [
  { value: 2, label: '얇게' },
  { value: 4, label: '보통' },
  { value: 7, label: '굵게' },
]

interface ToolbarProps {
  tool: Tool
  onToolChange: (tool: Tool) => void
  color: string
  onColorChange: (color: string) => void
  lineWidth: number
  onLineWidthChange: (width: number) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

export function Toolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  lineWidth,
  onLineWidthChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-2 border-t border-zinc-800 bg-zinc-900 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.value}
              aria-label={c.label}
              onClick={() => {
                onColorChange(c.value)
                onToolChange('pen')
              }}
              className="h-9 w-9 shrink-0 rounded-full ring-offset-2 ring-offset-zinc-900"
              style={{
                backgroundColor: c.value,
                boxShadow: tool === 'pen' && color === c.value ? `0 0 0 2px #fff` : 'none',
              }}
            />
          ))}
          <button
            aria-label="지우개"
            onClick={() => onToolChange('eraser')}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${
              tool === 'eraser' ? 'bg-white text-zinc-900' : 'bg-zinc-700 text-zinc-200'
            }`}
          >
            🧹
          </button>
        </div>

        <div className="flex gap-1.5">
          <button
            aria-label="실행취소"
            disabled={!canUndo}
            onClick={onUndo}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-lg text-zinc-100 disabled:opacity-30"
          >
            ↶
          </button>
          <button
            aria-label="다시실행"
            disabled={!canRedo}
            onClick={onRedo}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-lg text-zinc-100 disabled:opacity-30"
          >
            ↷
          </button>
        </div>
      </div>

      <div className="flex gap-1.5">
        {WIDTHS.map((w) => (
          <button
            key={w.value}
            onClick={() => onLineWidthChange(w.value)}
            className={`flex h-9 flex-1 items-center justify-center rounded-lg text-sm ${
              lineWidth === w.value ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>
    </div>
  )
}
