// @vitest-environment jsdom
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { markdownSetup } from '../src/editor.js'
import type { ImageOptions } from '../src/decorations/images.js'

const views: EditorView[] = []
afterEach(() => {
  for (const view of views.splice(0)) view.destroy()
})

function mount(doc: string, cursor = 0, images: ImageOptions | false = {}): EditorView {
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

/**
 * Scoped to our class: CodeMirror wraps every replacing widget in its own
 * `<img class="cm-widgetBuffer">` spacers, so a bare `img` selector counts
 * those too.
 */
const rendered = (view: EditorView): HTMLImageElement[] => [
  ...view.contentDOM.querySelectorAll<HTMLImageElement>('img.cm-md-image')
]

describe('image previews', () => {
  it('replaces the markdown with an image', () => {
    const view = mount('![a cat](/cat.png)')
    const [img] = rendered(view)
    expect(img?.getAttribute('src')).toBe('/cat.png')
    expect(img?.alt).toBe('a cat')
    expect(view.contentDOM.textContent).not.toContain('/cat.png')
  })

  it('shows the markdown again when the caret is inside — the same reveal rule', () => {
    const view = mount('![a cat](/cat.png)', 5)
    expect(rendered(view)).toHaveLength(0)
    expect(view.contentDOM.textContent).toContain('/cat.png')
  })

  it('is off unless configured, because src resolution needs the shell', () => {
    const view = mount('![a cat](/cat.png)', 0, false)
    expect(rendered(view)).toHaveLength(0)
  })

  it('asks the shell to resolve the source', () => {
    const seen: string[] = []
    const view = mount('![x](pics/a.png)', 0, {
      resolveSrc: (src) => {
        seen.push(src)
        return `asset://local/${src}`
      }
    })
    expect(seen).toEqual(['pics/a.png'])
    expect(rendered(view)[0]?.getAttribute('src')).toBe('asset://local/pics/a.png')
  })

  it('falls back to the collapsed alt text when the shell declines to resolve', () => {
    const view = mount('![a picture](secret.png)', 0, { resolveSrc: () => null })
    expect(rendered(view)).toHaveLength(0)
    // The decoration engine has already folded the image down to its alt; the
    // widget only ever replaces that.
    expect(view.contentDOM.textContent).toBe('a picture')
  })

  it('ignores a reference image, which has no source of its own', () => {
    const view = mount('![alt][id]\n\n[id]: /cat.png', 0)
    expect(rendered(view)).toHaveLength(0)
  })

  it('renders several images independently', () => {
    const view = mount('![a](/1.png) and ![b](/2.png)')
    expect(rendered(view).map((img) => img.getAttribute('src'))).toEqual(['/1.png', '/2.png'])
  })
})
