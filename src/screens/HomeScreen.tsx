import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_LABELS, db, type Diagram } from '../db'
import { useDiagrams, useGroups, type CategoryFilter } from '../hooks/useDiagrams'
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

// how long a press has to hold before it can turn into a reorder drag, and
// how far the pointer then has to move to actually start dragging — a plain
// tap (or a scroll that starts on a card) shouldn't get mistaken for one
const LONG_PRESS_MS = 450
const DRAG_START_THRESHOLD = 6

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

async function createGroup(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return undefined
  const id = crypto.randomUUID()
  await db.groups.add({ id, name: trimmed, createdAt: Date.now() })
  return id
}

export function HomeScreen({ onCreateNew, onOpenDiagram }: HomeScreenProps) {
  const [filter, setFilter] = useState<CategoryFilter>('all')
  // null = the root screen (folders + ungrouped cards); a group id = browsing inside that folder
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const diagrams = useDiagrams(filter)
  const groups = useGroups()
  const [assigningDiagram, setAssigningDiagram] = useState<Diagram | null>(null)
  const [newGroupName, setNewGroupName] = useState('')

  const currentGroup = openGroupId ? groups.find((g) => g.id === openGroupId) : undefined

  // cards shown in the main grid: ungrouped cards at the root, or the open
  // folder's cards once inside one — grouped cards otherwise live inside
  // their folder tile and don't clutter the root list
  const visibleDiagrams = useMemo(
    () => diagrams.filter((d) => (openGroupId === null ? !d.groupId : d.groupId === openGroupId)),
    [diagrams, openGroupId],
  )

  // local copy that can be live-reordered while dragging without waiting on
  // the IndexedDB round-trip; resynced from the live query whenever a drag
  // isn't in progress (so external changes — new saves, deletes — still show)
  const [localDiagrams, setLocalDiagrams] = useState<Diagram[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [ghostRect, setGhostRect] = useState<{ left: number; top: number; width: number; height: number } | null>(
    null,
  )

  const gridRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const localDiagramsRef = useRef<Diagram[]>([])
  const pressStartRef = useRef<{ x: number; y: number } | null>(null)
  const grabOffsetRef = useRef({ x: 0, y: 0 })
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const longPressReadyRef = useRef(false)
  const didDragRef = useRef(false)
  const dragIndexRef = useRef<number | null>(null)
  const cleanupDragRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    localDiagramsRef.current = localDiagrams
  }, [localDiagrams])

  useEffect(() => {
    if (dragIndex === null) setLocalDiagrams(visibleDiagrams)
  }, [visibleDiagrams, dragIndex])

  // release any window listeners left over if the component unmounts mid-drag
  useEffect(() => () => cleanupDragRef.current?.(), [])

  const handleDelete = (e: React.MouseEvent, diagram: Diagram) => {
    e.stopPropagation()
    if (!window.confirm(`"${diagram.title || getTemplate(diagram.templateId).name + ' 도해도'}"를 삭제할까요?`)) return
    void db.diagrams.delete(diagram.id)
  }

  const handleAddGroup = async () => {
    const name = window.prompt('새 그룹 이름을 입력하세요')
    if (name === null) return
    await createGroup(name)
  }

  const handleGroupContextMenu = async (e: React.MouseEvent, groupId: string, name: string) => {
    e.preventDefault()
    const input = window.prompt(
      `"${name}" 그룹\n\n새 이름을 입력해 이름을 바꾸거나, "삭제"를 입력해 그룹을 삭제하세요.`,
      name,
    )
    if (input === null) return
    const trimmed = input.trim()
    if (trimmed === '삭제') {
      if (!window.confirm(`"${name}" 그룹을 삭제할까요? 그룹에 속한 도해도는 그룹 없음 상태가 됩니다.`)) return
      await db.transaction('rw', db.groups, db.diagrams, async () => {
        await db.groups.delete(groupId)
        await db.diagrams.where('groupId').equals(groupId).modify({ groupId: undefined })
      })
      if (openGroupId === groupId) setOpenGroupId(null)
    } else if (trimmed && trimmed !== name) {
      await db.groups.update(groupId, { name: trimmed })
    }
  }

  const handleAssignGroup = async (groupId: string | undefined) => {
    if (!assigningDiagram) return
    await db.diagrams.update(assigningDiagram.id, { groupId })
    setAssigningDiagram(null)
  }

  const handleCreateAndAssignGroup = async () => {
    const id = await createGroup(newGroupName)
    setNewGroupName('')
    if (id) await handleAssignGroup(id)
  }

  const commitOrder = async (finalOrder: Diagram[]) => {
    // renumber the whole list, keeping diagrams outside the current filter in
    // their existing relative position and only reslotting the visible ones —
    // so dragging inside a category filter doesn't corrupt the global order
    const all = await db.diagrams.orderBy('order').toArray()
    const visibleIds = new Set(finalOrder.map((d) => d.id))
    let cursor = 0
    const merged = all.map((d) => (visibleIds.has(d.id) ? finalOrder[cursor++] : d))
    await Promise.all(merged.map((d, i) => db.diagrams.update(d.id, { order: i })))
  }

  const handleCardPointerDown = (index: number) => (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const pointerId = e.pointerId
    pressStartRef.current = { x: e.clientX, y: e.clientY }
    longPressReadyRef.current = false
    didDragRef.current = false

    const el = cardRefs.current.get(localDiagramsRef.current[index]?.id)
    const grabRect = el?.getBoundingClientRect()
    if (grabRect) {
      grabOffsetRef.current = { x: e.clientX - grabRect.left, y: e.clientY - grabRect.top }
    }

    longPressTimerRef.current = setTimeout(() => {
      longPressReadyRef.current = true
    }, LONG_PRESS_MS)

    // tracked at the window level (not on the card element) so the drag keeps
    // receiving move/up events no matter which element ends up under the
    // pointer as cards get reordered underneath it
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId || !pressStartRef.current) return
      const dx = ev.clientX - pressStartRef.current.x
      const dy = ev.clientY - pressStartRef.current.y
      const moved = Math.hypot(dx, dy) > DRAG_START_THRESHOLD

      if (dragIndexRef.current === null) {
        if (!longPressReadyRef.current) {
          if (moved) endDrag() // moved before the hold registered — a scroll, not a drag
          return
        }
        if (!moved) return
        // hold elapsed and the finger is now moving — start dragging
        didDragRef.current = true
        dragIndexRef.current = index
        setGhostRect({
          left: ev.clientX - grabOffsetRef.current.x,
          top: ev.clientY - grabOffsetRef.current.y,
          width: grabRect?.width ?? 0,
          height: grabRect?.height ?? 0,
        })
        setDragIndex(index)
        return
      }

      // already dragging — move the ghost with the finger and retarget to
      // whichever fixed grid cell the pointer is over. Cell geometry (not
      // other cards' current positions) drives this on purpose: comparing
      // against neighbors' centers creates a feedback loop — swapping moves
      // a different card under the pointer, which immediately looks closer
      // than the target and swaps right back, oscillating every move event.
      setGhostRect((r) =>
        r ? { ...r, left: ev.clientX - grabOffsetRef.current.x, top: ev.clientY - grabOffsetRef.current.y } : r,
      )

      const current = dragIndexRef.current
      const gridEl = gridRef.current
      if (gridEl && grabRect) {
        const containerRect = gridEl.getBoundingClientRect()
        const cols = 2
        const gap = 16 // matches the grid's gap-4
        const col = Math.min(cols - 1, Math.max(0, Math.floor((ev.clientX - containerRect.left) / (grabRect.width + gap))))
        const row = Math.max(0, Math.floor((ev.clientY - containerRect.top) / (grabRect.height + gap)))
        const targetIndex = Math.min(localDiagramsRef.current.length - 1, row * cols + col)
        if (targetIndex !== current) {
          dragIndexRef.current = targetIndex
          setLocalDiagrams((prev) => {
            const next = prev.slice()
            const [movedItem] = next.splice(current, 1)
            next.splice(targetIndex, 0, movedItem)
            return next
          })
          setDragIndex(targetIndex)
        }
      }
    }

    const endDrag = () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = undefined
      pressStartRef.current = null
      longPressReadyRef.current = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      cleanupDragRef.current = null
      if (dragIndexRef.current !== null) {
        dragIndexRef.current = null
        setDragIndex(null)
        setGhostRect(null)
        void commitOrder(localDiagramsRef.current)
      }
    }

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      endDrag()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    cleanupDragRef.current = endDrag
  }

  const handleCardClick = (diagram: Diagram) => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    onOpenDiagram(diagram)
  }

  const draggedDiagram = dragIndex !== null ? localDiagrams[dragIndex] : undefined

  const renderCard = (diagram: Diagram, index: number, isGhost: boolean) => {
    const template = getTemplate(diagram.templateId)
    const group = groups.find((g) => g.id === diagram.groupId)
    return (
      <div
        key={isGhost ? `${diagram.id}-ghost` : diagram.id}
        ref={isGhost ? undefined : (el) => void (el ? cardRefs.current.set(diagram.id, el) : cardRefs.current.delete(diagram.id))}
        role="button"
        tabIndex={0}
        onPointerDown={isGhost ? undefined : handleCardPointerDown(index)}
        onClick={() => handleCardClick(diagram)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenDiagram(diagram)
        }}
        style={
          isGhost && ghostRect
            ? {
                position: 'fixed',
                left: ghostRect.left,
                top: ghostRect.top,
                width: ghostRect.width,
                height: ghostRect.height,
                zIndex: 50,
              }
            : undefined
        }
        className={`relative flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left touch-none select-none ${
          isGhost ? 'shadow-2xl scale-105' : dragIndex === index ? 'opacity-0' : 'active:bg-zinc-800'
        }`}
      >
        <span className="absolute right-2 top-2 z-10 rounded-full bg-zinc-950/80 px-2 py-0.5 text-[10px] text-zinc-300">
          {CATEGORY_LABELS[diagram.category]}
        </span>
        <div className="absolute left-2 top-2 z-10 flex gap-1">
          <button
            onClick={(e) => handleDelete(e, diagram)}
            aria-label="삭제"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950/80 text-xs text-zinc-300"
          >
            🗑
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setAssigningDiagram(diagram)
            }}
            aria-label="그룹에 담기"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950/80 text-xs text-zinc-300"
          >
            📁
          </button>
        </div>
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-zinc-950">
          {diagram.thumbnail ? (
            // the saved thumbnail is a full snapshot of the editor at save time
            // (photo + strokes, at whatever pan/zoom was active) — no overlay needed.
            // draggable=false so the browser's native image drag doesn't hijack our
            // own long-press reorder gesture and swallow subsequent pointer events
            <img src={diagram.thumbnail} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
          ) : (
            // no thumbnail yet (e.g. still saving) — show the plain reference photo
            <img src={template.photo} alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain" />
          )}
        </div>
        <span className="w-full truncate text-sm text-zinc-200">{diagram.title || `${template.name} 도해도`}</span>
        <div className="flex w-full items-center justify-between gap-1">
          <span className="text-xs text-zinc-500">{formatDate(diagram.updatedAt)}</span>
          {group && <span className="truncate text-xs text-zinc-500">📁 {group.name}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-4">
        {currentGroup ? (
          <>
            <button onClick={() => setOpenGroupId(null)} aria-label="뒤로" className="text-xl">
              ←
            </button>
            <h1 className="flex-1 truncate text-lg font-semibold">📁 {currentGroup.name}</h1>
            <button
              onClick={(e) => handleGroupContextMenu(e, currentGroup.id, currentGroup.name)}
              aria-label="그룹 관리"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-300"
            >
              ⋯
            </button>
          </>
        ) : (
          <h1 className="text-lg font-semibold">헤어 도해도 노트</h1>
        )}
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

      <div className="flex flex-1 flex-col overflow-y-auto">
        {openGroupId === null && (
          <div className="grid grid-cols-2 gap-4 p-4 pb-0">
            {groups.map((g) => {
              const count = diagrams.filter((d) => d.groupId === g.id).length
              return (
                <button
                  key={g.id}
                  onClick={() => setOpenGroupId(g.id)}
                  onContextMenu={(e) => handleGroupContextMenu(e, g.id, g.name)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left active:bg-zinc-800"
                >
                  <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-zinc-950 text-4xl">
                    📁
                  </div>
                  <span className="w-full truncate text-sm text-zinc-200">{g.name}</span>
                  <span className="w-full text-xs text-zinc-500">{count}개</span>
                </button>
              )
            })}
            <button
              onClick={handleAddGroup}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-700 p-3 text-left text-zinc-500 active:bg-zinc-900"
            >
              <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-dashed border-zinc-700 text-3xl">
                +
              </div>
              <span className="w-full truncate text-sm">새 그룹</span>
            </button>
          </div>
        )}

        {localDiagrams.length === 0 ? (
          openGroupId === null && diagrams.length > 0 ? null : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-zinc-400">
              <p className="text-4xl">✂️</p>
              <p>
                {openGroupId
                  ? '이 그룹에는 저장된 도해도가 없어요.'
                  : filter === 'all'
                    ? '아직 저장된 도해도가 없어요.'
                    : '이 카테고리에는 저장된 도해도가 없어요.'}
              </p>
              <p className="text-sm text-zinc-500">우측 하단 버튼으로 새 도해도를 만들어보세요.</p>
            </div>
          )
        ) : (
          <div ref={gridRef} className="grid grid-cols-2 content-start gap-4 p-4">
            {localDiagrams.map((diagram, index) => renderCard(diagram, index, false))}
          </div>
        )}
      </div>

      {draggedDiagram && renderCard(draggedDiagram, dragIndex!, true)}

      {assigningDiagram && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/60" onClick={() => setAssigningDiagram(null)}>
          <div
            className="w-full rounded-t-2xl bg-zinc-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-medium text-zinc-200">
              {assigningDiagram.title || `${getTemplate(assigningDiagram.templateId).name} 도해도`} · 그룹 선택
            </p>
            <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
              <button
                onClick={() => handleAssignGroup(undefined)}
                className={`rounded-lg px-3 py-2 text-left text-sm ${
                  !assigningDiagram.groupId ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-200'
                }`}
              >
                그룹 없음
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleAssignGroup(g.id)}
                  className={`rounded-lg px-3 py-2 text-left text-sm ${
                    assigningDiagram.groupId === g.id ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-200'
                  }`}
                >
                  📁 {g.name}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="새 그룹 이름"
                className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500"
              />
              <button
                onClick={handleCreateAndAssignGroup}
                disabled={!newGroupName.trim()}
                className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-40"
              >
                만들고 담기
              </button>
            </div>
          </div>
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
