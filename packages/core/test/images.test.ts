// @vitest-environment jsdom
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultCommands, markdownSetup } from '../src/editor.js'
import {
  imagePreviewActive,
  imagePreviewsInstalled,
  toggleImagePreview
} from '../src/decorations/images.js'
import type { ImageOptions } from '../src/decorations/images.js'

const views: EditorView[] = []
afterEach(() => {
  for (const view of views.splice(0)) view.destroy()
})

/**
 * The caret defaults to the end of the document, not offset 0: the reveal rule
 * counts offset 0 as being on whatever node starts the document, so a caret
 * there would put every one of these fixtures into edit mode.
 */
function mount(doc: string, cursor = doc.length, images: ImageOptions | false = {}): EditorView {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(cursor),
      extensions: markdownSetup({ codeLanguages: [], theme: false, images })
    })
  })
  views.push(view)
  return view
}

/** Preview mode on from the first frame, which is most of these tests. */
const on = (doc: string, cursor = doc.length, extra: ImageOptions = {}): EditorView =>
  mount(doc, cursor, { previewOn: true, ...extra })

/**
 * Scoped to our class: CodeMirror wraps every replacing widget in its own
 * `<img class="cm-widgetBuffer">` spacers, so a bare `img` selector counts
 * those too.
 */
const rendered = (view: EditorView): HTMLImageElement[] => [
  ...view.contentDOM.querySelectorAll<HTMLImageElement>('img.cm-md-image')
]

const brokenInline = (view: EditorView): HTMLElement[] => [
  ...view.contentDOM.querySelectorAll<HTMLElement>('.cm-md-image-broken')
]

/** The floating preview, which lives in a tooltip outside `contentDOM`. */
const lightbox = (view: EditorView): HTMLElement | null =>
  view.dom.querySelector<HTMLElement>('.cm-md-image-lightbox')

describe('an image is alt text first, like any other link', () => {
  it('reads as its alt text with preview mode off', () => {
    const view = mount('![a cat](/cat.png)')
    expect(rendered(view)).toHaveLength(0)
    expect(view.contentDOM.textContent).toBe('a cat')
  })

  it('is off unless configured, because src resolution needs the shell', () => {
    const view = mount('![a cat](/cat.png)', undefined, false)
    expect(rendered(view)).toHaveLength(0)
    expect(view.contentDOM.textContent).toBe('a cat')
  })

  it('ignores a reference image, which has no source of its own', () => {
    const view = on('![alt][id]\n\n[id]: /cat.png')
    expect(rendered(view)).toHaveLength(0)
  })
})

describe('preview mode', () => {
  it('draws the picture in place of the alt text', () => {
    const view = on('![a cat](/cat.png)')
    const [img] = rendered(view)
    expect(img?.getAttribute('src')).toBe('/cat.png')
    expect(img?.alt).toBe('a cat')
    expect(view.contentDOM.textContent).not.toContain('a cat')
  })

  it('asks the shell to resolve the source', () => {
    const seen: string[] = []
    const view = on('![x](pics/a.png)', undefined, {
      resolveSrc: (src) => {
        seen.push(src)
        return `asset://local/${src}`
      }
    })
    expect(seen).toContain('pics/a.png')
    expect(rendered(view)[0]?.getAttribute('src')).toBe('asset://local/pics/a.png')
  })

  it('renders several images independently', () => {
    const view = on('![a](/1.png) and ![b](/2.png)')
    expect(rendered(view).map((img) => img.getAttribute('src'))).toEqual(['/1.png', '/2.png'])
  })

  it('goes back to alt text on the second press', () => {
    const view = on('![a cat](/cat.png)')
    expect(imagePreviewActive(view.state)).toBe(true)
    toggleImagePreview(view)
    expect(imagePreviewActive(view.state)).toBe(false)
    expect(rendered(view)).toHaveLength(0)
    expect(view.contentDOM.textContent).toBe('a cat')
  })

  it('is off by default — it is a mode you ask for', () => {
    expect(imagePreviewActive(mount('![a](/1.png)').state)).toBe(false)
  })

  it('reports itself unavailable when the host never configured images', () => {
    const view = mount('![a cat](/cat.png)', undefined, false)
    expect(imagePreviewsInstalled(view.state)).toBe(false)
    // False, not a throw: the command returns "unhandled" and the key falls
    // through to whatever else wants it.
    expect(toggleImagePreview(view)).toBe(false)
  })
})

describe('the caret always wins over the mode', () => {
  it('shows the whole marker when the caret is inside, preview off', () => {
    const view = mount('![a cat](/cat.png)', 5)
    expect(view.contentDOM.textContent).toBe('![a cat](/cat.png)')
  })

  it('shows the whole marker when the caret is inside, preview on', () => {
    const view = on('![a cat](/cat.png)', 5)
    expect(rendered(view)).toHaveLength(0)
    expect(view.contentDOM.textContent).toBe('![a cat](/cat.png)')
  })

  it('uses the same reveal rule as every other marker: strictly inside', () => {
    // Caret at the very end of the node is outside it (see reveal.ts).
    const view = on('![a cat](/cat.png)', 18)
    expect(rendered(view)).toHaveLength(1)
  })
})

describe('the floating preview at the caret', () => {
  it('appears while the markdown is revealed, with preview mode off', () => {
    const view = mount('![a cat](/cat.png)', 5)
    expect(lightbox(view)?.querySelector('img')?.getAttribute('src')).toBe('/cat.png')
  })

  it('appears just the same with preview mode on', () => {
    const view = on('![a cat](/cat.png)', 5)
    expect(lightbox(view)?.querySelector('img')?.getAttribute('src')).toBe('/cat.png')
  })

  it('stays away when the caret is outside the image', () => {
    const view = mount('![a cat](/cat.png)\n\ntext', 21)
    expect(lightbox(view)).toBeNull()
  })

  it('follows the caret from one image to the next', () => {
    const doc = '![a](/1.png) and ![b](/2.png)'
    const view = mount(doc, 3)
    expect(lightbox(view)?.querySelector('img')?.getAttribute('src')).toBe('/1.png')
    view.dispatch({ selection: EditorSelection.single(doc.indexOf('/2.png')) })
    expect(lightbox(view)?.querySelector('img')?.getAttribute('src')).toBe('/2.png')
  })

  it('can be turned off on its own, leaving preview mode alone', () => {
    const view = on('![a cat](/cat.png)', 5, { lightbox: false })
    expect(lightbox(view)).toBeNull()
    view.dispatch({ selection: EditorSelection.single(view.state.doc.length) })
    expect(rendered(view)).toHaveLength(1)
  })
})

describe('a source that will not load', () => {
  it('draws the broken placeholder inline when the shell declines to resolve', () => {
    const view = on('![a picture](secret.png)', undefined, { resolveSrc: () => null })
    expect(rendered(view)).toHaveLength(0)
    expect(brokenInline(view)).toHaveLength(1)
    expect(view.contentDOM.textContent).toContain('a picture')
  })

  it('draws the same placeholder in the floating preview', () => {
    const view = mount('![a picture](secret.png)', 5, { resolveSrc: () => null })
    const box = lightbox(view)
    expect(box?.querySelector('.cm-md-image-broken')).not.toBeNull()
    expect(box?.textContent).toContain('a picture')
  })

  it('swaps to the placeholder when the image itself fails to load', () => {
    const view = on('![merman](merman.jpg)')
    const [img] = rendered(view)
    img?.dispatchEvent(new Event('error'))
    expect(brokenInline(view)).toHaveLength(1)
    expect(view.contentDOM.textContent).toContain('merman')
  })

  /**
   * Phase 8 shipped two overlapping `replace` decorations over one image: the
   * engine's, over the markers, and this module's, over the whole node. At
   * equal precedence the first render was fine and the next edit dropped the
   * widget, leaving the line blank until the caret moved — which is exactly
   * how it was reported. `Prec.high` is what settles the pair.
   */
  it('regression: editing the path keeps the image rendered, caret outside', () => {
    const doc = '![merman](merman.jpg)'
    const view = on(doc)
    expect(rendered(view)[0]?.getAttribute('src')).toBe('merman.jpg')

    // Break it the way a typo would: drop the "j" of ".jpg".
    const j = doc.indexOf('.jpg') + 1
    view.dispatch({ changes: { from: j, to: j + 1, insert: '' } })
    expect(view.state.doc.toString()).toBe('![merman](merman.pg)')
    expect(rendered(view)[0]?.getAttribute('src')).toBe('merman.pg')

    // And repairing it must not need a caret move to take effect.
    view.dispatch({ changes: { from: j, to: j, insert: 'j' } })
    expect(view.state.doc.toString()).toBe('![merman](merman.jpg)')
    expect(rendered(view)[0]?.getAttribute('src')).toBe('merman.jpg')
  })

  it('regression: the same holds with preview off — alt text never blanks', () => {
    const doc = '![merman](merman.jpg)'
    const view = mount(doc)
    const j = doc.indexOf('.jpg') + 1
    view.dispatch({ changes: { from: j, to: j + 1, insert: '' } })
    expect(view.contentDOM.textContent).toBe('merman')
    view.dispatch({ changes: { from: j, to: j, insert: 'j' } })
    expect(view.contentDOM.textContent).toBe('merman')
  })

  it('regression: an edit after a failed load rebuilds cleanly', () => {
    const doc = '![merman](merman.jpg)'
    const view = on(doc)
    rendered(view)[0]?.dispatchEvent(new Event('error'))
    expect(brokenInline(view)).toHaveLength(1)

    const j = doc.indexOf('.jpg') + 1
    view.dispatch({ changes: { from: j, to: j + 1, insert: '' } })
    // A fresh widget for the new src — not the detached DOM of the old one.
    expect(view.state.doc.toString()).toBe('![merman](merman.pg)')
    expect(rendered(view)[0]?.getAttribute('src')).toBe('merman.pg')
  })
})

/**
 * The reason the reveal rule includes a node's first position. Reported as:
 * the caret leaves edit mode the moment it reaches the `[`, so the marker
 * collapses exactly when you are trying to prepend to it.
 */
describe('prepending a character that changes what the node is', () => {
  const link = '[link](www.test.com/image.jpg)'

  it('stays in edit mode with the caret at the opening bracket', () => {
    const view = on(link, 0)
    expect(view.contentDOM.textContent).toBe(link)
  })

  it('turns the link into a rendered image when a ! is typed there', () => {
    const view = on(link, 0)
    view.dispatch({ changes: { from: 0, to: 0, insert: '!' } })
    expect(view.state.doc.toString()).toBe(`!${link}`)

    // Still in edit mode — the caret is at offset 1, inside the new node.
    expect(view.contentDOM.textContent).toBe(`!${link}`)

    // And clear of it, the image renders rather than reading as a link.
    view.dispatch({ selection: EditorSelection.single(view.state.doc.length) })
    expect(rendered(view)[0]?.getAttribute('src')).toBe('www.test.com/image.jpg')
  })

  it('inserts before the marker, not inside it', () => {
    const view = mount(link, 0)
    view.dispatch({ changes: { from: 0, to: 0, insert: '!' } })
    // The regression this guards: landing at offset 1 would give "[!link]".
    expect(view.state.doc.toString()).toBe('![link](www.test.com/image.jpg)')
  })
})

describe('the toggle as a command', () => {
  it('is registered with its shortcut, so menu and palette agree (I4)', () => {
    const command = defaultCommands().get('view.imagePreview')
    expect(command?.keys).toEqual(['Mod-Shift-m'])
    expect(command?.scope).toBe('editor')
    expect(command?.category).toBe('View')
  })

  it('is disabled when the editor has no images installed', () => {
    const registry = defaultCommands()
    const off = mount('![a](/1.png)', undefined, false)
    const configured = mount('![a](/1.png)')
    expect(registry.enabled('view.imagePreview', { view: off, app: {} })).toBe(false)
    expect(registry.enabled('view.imagePreview', { view: configured, app: {} })).toBe(true)
  })

  it('flips the mode when run', () => {
    const registry = defaultCommands()
    const view = mount('![a cat](/cat.png)')
    expect(registry.run('view.imagePreview', { view, app: {} })).toBe(true)
    expect(imagePreviewActive(view.state)).toBe(true)
    expect(rendered(view)).toHaveLength(1)
  })
})
