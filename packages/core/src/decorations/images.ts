import { syntaxTree } from '@codemirror/language'
import {
  Prec,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
  type Range
} from '@codemirror/state'
import {
  Decoration,
  showTooltip,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type EditorView,
  type Tooltip,
  type ViewUpdate
} from '@codemirror/view'
import { isRevealed } from './reveal.js'

/**
 * Images (Phase 8, revised).
 *
 * An image behaves like every other construct first: the decoration engine
 * folds `![alt](src)` down to its alt text, and the caret entering the node
 * brings the whole marker back to edit. That much needs nothing from here.
 *
 * What this module adds is a *preview mode* on top of it:
 *
 *  - off (the default) — an image reads as its alt text, same as any link.
 *  - on — the alt text is replaced by the picture itself.
 *
 * The reveal rule outranks the mode in both directions: wherever the caret is
 * inside an image, the raw markdown is what you see, mode or no mode. That is
 * the whole point of the rule and an image is not special enough to break it.
 *
 * Independently of the mode, a floating preview of the image appears whenever
 * its markdown is revealed — the only moment the picture is otherwise off
 * screen is exactly the moment you are typing its path.
 */

export interface ImageOptions {
  /**
   * Turns a markdown `src` into something the page may actually load.
   * Relative paths are meaningless without knowing where the document lives,
   * and a browser will not fetch `file://` from an http page — so the shell
   * decides. Returning null leaves the image as text.
   */
  resolveSrc?: (src: string) => string | null
  /** Cap on the inline rendered height, as a CSS length. */
  maxHeight?: string
  /** Start with preview mode on. Off by default: it is a mode you ask for. */
  previewOn?: boolean
  /**
   * Show a floating preview of the image whose markdown the caret is inside.
   * On by default: it costs nothing when the caret is elsewhere, and it is the
   * only way to see what you are editing while you edit it.
   */
  lightbox?: boolean
  /**
   * Cap on the floating preview's height. Smaller than `maxHeight` on purpose
   * — this one floats over the text you are typing.
   */
  lightboxMaxHeight?: string
}

/**
 * What a source that will not load looks like.
 *
 * The same element inline and in the floating preview, so a broken path reads
 * the same wherever you meet it: a plain marker plus the text that was meant
 * to describe the picture. Never the browser's own broken-image glyph, which
 * says nothing about which image failed.
 */
function brokenPlaceholder(alt: string, src: string): HTMLElement {
  const box = document.createElement('span')
  box.className = 'cm-md-image-broken'
  box.title = src

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  icon.setAttribute('viewBox', '0 0 24 24')
  icon.setAttribute('aria-hidden', 'true')
  icon.classList.add('cm-md-image-broken-icon')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  // A picture frame with its corner torn away.
  path.setAttribute(
    'd',
    'M21 5v8l-4-4-4 4-3-3-4 4V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2ZM3 15.5V19a2 2 0 0 0 2 2h11M21 16v3a2 2 0 0 1-2 2M4 4l16 16'
  )
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '1.6')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  icon.appendChild(path)

  const label = document.createElement('span')
  label.className = 'cm-md-image-broken-label'
  label.textContent = alt || src

  box.append(icon, label)
  return box
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
    const wrap = document.createElement('span')
    wrap.className = 'cm-md-image-wrap'

    const img = document.createElement('img')
    img.className = 'cm-md-image'
    img.src = this.src
    img.alt = this.alt
    img.style.maxHeight = this.maxHeight

    // Swap the wrapper's *contents*, never the wrapper. CodeMirror keeps the
    // node this method returns and reconciles the DOM around it; replacing
    // that node from an event handler leaves the view holding an element that
    // is no longer in the document, and the next edit renders the line blank.
    img.addEventListener(
      'error',
      () => {
        wrap.replaceChildren(brokenPlaceholder(this.alt, this.src))
      },
      { once: true }
    )

    wrap.appendChild(img)
    return wrap
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

/* ------------------------------------------------------------------ *
 * Preview mode
 * ------------------------------------------------------------------ */

const setPreview = StateEffect.define<boolean>()

/**
 * Whether this editor is currently drawing images instead of their alt text.
 *
 * A StateField rather than a plugin flag: it has to be readable from a command
 * that only holds an `EditorState`. Its presence doubles as the answer to "are
 * images configured at all", which is what lets the toggle disable itself.
 */
const previewMode = StateField.define<boolean>({
  create: () => false,
  update(on, tr) {
    for (const effect of tr.effects) if (effect.is(setPreview)) return effect.value
    return on
  }
})

/** False when `imagePreviews()` is not in the configuration. */
export function imagePreviewsInstalled(state: EditorState): boolean {
  return state.field(previewMode, false) !== undefined
}

/** True while images render in place of their alt text. */
export function imagePreviewActive(state: EditorState): boolean {
  return state.field(previewMode, false) === true
}

/**
 * Flip preview mode.
 *
 * @returns false when images are not installed, so the command that wraps this
 * reports the keystroke as unhandled and the key falls through.
 */
export function toggleImagePreview(view: EditorView): boolean {
  const current = view.state.field(previewMode, false)
  if (current === undefined) return false
  view.dispatch({ effects: setPreview.of(!current) })
  return true
}

const previewChanged = (update: ViewUpdate): boolean =>
  update.startState.field(previewMode, false) !== update.state.field(previewMode, false)

/* ------------------------------------------------------------------ *
 * The floating preview
 * ------------------------------------------------------------------ */

/**
 * The image the caret is inside, if any, already resolved to a loadable URL.
 *
 * Scanning the main range only, not the viewport: there is one caret and one
 * floating preview. `imagesIn` over a zero-length range still enters the nodes
 * that contain it, so this stays a walk down the tree rather than across the
 * document.
 */
function caretImage(state: EditorState): Found | null {
  const { main } = state.selection
  for (const image of imagesIn(state, main.from, main.to)) {
    if (isRevealed(image, state.selection)) return image
  }
  return null
}

function lightboxTooltip(
  image: Found,
  url: string | null,
  maxHeight: string
): Tooltip {
  return {
    pos: image.from,
    end: image.to,
    above: true,
    arrow: true,
    create: () => {
      const dom = document.createElement('div')
      dom.className = 'cm-md-image-lightbox'

      // No resolvable source is the same story as a source that will not load,
      // so it gets the same placeholder rather than an empty popup.
      if (url === null) {
        dom.appendChild(brokenPlaceholder(image.alt, image.src))
        return { dom }
      }

      const img = document.createElement('img')
      img.src = url
      img.alt = image.alt
      img.style.maxHeight = maxHeight
      img.addEventListener(
        'error',
        () => {
          dom.replaceChildren(brokenPlaceholder(image.alt, image.src))
        },
        { once: true }
      )
      dom.appendChild(img)
      return { dom }
    }
  }
}

function caretLightbox(
  resolveSrc: (src: string) => string | null,
  maxHeight: string
): Extension {
  const forState = (state: EditorState): Tooltip | null => {
    const image = caretImage(state)
    return image ? lightboxTooltip(image, resolveSrc(image.src), maxHeight) : null
  }

  return StateField.define<Tooltip | null>({
    create: forState,
    update(value, tr) {
      // The tree arrives later than the text it describes, in a transaction of
      // its own — without this the preview lags a keystroke behind the URL.
      const reparsed = syntaxTree(tr.startState) !== syntaxTree(tr.state)
      if (!tr.docChanged && !tr.selection && !reparsed) return value
      return forState(tr.state)
    },
    provide: (field) => showTooltip.from(field)
  })
}

/* ------------------------------------------------------------------ *
 * The extension
 * ------------------------------------------------------------------ */

export function imagePreviews(options: ImageOptions = {}): Extension {
  const {
    resolveSrc = (src) => src,
    maxHeight = '360px',
    previewOn = false,
    lightbox = true,
    lightboxMaxHeight = '240px'
  } = options

  const compute = (view: EditorView): DecorationSet => {
    // Mode off: the decoration engine's alt text is the whole rendering, and
    // there is nothing to walk the viewport for.
    if (view.state.field(previewMode, false) !== true) return Decoration.none

    const ranges: Range<Decoration>[] = []
    for (const visible of view.visibleRanges) {
      for (const image of imagesIn(view.state, visible.from, visible.to)) {
        // The reveal rule wins over the mode: an image you are editing shows
        // its markdown, exactly like every other construct.
        if (isRevealed(image, view.state.selection)) continue
        const src = resolveSrc(image.src)
        // Unresolvable is not broken-on-load — the shell is telling us it will
        // not serve this one — but it reads the same, so it looks the same.
        const widget =
          src === null
            ? new BrokenWidget(image.src, image.alt)
            : new ImageWidget(src, image.alt, maxHeight)
        ranges.push(Decoration.replace({ widget }).range(image.from, image.to))
      }
    }
    return Decoration.set(ranges, true)
  }

  const plugin = ViewPlugin.fromClass(
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
          previewChanged(update) ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.decorations = compute(update.view)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  )

  return [
    previewMode.init(() => previewOn),
    // `Prec.high` is not cosmetic. The widget replaces the whole `![…](…)`
    // node, while the decoration engine independently replaces the markers
    // inside it — two overlapping `replace` decorations over the same text.
    // At equal precedence CodeMirror resolves that pair inconsistently: the
    // first render is fine, but the next incremental update drops the widget
    // and leaves the line empty until some later transaction rebuilds it.
    // Ranking this source above the engine makes the outer replacement the
    // one that wins, every time.
    Prec.high(plugin),
    ...(lightbox ? [caretLightbox(resolveSrc, lightboxMaxHeight)] : [])
  ]
}

/** An image the shell declined to resolve, drawn as the broken placeholder. */
class BrokenWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string
  ) {
    super()
  }

  override eq(other: BrokenWidget): boolean {
    return other.src === this.src && other.alt === this.alt
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'cm-md-image-wrap'
    wrap.appendChild(brokenPlaceholder(this.alt, this.src))
    return wrap
  }

  override ignoreEvent(): boolean {
    return false
  }
}
