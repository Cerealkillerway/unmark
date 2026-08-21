import { useSyncExternalStore } from 'react'
import { syntaxTree } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'
import { editorSignal } from '../state/signals.js'

interface Heading {
  from: number
  level: number
  text: string
}

const ATX = /^(#{1,6})\s+(.*?)\s*#*\s*$/

/**
 * Read straight off the syntax tree the editor already maintains — no second
 * parse, no document model. I1: there is nothing to derive from but the text.
 */
function headings(view: EditorView | null): Heading[] {
  if (!view) return []
  const out: Heading[] = []
  const tree = syntaxTree(view.state)
  tree.iterate({
    enter: (node) => {
      const atx = /^ATXHeading([1-6])$/.exec(node.name)
      if (atx) {
        const text = view.state.doc.sliceString(node.from, node.to)
        const match = ATX.exec(text)
        out.push({ from: node.from, level: Number(atx[1]), text: match?.[2] ?? text })
        return false
      }
      const setext = /^SetextHeading([12])$/.exec(node.name)
      if (setext) {
        const first = view.state.doc.lineAt(node.from)
        out.push({ from: node.from, level: Number(setext[1]), text: first.text.trim() })
        return false
      }
      return undefined
    }
  })
  return out
}

export interface OutlineProps {
  view: EditorView | null
}

export function Outline({ view }: OutlineProps): React.ReactElement {
  useSyncExternalStore(editorSignal.subscribe, editorSignal.getSnapshot)

  const items = headings(view)
  const caret = view?.state.selection.main.head ?? 0
  let currentIndex = -1
  for (const [index, item] of items.entries()) if (item.from <= caret) currentIndex = index

  const selection = view?.state.selection.main
  const atCaret = view && selection ? describeCaret(view) : null

  return (
    <aside className="outline">
      <section className="panel">
        <h2 className="panel-title">Outline</h2>
        <div className="outline-list">
          {items.length === 0 ? <p className="panel-empty">No headings yet.</p> : null}
          {items.map((item, index) => (
            <button
              key={`${item.from}`}
              type="button"
              className={`outline-item${index === currentIndex ? ' is-current' : ''}`}
              style={{ paddingLeft: 10 + (item.level - 1) * 10 }}
              onClick={() => {
                view?.dispatch({ selection: { anchor: item.from }, scrollIntoView: true })
                view?.focus()
              }}
            >
              {item.text || 'Untitled heading'}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">At caret</h2>
        {atCaret ? (
          <>
            <code className="caret-source">{atCaret.source || '—'}</code>
            <p className="caret-detail">{atCaret.detail}</p>
          </>
        ) : (
          <p className="panel-empty">—</p>
        )}
      </section>
    </aside>
  )
}

/** The innermost inline node under the caret, and where it sits. */
function describeCaret(view: EditorView): { source: string; detail: string } {
  const { state } = view
  const pos = state.selection.main.head
  const line = state.doc.lineAt(pos)
  let node = syntaxTree(state).resolveInner(pos, -1)
  let named = node.name
  for (let cursor: typeof node | null = node; cursor; cursor = cursor.parent) {
    if (cursor.name !== 'Document' && cursor.name !== 'Paragraph') {
      node = cursor
      named = cursor.name
      break
    }
  }
  const source = state.doc.sliceString(node.from, Math.min(node.to, node.from + 60))
  const label = named.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return {
    source,
    detail: `${label} · line ${line.number} · col ${pos - line.from + 1}`
  }
}
