import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_LABELS, db, type Diagram, type GroupMedia } from '../db'
import { useBackClose } from '../hooks/useBackClose'
import { useDiagrams, useGroupMedia, useGroups, type CategoryFilter } from '../hooks/useDiagrams'
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
  const media = useGroupMedia(openGroupId)
  const [lightboxMedia, setLightboxMedia] = useState<GroupMedia | null>(null)

  // back button closes whichever of these is open first, innermost layer
  // (lightbox, then the assign-to-group sheet) before it closes the folder
  useBackClose(openGroupId !== null, () => setOpenGroupId(null))
  useBackClose(assigningDiagram !== null, () => setAssigningDiagram(null))
  useBackClose(lightboxMedia !== null, () => setLightboxMedia(null))
  const fileInputRef = useRef<HTMLInputElement>(null)
  // one object URL per media blob, created lazily and revoked once the item
  // is gone (deleted, or we've navigated out of its folder) — recreating a
  // URL on every render would leak one for each render instead
  const mediaUrlsRef = useRef(new Map<string, string>())

  // local copy that can be live-reordered while dragging, same pattern as
  // localDiagrams below — resynced from the live query whenever a drag isn't
  // in progress
  const [localMedia, setLocalMedia] = useState<GroupMedia[]>([])
  const [mediaDragIndex, setMediaDragIndex] = useState<number | null>(null)
  const [mediaGhostRect, setMediaGhostRect] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)

  const mediaStripRef = useRef<HTMLDivElement>(null)
  const mediaItemRefs = useRef(new Map<string, HTMLDivElement>())
  const localMediaRef = useRef<GroupMedia[]>([])
  const mediaPressStartRef = useRef<{ x: number; y: number } | null>(null)
  const mediaGrabOffsetRef = useRef({ x: 0, y: 0 })
  const mediaLongPressTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const mediaLongPressReadyRef = useRef(false)
  const mediaDidDragRef = useRef(false)
  const mediaDragIndexRef = useRef<number | null>(null)
  const mediaCleanupDragRef = useRef<(() => void) | null>(null)

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
  // which folder tile (if any) the dragged card is currently hovering over
  const [hoverFolderId, setHoverFolderId] = useState<string | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const folderRefs = useRef(new Map<string, HTMLButtonElement>())
  const localDiagramsRef = useRef<Diagram[]>([])
  const pressStartRef = useRef<{ x: number; y: number } | null>(null)
  const grabOffsetRef = useRef({ x: 0, y: 0 })
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const longPressReadyRef = useRef(false)
  const didDragRef = useRef(false)
  const dragIndexRef = useRef<number | null>(null)
  const hoverFolderIdRef = useRef<string | null>(null)
  const draggedDiagramIdRef = useRef<string | null>(null)
  const cleanupDragRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    localDiagramsRef.current = localDiagrams
  }, [localDiagrams])

  useEffect(() => {
    if (dragIndex === null) setLocalDiagrams(visibleDiagrams)
  }, [visibleDiagrams, dragIndex])

  // release any window listeners left over if the component unmounts mid-drag
  useEffect(() => () => cleanupDragRef.current?.(), [])

  useEffect(() => {
    localMediaRef.current = localMedia
  }, [localMedia])

  useEffect(() => {
    if (mediaDragIndex === null) setLocalMedia(media)
  }, [media, mediaDragIndex])

  useEffect(() => () => mediaCleanupDragRef.current?.(), [])

  useEffect(() => {
    const currentIds = new Set(media.map((m) => m.id))
    for (const m of media) {
      if (!mediaUrlsRef.current.has(m.id)) {
        mediaUrlsRef.current.set(m.id, URL.createObjectURL(m.blob))
      }
    }
    for (const [id, url] of mediaUrlsRef.current) {
      if (!currentIds.has(id)) {
        URL.revokeObjectURL(url)
        mediaUrlsRef.current.delete(id)
      }
    }
  }, [media])

  // revoke whatever's left when the screen itself unmounts
  useEffect(
    () => () => {
      for (const url of mediaUrlsRef.current.values()) URL.revokeObjectURL(url)
    },
    [],
  )

  const handleDelete = (e: React.MouseEvent, diagram: Diagram) => {
    e.stopPropagation()
    if (!window.confirm(`"${diagram.title || getTemplate(diagram.templateId).name + ' 도해도'}"를 삭제할까요?`)) return
    void db.diagrams.delete(diagram.id)
  }

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const groupId = openGroupId
    // copy out of the live FileList before clearing the input — resetting
    // .value empties that same FileList in place, not just the input
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-selecting the same file later
    if (!groupId || files.length === 0) return
    const baseOrder = media.length
    await Promise.all(
      files.map((file, i) =>
        db.media.add({
          id: crypto.randomUUID(),
          groupId,
          type: file.type.startsWith('video') ? 'video' : 'image',
          blob: file,
          name: '',
          createdAt: Date.now(),
          order: baseOrder + i,
        }),
      ),
    )
  }

  const handleDeleteMedia = (e: React.MouseEvent, m: GroupMedia) => {
    e.stopPropagation()
    if (!window.confirm('이 사진/동영상을 삭제할까요?')) return
    void db.media.delete(m.id)
  }

  const handleRenameMedia = (m: GroupMedia, name: string) => {
    if (name === m.name) return
    void db.media.update(m.id, { name })
  }

  const commitMediaOrder = async (finalOrder: GroupMedia[]) => {
    await Promise.all(finalOrder.map((m, i) => db.media.update(m.id, { order: i })))
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
    // once a pre-hold move is recognized as a scroll (see below), every
    // further move for this gesture just pans the list — it can never
    // turn back into a drag
    let isScrolling = false
    let lastScrollY = e.clientY

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

      if (isScrolling) {
        const container = scrollContainerRef.current
        if (container) container.scrollTop -= ev.clientY - lastScrollY
        lastScrollY = ev.clientY
        return
      }

      const dx = ev.clientX - pressStartRef.current.x
      const dy = ev.clientY - pressStartRef.current.y
      const moved = Math.hypot(dx, dy) > DRAG_START_THRESHOLD

      if (dragIndexRef.current === null) {
        if (!longPressReadyRef.current) {
          if (moved) {
            // moved before the hold registered — a scroll, not a drag. Cards
            // are touch-action:none (so a confirmed drag doesn't fight the
            // page for the gesture), which also blocks the browser's own
            // touch scrolling, so drive the container's scrollTop by hand
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
            isScrolling = true
            // suppress the click this gesture would otherwise fire on
            // mouseup/touchend — the pointer likely ends up over a
            // different card once the list has scrolled underneath it
            didDragRef.current = true
            const container = scrollContainerRef.current
            if (container) container.scrollTop -= dy
            lastScrollY = ev.clientY
          }
          return
        }
        if (!moved) return
        // hold elapsed and the finger is now moving — start dragging
        didDragRef.current = true
        dragIndexRef.current = index
        draggedDiagramIdRef.current = localDiagramsRef.current[index]?.id ?? null
        setGhostRect({
          left: ev.clientX - grabOffsetRef.current.x,
          top: ev.clientY - grabOffsetRef.current.y,
          width: grabRect?.width ?? 0,
          height: grabRect?.height ?? 0,
        })
        setDragIndex(index)
        return
      }

      // already dragging — move the ghost with the finger
      setGhostRect((r) =>
        r ? { ...r, left: ev.clientX - grabOffsetRef.current.x, top: ev.clientY - grabOffsetRef.current.y } : r,
      )

      // hovering a folder tile files the card into that group on drop
      // instead of reordering it — folders only render at the root screen
      let hoveredFolder: string | null = null
      if (openGroupId === null) {
        for (const [groupId, folderEl] of folderRefs.current) {
          const r = folderEl.getBoundingClientRect()
          if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
            hoveredFolder = groupId
            break
          }
        }
      }
      if (hoveredFolder !== hoverFolderIdRef.current) {
        hoverFolderIdRef.current = hoveredFolder
        setHoverFolderId(hoveredFolder)
      }

      // retarget to whichever fixed grid cell the pointer is over. Cell
      // geometry (not other cards' current positions) drives this on
      // purpose: comparing against neighbors' centers creates a feedback
      // loop — swapping moves a different card under the pointer, which
      // immediately looks closer than the target and swaps right back,
      // oscillating every move event. Skipped while hovering a folder so
      // the list doesn't jump to slot 0 just because the pointer moved
      // above the grid, into the folder row.
      const current = dragIndexRef.current
      const gridEl = gridRef.current
      if (!hoveredFolder && gridEl && grabRect) {
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
        const droppedFolderId = hoverFolderIdRef.current
        const draggedId = draggedDiagramIdRef.current
        hoverFolderIdRef.current = null
        draggedDiagramIdRef.current = null
        setHoverFolderId(null)
        if (droppedFolderId && draggedId) {
          // move it into the folder right away instead of waiting on the
          // IndexedDB round-trip, so it doesn't flash back into the grid
          setLocalDiagrams((prev) => prev.filter((d) => d.id !== draggedId))
          void db.diagrams.update(draggedId, { groupId: droppedFolderId })
        } else {
          void commitOrder(localDiagramsRef.current)
        }
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

  // long-press a media thumbnail to drag it left/right within the strip —
  // same long-press + threshold + scroll-fallback pattern as the diagram
  // grid above, just along one axis instead of two
  const handleMediaPointerDown = (index: number) => (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const pointerId = e.pointerId
    mediaPressStartRef.current = { x: e.clientX, y: e.clientY }
    mediaLongPressReadyRef.current = false
    mediaDidDragRef.current = false
    let isScrolling = false
    let lastScrollX = e.clientX

    const el = mediaItemRefs.current.get(localMediaRef.current[index]?.id)
    const grabRect = el?.getBoundingClientRect()
    if (grabRect) {
      mediaGrabOffsetRef.current = { x: e.clientX - grabRect.left, y: e.clientY - grabRect.top }
    }

    mediaLongPressTimerRef.current = setTimeout(() => {
      mediaLongPressReadyRef.current = true
    }, LONG_PRESS_MS)

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId || !mediaPressStartRef.current) return

      if (isScrolling) {
        const strip = mediaStripRef.current
        if (strip) strip.scrollLeft -= ev.clientX - lastScrollX
        lastScrollX = ev.clientX
        return
      }

      const dx = ev.clientX - mediaPressStartRef.current.x
      const dy = ev.clientY - mediaPressStartRef.current.y
      const moved = Math.hypot(dx, dy) > DRAG_START_THRESHOLD

      if (mediaDragIndexRef.current === null) {
        if (!mediaLongPressReadyRef.current) {
          if (moved) {
            // moved before the hold registered — pan the strip by hand,
            // same reasoning as the diagram grid's scroll fallback
            if (mediaLongPressTimerRef.current) clearTimeout(mediaLongPressTimerRef.current)
            isScrolling = true
            mediaDidDragRef.current = true
            const strip = mediaStripRef.current
            if (strip) strip.scrollLeft -= dx
            lastScrollX = ev.clientX
          }
          return
        }
        if (!moved) return
        mediaDidDragRef.current = true
        mediaDragIndexRef.current = index
        setMediaGhostRect({
          left: ev.clientX - mediaGrabOffsetRef.current.x,
          top: ev.clientY - mediaGrabOffsetRef.current.y,
          width: grabRect?.width ?? 0,
          height: grabRect?.height ?? 0,
        })
        setMediaDragIndex(index)
        return
      }

      // already dragging — move the ghost with the finger and retarget to
      // whichever slot the pointer is horizontally over
      setMediaGhostRect((r) =>
        r ? { ...r, left: ev.clientX - mediaGrabOffsetRef.current.x, top: ev.clientY - mediaGrabOffsetRef.current.y } : r,
      )

      const current = mediaDragIndexRef.current
      const strip = mediaStripRef.current
      if (strip && grabRect) {
        const stripRect = strip.getBoundingClientRect()
        const gap = 8 // matches the strip's gap-2
        const slotWidth = grabRect.width + gap
        const uploadTileWidth = grabRect.width + gap // the "+" tile is the same size, ahead of index 0
        const relativeX = ev.clientX - stripRect.left + strip.scrollLeft - uploadTileWidth
        const targetIndex = Math.min(
          localMediaRef.current.length - 1,
          Math.max(0, Math.floor(relativeX / slotWidth)),
        )
        if (targetIndex !== current) {
          mediaDragIndexRef.current = targetIndex
          setLocalMedia((prev) => {
            const next = prev.slice()
            const [movedItem] = next.splice(current, 1)
            next.splice(targetIndex, 0, movedItem)
            return next
          })
          setMediaDragIndex(targetIndex)
        }
      }
    }

    const endDrag = () => {
      if (mediaLongPressTimerRef.current) clearTimeout(mediaLongPressTimerRef.current)
      mediaLongPressTimerRef.current = undefined
      mediaPressStartRef.current = null
      mediaLongPressReadyRef.current = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      mediaCleanupDragRef.current = null
      if (mediaDragIndexRef.current !== null) {
        mediaDragIndexRef.current = null
        setMediaDragIndex(null)
        setMediaGhostRect(null)
        void commitMediaOrder(localMediaRef.current)
      }
    }

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      endDrag()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    mediaCleanupDragRef.current = endDrag
  }

  const handleMediaClick = (m: GroupMedia) => {
    if (mediaDidDragRef.current) {
      mediaDidDragRef.current = false
      return
    }
    setLightboxMedia(m)
  }

  const draggedMedia = mediaDragIndex !== null ? localMedia[mediaDragIndex] : undefined

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
        // a long-press is our reorder/file-into-folder gesture, not a request
        // for the phone's native "save/share image" menu
        onContextMenu={(e) => e.preventDefault()}
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
        className={`relative flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left touch-none select-none transition-all ${
          isGhost
            ? hoverFolderId
              ? 'scale-75 opacity-60 shadow-2xl' // shrink over the target folder so its highlight peeks through
              : 'scale-105 shadow-2xl'
            : dragIndex === index
              ? 'opacity-0'
              : 'active:bg-zinc-800'
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
            // own long-press reorder gesture and swallow subsequent pointer events.
            // touch-callout:none stops iOS Safari's long-press "Save Image" sheet,
            // which contextmenu.preventDefault() alone doesn't suppress
            <img
              src={diagram.thumbnail}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full [-webkit-touch-callout:none]"
            />
          ) : (
            // no thumbnail yet (e.g. still saving) — show the plain reference photo
            <img
              src={template.photo}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain [-webkit-touch-callout:none]"
            />
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

  const renderMediaItem = (m: GroupMedia, index: number, isGhost: boolean) => (
    <div
      key={isGhost ? `${m.id}-ghost` : m.id}
      ref={isGhost ? undefined : (el) => void (el ? mediaItemRefs.current.set(m.id, el) : mediaItemRefs.current.delete(m.id))}
      style={
        isGhost && mediaGhostRect
          ? {
              position: 'fixed',
              left: mediaGhostRect.left,
              top: mediaGhostRect.top,
              width: mediaGhostRect.width,
              zIndex: 50,
            }
          : undefined
      }
      className={`flex w-20 shrink-0 flex-col gap-1 ${
        isGhost ? 'scale-105 shadow-2xl' : mediaDragIndex === index ? 'opacity-0' : ''
      }`}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-900 touch-none select-none">
        <button
          onPointerDown={isGhost ? undefined : handleMediaPointerDown(index)}
          onClick={() => handleMediaClick(m)}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0"
        >
          {m.type === 'video' ? (
            <video
              src={mediaUrlsRef.current.get(m.id)}
              muted
              playsInline
              className="h-full w-full object-cover [-webkit-touch-callout:none]"
            />
          ) : (
            <img
              src={mediaUrlsRef.current.get(m.id)}
              alt=""
              draggable={false}
              className="h-full w-full object-cover [-webkit-touch-callout:none]"
            />
          )}
          {m.type === 'video' && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-lg text-white">
              ▶
            </span>
          )}
        </button>
        {!isGhost && (
          <button
            onClick={(e) => handleDeleteMedia(e, m)}
            aria-label="삭제"
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-950/80 text-[10px] text-zinc-300"
          >
            🗑
          </button>
        )}
      </div>
      {!isGhost && (
        <input
          key={m.id}
          defaultValue={m.name}
          onBlur={(e) => handleRenameMedia(m, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          placeholder="이름"
          className="w-full truncate rounded bg-transparent px-0.5 text-center text-[10px] text-zinc-400 outline-none placeholder:text-zinc-600"
        />
      )}
    </div>
  )

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

      {currentGroup && (
        <div ref={mediaStripRef} className="flex gap-2 overflow-x-auto border-b border-zinc-800 px-4 py-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 text-zinc-500 active:bg-zinc-900"
          >
            <span className="text-xl">＋</span>
            <span className="text-[10px]">사진/동영상</span>
          </button>
          {localMedia.map((m, index) => renderMediaItem(m, index, false))}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />
        </div>
      )}

      {draggedMedia && renderMediaItem(draggedMedia, mediaDragIndex!, true)}

      <div ref={scrollContainerRef} className="flex flex-1 flex-col overflow-y-auto">
        {openGroupId === null && (
          <div className="grid grid-cols-2 gap-4 p-4 pb-0">
            {groups.map((g) => {
              const groupDiagrams = diagrams.filter((d) => d.groupId === g.id)
              const preview = groupDiagrams.slice(0, 4)
              const isHovered = hoverFolderId === g.id
              return (
                <button
                  key={g.id}
                  ref={(el) => void (el ? folderRefs.current.set(g.id, el) : folderRefs.current.delete(g.id))}
                  onClick={() => setOpenGroupId(g.id)}
                  onContextMenu={(e) => handleGroupContextMenu(e, g.id, g.name)}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-left transition-colors ${
                    isHovered ? 'border-white bg-zinc-800' : 'border-zinc-800 bg-zinc-900 active:bg-zinc-800'
                  }`}
                >
                  {preview.length === 0 ? (
                    <div
                      className={`flex aspect-[3/4] w-full items-center justify-center rounded-lg text-4xl transition-transform ${
                        isHovered ? 'scale-110 bg-zinc-900' : 'bg-zinc-950'
                      }`}
                    >
                      📁
                    </div>
                  ) : (
                    <div
                      className={`grid aspect-[3/4] w-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-lg bg-zinc-950 transition-transform ${
                        isHovered ? 'scale-110' : ''
                      }`}
                    >
                      {Array.from({ length: 4 }, (_, i) => preview[i]).map((d, i) => (
                        <div key={d?.id ?? i} className="overflow-hidden bg-zinc-900">
                          {d && (
                            <img
                              src={d.thumbnail ?? getTemplate(d.templateId).photo}
                              alt=""
                              draggable={false}
                              className="h-full w-full object-cover [-webkit-touch-callout:none]"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="w-full truncate text-sm text-zinc-200">{g.name}</span>
                  <span className="w-full text-xs text-zinc-500">{groupDiagrams.length}개</span>
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

      {lightboxMedia && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxMedia(null)}
        >
          {lightboxMedia.type === 'video' ? (
            <video
              src={mediaUrlsRef.current.get(lightboxMedia.id)}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={mediaUrlsRef.current.get(lightboxMedia.id)}
              alt=""
              className="max-h-full max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <button
            onClick={() => setLightboxMedia(null)}
            aria-label="닫기"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/80 text-lg text-white"
          >
            ✕
          </button>
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
