import { createRef, useState, act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { EditorView } from '@codemirror/view'
import { MarkdownEditor, type MarkdownEditorHandle } from '../src/editor.js'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(node: ReactNode): void {
  act(() => root.render(node))
}

/**
 * A parent that re-renders on demand, passing a prop the editor does not use.
 * `bump` is captured on first render so the test can drive it.
 */
let bump: (() => void) | null = null

function Parent({ handle }: { handle: React.Ref<MarkdownEditorHandle> }): ReactNode {
  const [n, setN] = useState(0)
  bump = () => setN((v) => v + 1)
  return (
    <div data-count={n}>
      <MarkdownEditor
        ref={handle}
        defaultValue={'# Title\n\nSome **bold** prose.'}
        className={`editor-${n}`}
        codeLanguages={[]}
        theme={false}
      />
    </div>
  )
}

describe('I3 — the editor is uncontrolled', () => {
  it('survives 50 parent re-renders with the same view and the same caret', () => {
    const handle = createRef<MarkdownEditorHandle>()
    render(<Parent handle={handle} />)

    const view = handle.current!.view!
    expect(view).toBeTruthy()

    act(() => {
      view.dispatch({ selection: { anchor: 12 } })
    })
    const caret = view.state.selection.main.anchor
    const doc = handle.current!.getValue()

    for (let i = 0; i < 50; i++) act(() => bump!())

    expect(container.querySelector('[data-count]')?.getAttribute('data-count')).toBe('50')
    expect(handle.current!.view).toBe(view)
    expect(view.state.selection.main.anchor).toBe(caret)
    expect(handle.current!.getValue()).toBe(doc)
    // The unrelated prop really did reach the DOM — the re-renders were real.
    expect(container.querySelector('.editor-50')).toBeTruthy()
  })

  it('ignores a changed defaultValue — there is no `value` prop', () => {
    const handle = createRef<MarkdownEditorHandle>()
    render(<MarkdownEditor ref={handle} defaultValue="first" codeLanguages={[]} theme={false} />)
    render(<MarkdownEditor ref={handle} defaultValue="second" codeLanguages={[]} theme={false} />)
    expect(handle.current!.getValue()).toBe('first')
  })

  it('does not rebuild when onChange is a fresh closure every render', () => {
    const handle = createRef<MarkdownEditorHandle>()
    const draw = (): ReactNode => (
      <MarkdownEditor
        ref={handle}
        defaultValue="x"
        onChange={() => {}}
        codeLanguages={[]}
        theme={false}
      />
    )
    render(draw())
    const view = handle.current!.view
    for (let i = 0; i < 10; i++) render(draw())
    expect(handle.current!.view).toBe(view)
  })

  it('destroys the view on unmount', () => {
    const handle = createRef<MarkdownEditorHandle>()
    render(<MarkdownEditor ref={handle} defaultValue="x" codeLanguages={[]} theme={false} />)
    const view = handle.current!.view!
    const dom = view.dom
    act(() => root.unmount())
    root = createRoot(container)
    expect(dom.isConnected).toBe(false)
  })
})

describe('the imperative handle', () => {
  it('reports the document as it would be saved', () => {
    const handle = createRef<MarkdownEditorHandle>()
    render(
      <MarkdownEditor ref={handle} defaultValue={'a\r\nb'} codeLanguages={[]} theme={false} />
    )
    // I1: a CRLF file round-trips as CRLF, not as \n.
    expect(handle.current!.getValue()).toBe('a\r\nb')
  })

  it('setValue goes through a transaction, keeping the same view', () => {
    const handle = createRef<MarkdownEditorHandle>()
    render(<MarkdownEditor ref={handle} defaultValue="old" codeLanguages={[]} theme={false} />)
    const view = handle.current!.view
    act(() => handle.current!.setValue('new'))
    expect(handle.current!.getValue()).toBe('new')
    expect(handle.current!.view).toBe(view)
  })

  it('calls onChange with the serialized document', () => {
    const seen: string[] = []
    const handle = createRef<MarkdownEditorHandle>()
    render(
      <MarkdownEditor
        ref={handle}
        defaultValue=""
        onChange={(doc) => seen.push(doc)}
        codeLanguages={[]}
        theme={false}
      />
    )
    act(() => handle.current!.setValue('hello'))
    expect(seen).toEqual(['hello'])
  })

  it('refuses to replace the document during IME composition (I6)', () => {
    const handle = createRef<MarkdownEditorHandle>()
    render(<MarkdownEditor ref={handle} defaultValue="kana" codeLanguages={[]} theme={false} />)
    const view = handle.current!.view as EditorView & { composing: boolean }
    Object.defineProperty(view, 'composing', { value: true, configurable: true })
    act(() => handle.current!.setValue('replaced'))
    expect(handle.current!.getValue()).toBe('kana')
  })
})
