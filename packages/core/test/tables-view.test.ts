// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { markdownSetup } from '../src/editor.js'

/**
 * The one part of tables that needs a view: `--md-table-available`.
 *
 * Nothing inside `.cm-content` can see how wide the editor is — the content
 * element is capped at the prose measure — so the width is measured and
 * published as a CSS length for the theme to build on.
 */

let view: EditorView | null = null
afterEach(() => {
  view?.destroy()
  view = null
})

const DOC = ['| a | b |', '|---|---|', '| 1 | 2 |'].join('\n')

function mount(clientWidth: number): EditorView {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const created = new EditorView({
    state: EditorState.create({ doc: DOC, extensions: markdownSetup({ theme: false }) }),
    parent
  })
  // jsdom reports 0 for every layout box, so the measured width has to be
  // stood in for. This is the number the read phase would return in a browser.
  Object.defineProperty(created.scrollDOM, 'clientWidth', {
    value: clientWidth,
    configurable: true
  })
  return created
}

/** CodeMirror runs its measure phase on an animation frame; wait for one. */
const flushMeasure = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()))

describe('the available width', () => {
  it('publishes the editor width as a length', async () => {
    view = mount(1280)
    view.requestMeasure()
    await flushMeasure()
    expect(view.dom.style.getPropertyValue('--md-table-available')).toBe('1280px')
  })

  it('stays unset while the editor has no width', async () => {
    // Detached, hidden, or headless. Publishing `0px` would collapse every
    // expression built on it — `calc(0px - 3rem)` is a negative width, which
    // drops the declaration — so the fallback has to be left to stand.
    view = mount(0)
    view.requestMeasure()
    await flushMeasure()
    expect(view.dom.style.getPropertyValue('--md-table-available')).toBe('')
  })
})
