import { syntaxTree } from '@codemirror/language'
import type { EditorState, Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'

/**
 * Following a link (Phase 8).
 *
 * Links render as their label alone — the `](url)` folds away like any other
 * syntax and comes back when the caret moves in. That leaves no way to *open*
 * one, so Mod-click does it, and holding Mod marks the editor so the affordance
 * is visible before the click.
 */

export const MOD_HELD_CLASS = 'cm-md-mod'

export interface LinkOptions {
  /**
   * Called for a Mod-click on a link. The default opens a new browsing
   * context; an Electron shell will intercept that in its window-open handler
   * and hand the URL to the OS.
   */
  openLink?: (url: string, event: MouseEvent) => void
}

const defaultOpen = (url: string): void => {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** The URL a position sits on, or null when it is not on a link. */
export function urlAt(state: EditorState, pos: number): string | null {
  const slice = (node: SyntaxNode): string => state.doc.sliceString(node.from, node.to)

  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1); node; node = node.parent) {
    if (node.name === 'URL') {
      // Inside a `[label](url)` this is the target; standing alone it is a
      // GFM autolink literal. Either way it is the URL.
      return slice(node)
    }
    if (node.name === 'Link' || node.name === 'Image' || node.name === 'Autolink') {
      for (let child = node.firstChild; child; child = child.nextSibling) {
        if (child.name === 'URL') return slice(child)
      }
      // A reference link — `[label][id]` — has no URL to follow.
      return null
    }
  }
  return null
}

const isMod = (event: MouseEvent | KeyboardEvent): boolean =>
  // Meta on macOS, Ctrl elsewhere — the same split as CodeMirror's `Mod-`.
  /Mac|iP(hone|ad|od)/.test(navigator.platform) ? event.metaKey : event.ctrlKey

export function markdownLinks(options: LinkOptions = {}): Extension {
  const open = options.openLink ?? defaultOpen

  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (!isMod(event) || event.button !== 0) return false
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos === null) return false
      const url = urlAt(view.state, pos)
      if (!url) return false
      event.preventDefault()
      open(url, event)
      return true
    },

    keydown(event, view) {
      // The class lives on the editor's outer element, not on the content
      // CodeMirror manages, so this is safe to touch mid-composition (I6).
      if (isMod(event)) view.dom.classList.add(MOD_HELD_CLASS)
      return false
    },

    keyup(event, view) {
      if (!isMod(event)) view.dom.classList.remove(MOD_HELD_CLASS)
      return false
    },

    blur(_event, view) {
      view.dom.classList.remove(MOD_HELD_CLASS)
      return false
    }
  })
}
