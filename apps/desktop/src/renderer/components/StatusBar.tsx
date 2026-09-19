import { useSyncExternalStore } from 'react'
import type { EditorView } from '@codemirror/view'
import { editorSignal } from '../state/signals.js'
import type { DocMeta } from '../state/store.js'

const WORDS_PER_MINUTE = 220

/** Split so the folders can ellipsize while the file name stays whole. */
const splitPath = (path: string): [string, string] => {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1
  return [path.slice(0, cut), path.slice(cut)]
}

export interface StatusBarProps {
  doc: DocMeta | null
  view: EditorView | null
}

export function StatusBar({ doc, view }: StatusBarProps): React.ReactElement {
  useSyncExternalStore(editorSignal.subscribe, editorSignal.getSnapshot)

  const state = view?.state
  const text = state ? state.doc.toString() : ''
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  const head = state?.selection.main.head ?? 0
  const line = state?.doc.lineAt(head)
  const [dir, file] = doc?.path ? splitPath(doc.path) : ['', doc?.name ?? '']

  return (
    <footer className="statusbar">
      <span className={`status-save${doc?.dirty ? ' is-dirty' : ''}`}>
        {!doc ? 'No document' : doc.dirty ? 'Unsaved changes' : doc.path ? 'Saved to disk' : 'New'}
      </span>
      {doc ? (
        <span className="status-path" title={doc.path ?? doc.name}>
          {dir ? <span className="status-path-dir">{dir}</span> : null}
          <span className="status-path-name">{file}</span>
        </span>
      ) : null}
      <span className="status-sep" />
      <span>
        {words} {words === 1 ? 'word' : 'words'}
      </span>
      <span>{minutes} min read</span>
      <span className="status-spacer" />
      {line ? (
        <span>
          Ln {line.number}, Col {head - line.from + 1}
        </span>
      ) : null}
      <span className="status-lang">markdown</span>
    </footer>
  )
}
