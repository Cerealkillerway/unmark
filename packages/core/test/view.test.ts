// @vitest-environment jsdom
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { markdownSetup } from '../src/editor.js'

let view: EditorView | null = null
afterEach(() => {
  view?.destroy()
  view = null
})

function mount(doc: string, cursor: number): EditorView {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(cursor),
      extensions: markdownSetup({ codeLanguages: [], theme: false })
    })
  })
  return view
}

/**
 * §7 keeps view-level coverage to a minimum — jsdom has no layout and these
 * tests get flaky fast. This one only proves the ViewPlugin is wired into the
 * decorations facet and reacts to selection changes.
 */
describe('the decoration plugin in a live view', () => {
  const decoCount = (v: EditorView): number => {
    let n = 0
    for (const set of v.state.facet(EditorView.decorations)) {
      const value = typeof set === 'function' ? set(v) : set
      value.between(0, v.state.doc.length, () => {
        n++
      })
    }
    return n
  }

  it('produces decorations for a live document', () => {
    const v = mount('**test** and more', 17)
    expect(decoCount(v)).toBeGreaterThan(0)
    expect(v.state.doc.toString()).toBe('**test** and more')
  })

  it('rebuilds when the selection moves', () => {
    const v = mount('**test** and more', 12)
    const before = decoCount(v)
    v.dispatch({ selection: EditorSelection.single(4) })
    const after = decoCount(v)
    // hidden markers (2 replaces) become visible markers (2 marks) — the
    // count is stable, but the set must have been rebuilt, so assert the
    // rendered text changed instead.
    expect(after).toBe(before)
    expect(v.contentDOM.textContent).toContain('**')
  })

  it('hides marker text in the rendered DOM', () => {
    const v = mount('**test** and more', 17)
    expect(v.contentDOM.textContent).not.toContain('**')
    expect(v.contentDOM.textContent).toContain('test')
  })
})
