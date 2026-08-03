import { useEffect, useRef } from 'react'

// Every mounted layer that wants the hardware/gesture back button to close it
// (instead of exiting the PWA) registers its close callback here, in the
// order it opened — innermost last. Which layer closes on a given back press
// is tracked entirely in this in-memory stack, not in the browser's history
// (at most one "trap" entry ever sits there, reused for however many layers
// are nested). That sidesteps a real race: history.back() is asynchronous, so
// if one layer's close and a sibling's open both happen in the same render
// (e.g. leaving a folder open while its diagram opens the editor screen),
// a back() from the first can resolve after a pushState from the second and
// consume the wrong entry. Never calling back() — only ever pushState, always
// synchronous — makes that impossible.
interface Entry {
  id: number
  onClose: () => void
}

const stack: Entry[] = []
let seq = 0
let armed = false

function arm() {
  if (armed) return
  armed = true
  history.pushState({ backTrap: true }, '')
}

window.addEventListener('popstate', () => {
  armed = false
  stack.pop()?.onClose()
  // more layers still open — rearm so the next back press is trappable too
  if (stack.length > 0) arm()
})

// Makes the back button close this UI layer and return to whatever was
// showing before it, instead of leaving the app. Call unconditionally on
// every render with `active` set to whether this layer (screen/folder/modal)
// is currently open, and `onClose` set to whatever collapses it.
export function useBackClose(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!active) return
    const id = ++seq
    stack.push({ id, onClose: () => onCloseRef.current() })
    arm()

    return () => {
      const idx = stack.findIndex((entry) => entry.id === id)
      if (idx !== -1) stack.splice(idx, 1) // no-op if a back press already popped it
    }
  }, [active])
}
