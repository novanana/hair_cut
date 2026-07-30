import { useState } from 'react'
import { DrawingCanvas, type Stroke, type Tool } from '../components/DrawingCanvas'
import { Toolbar } from '../components/Toolbar'
import { getTemplate } from '../templates/headTemplates'

interface EditorScreenProps {
  templateId: string
  onBack: () => void
}

export function EditorScreen({ templateId, onBack }: EditorScreenProps) {
  const template = getTemplate(templateId)

  const [title, setTitle] = useState('')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [redoStack, setRedoStack] = useState<Stroke[]>([])
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#f4f4f5')
  const [lineWidth, setLineWidth] = useState(4)
  const [showMemo, setShowMemo] = useState(false)
  const [memo, setMemo] = useState('')

  const handleStrokeComplete = (stroke: Stroke) => {
    setStrokes((prev) => [...prev, stroke])
    setRedoStack([])
  }

  const handleUndo = () => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev
      setRedoStack((r) => [...r, prev[prev.length - 1]])
      return prev.slice(0, -1)
    })
  }

  const handleRedo = () => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev
      setStrokes((s) => [...s, prev[prev.length - 1]])
      return prev.slice(0, -1)
    })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-800 px-3 py-3">
        <button onClick={onBack} aria-label="뒤로" className="text-xl">
          ←
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`${template.name} 도해도`}
          className="flex-1 bg-transparent text-base font-medium outline-none placeholder:text-zinc-500"
        />
        <button
          onClick={() => setShowMemo((v) => !v)}
          aria-label="메모"
          className={`flex h-9 w-9 items-center justify-center rounded-full text-base ${
            showMemo ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-200'
          }`}
        >
          📝
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden bg-zinc-950">
        <div className="relative mx-auto aspect-[3/4] h-full max-h-full">
          <svg
            viewBox={`0 0 ${template.viewBox.width} ${template.viewBox.height}`}
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <template.Guide />
          </svg>
          <DrawingCanvas
            viewBoxWidth={template.viewBox.width}
            viewBoxHeight={template.viewBox.height}
            strokes={strokes}
            tool={tool}
            color={color}
            lineWidth={lineWidth}
            onStrokeComplete={handleStrokeComplete}
          />
        </div>

        {showMemo && (
          <div className="absolute inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-900/95 p-3 backdrop-blur">
            <textarea
              autoFocus
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="수업 중 메모를 남겨보세요 (예: 45도 시술, 크리에이티브 포인트 확인)"
              rows={3}
              className="w-full resize-none rounded-lg bg-zinc-800 p-2 text-sm outline-none placeholder:text-zinc-500"
            />
          </div>
        )}
      </div>

      <p className="bg-zinc-950 px-3 pt-1 text-center text-xs text-zinc-600">
        자동저장은 다음 단계에서 연결됩니다 · 지금은 새로고침 시 초기화돼요
      </p>

      <Toolbar
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        lineWidth={lineWidth}
        onLineWidthChange={setLineWidth}
        canUndo={strokes.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
    </div>
  )
}
