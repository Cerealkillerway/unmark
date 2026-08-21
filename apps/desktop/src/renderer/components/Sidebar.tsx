import { useCallback, useEffect, useState } from 'react'
import type { FolderEntry } from '@shared/ipc.js'

interface NodeProps {
  entry: FolderEntry
  depth: number
  activePath: string | null
  onOpen: (path: string) => void
}

function Node({ entry, depth, activePath, onOpen }: NodeProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState<readonly FolderEntry[] | null>(null)

  useEffect(() => {
    if (!open || children) return
    let cancelled = false
    void window.api.listFolder(entry.path).then((listing) => {
      if (!cancelled) setChildren(listing.entries)
    })
    return () => {
      cancelled = true
    }
  }, [open, children, entry.path])

  if (!entry.directory) {
    const [stem, ...rest] = entry.name.split('.')
    return (
      <button
        type="button"
        className={`tree-file${entry.path === activePath ? ' is-active' : ''}`}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => onOpen(entry.path)}
        title={entry.path}
      >
        <span className="tree-name">{stem}</span>
        {rest.length ? <span className="tree-ext">{rest.join('.')}</span> : null}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className="tree-dir"
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="tree-caret">{open ? '⌄' : '›'}</span>
        <span className="tree-name">{entry.name}</span>
      </button>
      {open
        ? (children ?? []).map((child) => (
            <Node
              key={child.path}
              entry={child}
              depth={depth + 1}
              activePath={activePath}
              onOpen={onOpen}
            />
          ))
        : null}
    </>
  )
}

export interface SidebarProps {
  folder: string | null
  activePath: string | null
  recent: readonly { id: string; name: string; path: string | null }[]
  onOpenPath: (path: string) => void
  onOpenFolder: () => void
  onSelectDoc: (id: string) => void
}

export function Sidebar({
  folder,
  activePath,
  recent,
  onOpenPath,
  onOpenFolder,
  onSelectDoc
}: SidebarProps): React.ReactElement {
  const [entries, setEntries] = useState<readonly FolderEntry[]>([])

  const load = useCallback((path: string) => {
    void window.api.listFolder(path).then((listing) => setEntries(listing.entries))
  }, [])

  useEffect(() => {
    if (folder) load(folder)
    else setEntries([])
  }, [folder, load])

  return (
    <aside className="sidebar">
      <section className="panel">
        <h2 className="panel-title">Files</h2>
        {folder ? (
          <div className="tree">
            {entries.map((entry) => (
              <Node
                key={entry.path}
                entry={entry}
                depth={0}
                activePath={activePath}
                onOpen={onOpenPath}
              />
            ))}
          </div>
        ) : (
          <button type="button" className="panel-action" onClick={onOpenFolder}>
            Open a folder…
          </button>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Open</h2>
        <div className="tree">
          {recent.map((doc) => (
            <button
              key={doc.id}
              type="button"
              className={`tree-file${doc.path === activePath ? ' is-active' : ''}`}
              onClick={() => onSelectDoc(doc.id)}
              title={doc.path ?? doc.name}
            >
              <span className="tree-name">{doc.name}</span>
            </button>
          ))}
        </div>
      </section>

      <p className="panel-note">
        <strong>Local.</strong> Files on disk. No account, no sync daemon.
      </p>
    </aside>
  )
}
