/**
 * A single "something in an editor changed" signal.
 *
 * The chrome that follows the caret — the outline, the status bar — cannot
 * subscribe to a CodeMirror view it does not own, and re-rendering the whole
 * app on every keystroke would be worse. So each editor pushes here through an
 * updateListener, and only the components that read the view subscribe.
 */
let version = 0
const listeners = new Set<() => void>()

export const editorSignal = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: (): number => version,
  bump: (): void => {
    version++
    for (const listener of listeners) listener()
  }
}
