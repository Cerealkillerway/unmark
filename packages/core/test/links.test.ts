// @vitest-environment jsdom
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { MOD_HELD_CLASS, urlAt } from '../src/links.js'
import { markdownSetup } from '../src/editor.js'
import { stateFrom } from './helpers.js'

const views: EditorView[] = []
afterEach(() => {
  for (const view of views.splice(0)) view.destroy()
})

const at = (doc: string, needle: string): number => doc.indexOf(needle)

describe('urlAt', () => {
  const state = (doc: string): EditorState => stateFrom(doc)

  it('finds the target from anywhere inside a link', () => {
    const doc = '[label](https://example.com)'
    const s = state(doc)
    expect(urlAt(s, at(doc, 'label'))).toBe('https://example.com')
    expect(urlAt(s, at(doc, 'https'))).toBe('https://example.com')
  })

  it('finds an autolink and a bare URL', () => {
    expect(urlAt(state('<https://a.test>'), 3)).toBe('https://a.test')
    expect(urlAt(state('see https://b.test now'), 8)).toBe('https://b.test')
  })

  it('finds an image source', () => {
    const doc = '![alt](/pic.png)'
    expect(urlAt(state(doc), at(doc, 'alt'))).toBe('/pic.png')
  })

  it('returns null for a reference link, which has no target to follow', () => {
    const doc = '[label][id]\n\n[id]: https://example.com'
    expect(urlAt(state(doc), at(doc, 'label'))).toBeNull()
  })

  it('returns null for plain prose', () => {
    expect(urlAt(state('just words here'), 5)).toBeNull()
  })
})

describe('Mod-click', () => {
  function mount(doc: string, opened: string[]): EditorView {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        selection: EditorSelection.single(0),
        extensions: markdownSetup({
          codeLanguages: [],
          theme: false,
          links: { openLink: (url) => opened.push(url) }
        })
      })
    })
    views.push(view)
    return view
  }

  /**
   * jsdom has no layout, so `posAtCoords` is stubbed to a known offset. These
   * assert on what was opened rather than on `defaultPrevented` — CodeMirror
   * preventDefaults every mousedown of its own accord, for selection.
   */
  const clickAt = (view: EditorView, pos: number, mods: Partial<MouseEventInit>): void => {
    Object.defineProperty(view, 'posAtCoords', { value: () => pos, configurable: true })
    view.contentDOM.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, ...mods })
    )
  }

  it('opens the link under the pointer', () => {
    const opened: string[] = []
    const doc = '[label](https://example.com)'
    const view = mount(doc, opened)
    clickAt(view, at(doc, 'label'), { ctrlKey: true })
    expect(opened).toEqual(['https://example.com'])
  })

  it('does nothing without the modifier — a plain click just moves the caret', () => {
    const opened: string[] = []
    const doc = '[label](https://example.com)'
    const view = mount(doc, opened)
    clickAt(view, at(doc, 'label'), {})
    expect(opened).toEqual([])
  })

  it('does nothing when the pointer is not on a link', () => {
    const opened: string[] = []
    const view = mount('plain words', opened)
    clickAt(view, 3, { ctrlKey: true })
    expect(opened).toEqual([])
  })

  it('marks the editor while Mod is held, so the affordance is visible', () => {
    const view = mount('[label](https://example.com)', [])
    view.contentDOM.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true, bubbles: true })
    )
    expect(view.dom.classList.contains(MOD_HELD_CLASS)).toBe(true)

    view.contentDOM.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', bubbles: true }))
    expect(view.dom.classList.contains(MOD_HELD_CLASS)).toBe(false)
  })
})
