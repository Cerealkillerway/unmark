import { syntaxTree } from '@codemirror/language'
import type { EditorState, Extension, Range } from '@codemirror/state'
import {
  Decoration,
  type EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import { isRevealed } from './reveal.js'

/**
 * Image previews (Phase 8).
 *
 * A separate ViewPlugin from the decoration engine, not another rule: the rule
 * table emits plain `replace` ranges, and a preview needs a widget. Everything
 * else is the same — visible ranges only, and the same reveal rule, so moving
 * the caret into an image brings its markdown back for editing.
 */

export interface ImageOptions {
  /**
   * Turns a markdown `src` into something the page may actually load.
   * Relative paths are meaningless without knowing where the document lives,
   * and a browser will not fetch `file://` from an http page — so the shell
   * decides. Returning null leaves the image as text.
   */
  resolveSrc?: (src: string) => string | null
  /** Cap on rendered height, as a CSS length. */
  maxHeight?: string
}

class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly maxHeight: string
  ) {
    super()
  }

  override eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt
  }

  toDOM(): HTMLElement {
    const img = document.createElement('img')
    img.className = 'cm-md-image'
    img.src = this.src
    img.alt = this.alt
    img.style.maxHeight = this.maxHeight
    // A broken path should read as the markdown it came from, not as a
    // browser's broken-image glyph.
    img.addEventListener('error', () => {
      const fallback = document.createElement('span')
      fallback.className = 'cm-md-image-missing'
      fallback.textContent = this.alt || this.src
      img.replaceWith(fallback)
    })
    return img
  }

  /** Let clicks and drags through to CodeMirror so the caret still works. */
  override ignoreEvent(): boolean {
    return false
  }
}

interface Found {
  from: number
  to: number
  src: string
  alt: string
}

function imagesIn(state: EditorState, from: number, to: number): Found[] {
  const out: Found[] = []
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (node.name !== 'Image') return
      let src: string | null = null
      const cursor = node.node
      for (let child = cursor.firstChild; child; child = child.nextSibling) {
        if (child.name === 'URL') src = state.doc.sliceString(child.from, child.to)
      }
      if (!src) return
      const text = state.doc.sliceString(node.from, node.to)
      out.push({
        from: node.from,
        to: node.to,
        src,
        alt: /^!\[([^\]]*)\]/.exec(text)?.[1] ?? ''
      })
    }
  })
  return out
}

export function imagePreviews(options: ImageOptions = {}): Extension {
  const { resolveSrc = (src) => src, maxHeight = '360px' } = options

  const compute = (view: EditorView): DecorationSet => {
    const ranges: Range<Decoration>[] = []
    for (const visible of view.visibleRanges) {
      for (const image of imagesIn(view.state, visible.from, visible.to)) {
        if (isRevealed(image, view.state.selection)) continue
        const src = resolveSrc(image.src)
        if (!src) continue
        ranges.push(
          Decoration.replace({ widget: new ImageWidget(src, image.alt, maxHeight) }).range(
            image.from,
            image.to
          )
        )
      }
    }
    return Decoration.set(ranges, true)
  }

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = compute(view)
      }

      update(update: ViewUpdate): void {
        // I6: never swap DOM out from under an IME composition.
        if (update.view.composing) return
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.decorations = compute(update.view)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  ) as Extension
}
