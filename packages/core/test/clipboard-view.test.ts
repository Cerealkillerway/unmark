// @vitest-environment jsdom
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { markdownSetup } from '../src/editor.js'
import { serializeDocument } from '../src/document.js'
import { CLIPBOARD_SENTINEL } from '../src/clipboard/index.js'

const views: EditorView[] = []
afterEach(() => {
  for (const view of views.splice(0)) view.destroy()
})

/** A DataTransfer stand-in — jsdom has no clipboard, and this is all we read. */
function transfer(initial: Record<string, string> = {}): DataTransfer & {
  dump: () => Record<string, string>
} {
  const store = new Map(Object.entries(initial))
  return {
    getData: (type: string) => store.get(type) ?? '',
    setData: (type: string, value: string) => void store.set(type, value),
    dump: () => Object.fromEntries(store)
  } as unknown as DataTransfer & { dump: () => Record<string, string> }
}

function mount(doc: string, from = 0, to = 0, htmlToMarkdown?: (html: string) => string): EditorView {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(from, to),
      extensions: markdownSetup({
        codeLanguages: [],
        theme: false,
        ...(htmlToMarkdown ? { clipboard: { htmlToMarkdown } } : {})
      })
    })
  })
  views.push(view)
  return view
}

function fire(view: EditorView, type: 'copy' | 'cut' | 'paste', data: DataTransfer): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: data })
  view.contentDOM.dispatchEvent(event)
  return event
}

describe('copy writes both flavours (§4.6)', () => {
  it('puts the raw markdown in text/plain and the rendered form in text/html', () => {
    const doc = 'A word that is **bold** here.'
    const view = mount(doc, doc.indexOf('**'), doc.indexOf('**') + 8)
    const data = transfer()
    const event = fire(view, 'copy', data)

    expect(event.defaultPrevented).toBe(true)
    expect(data.dump()['text/plain']).toBe('**bold**')
    expect(data.dump()['text/html']).toBe(
      `<span ${CLIPBOARD_SENTINEL}="1"><strong>bold</strong></span>`
    )
  })

  it('wraps a block selection in a div', () => {
    const doc = '# Heading\n\n- one\n- two'
    const view = mount(doc, 0, doc.length)
    const data = transfer()
    fire(view, 'copy', data)
    expect(data.dump()['text/html']).toBe(
      `<div ${CLIPBOARD_SENTINEL}="1"><h1>Heading</h1><ul><li>one</li><li>two</li></ul></div>`
    )
  })

  it('leaves an empty selection to CodeMirror rather than reimplementing linewise copy', () => {
    const view = mount('a line', 3, 3)
    const data = transfer()
    fire(view, 'copy', data)
    expect(data.dump()).toEqual({})
  })
})

describe('cut', () => {
  it('writes both flavours and removes the selection', () => {
    const doc = 'keep **cut me** keep'
    const view = mount(doc, 5, 15)
    const data = transfer()
    fire(view, 'cut', data)
    expect(data.dump()['text/plain']).toBe('**cut me**')
    expect(data.dump()['text/html']).toContain('<strong>cut me</strong>')
    expect(serializeDocument(view.state)).toBe('keep  keep')
  })
})

describe('paste', () => {
  const toMarkdown = (html: string): string => `converted(${html.length})`

  it('converts foreign HTML', () => {
    const view = mount('', 0, 0, toMarkdown)
    const event = fire(view, 'paste', transfer({ 'text/plain': 'x', 'text/html': '<b>x</b>' }))
    expect(event.defaultPrevented).toBe(true)
    expect(serializeDocument(view.state)).toBe('converted(8)')
  })

  /**
   * These assert on the document, not on `defaultPrevented`: when our handler
   * declines, CodeMirror's own paste handling takes over and preventDefaults
   * too. What matters is that the markdown arrived untransformed.
   */
  it('takes the plain-text path for our own HTML, so a self-paste round-trips', () => {
    const view = mount('', 0, 0, toMarkdown)
    fire(
      view,
      'paste',
      transfer({
        'text/plain': '**bold**',
        'text/html': `<span ${CLIPBOARD_SENTINEL}="1"><strong>bold</strong></span>`
      })
    )
    expect(serializeDocument(view.state)).toBe('**bold**')
  })

  it('inserts plain text verbatim when there is no HTML flavour', () => {
    const view = mount('', 0, 0, toMarkdown)
    fire(view, 'paste', transfer({ 'text/plain': '**as typed**' }))
    expect(serializeDocument(view.state)).toBe('**as typed**')
  })

  it('falls through when no converter was supplied', () => {
    const view = mount('', 0, 0)
    fire(view, 'paste', transfer({ 'text/plain': 'x', 'text/html': '<b>x</b>' }))
    expect(serializeDocument(view.state)).toBe('x')
  })

  it('does not convert during IME composition (I6)', () => {
    const view = mount('kana', 4, 4, toMarkdown)
    Object.defineProperty(view, 'composing', { value: true, configurable: true })
    fire(view, 'paste', transfer({ 'text/plain': '', 'text/html': '<b>x</b>' }))
    expect(serializeDocument(view.state)).not.toContain('converted')
  })

  it('replaces the selection rather than appending', () => {
    const view = mount('before XXX after', 7, 10, toMarkdown)
    fire(view, 'paste', transfer({ 'text/html': '<i>y</i>' }))
    expect(serializeDocument(view.state)).toBe('before converted(8) after')
  })
})
