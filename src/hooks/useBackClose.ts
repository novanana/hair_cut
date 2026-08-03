import { useEffect, useRef } from 'react'

// Every mounted layer that wants the hardware/gesture back button to close it
// (instead of exiting the PWA) registers itself here, in the order it opened.
// A single shared listener pops just the top one, so nested layers — e.g. a
// lightbox opened while a folder is open — close one at a time, innermost first.
interface StackEntry {
  token: number
  onClose: () => void
}

let seq = 0
const stack: StackEntry[] = []
let listenerAttached = false

function ensureListener() {
  if (listenerAttached) return
  listenerAttached = true
  window.addEventListener('popstate', () => {
    stack.pop()?.onClose()
  })
}

// Makes the back button close this UI layer and return to whatever was
// showing before it, instead of leaving the app. Call unconditionally on
// every render with `active` set to whether this layer (screen/folder/modal)
// is currently open, and `onClose` set to whatever collapses it.
export function useBackClose(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!active) return
    ensureListener()

    const token = ++seq
    stack.push({ token, onClose: () => onCloseRef.current() })
    history.pushState({ backCloseToken: token }, '')

    return () => {
      const idx = stack.findIndex((entry) => entry.token === token)
      if (idx === -1) return // already consumed by a back-button press
      stack.splice(idx, 1)
      // still sitting on the entry we pushed means this close came from
      // in-app UI, not the back button — consume it ourselves so the
      // history stack doesn't grow every time a layer opens and closes
      if (history.state?.backCloseToken === token) history.back()
    }
  }, [active])
}
