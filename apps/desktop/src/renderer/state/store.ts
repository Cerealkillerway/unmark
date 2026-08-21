/**
 * The document model.
 *
 * Deliberately *not* the markdown itself: I1 says the EditorState doc is the
 * document, so the text lives in CodeMirror and this store only tracks what
 * the chrome needs — which files are open, which is active, what is dirty,
 * and what the bytes on disk were last time we agreed with them.
 */

export interface DocMeta {
  readonly id: string
  /** null until the document has been saved somewhere. */
  readonly path: string | null
  readonly name: string
  readonly dirty: boolean
  /** Something else wrote this file while we had it open. */
  readonly conflict: boolean
}

export interface Snapshot {
  readonly docs: readonly DocMeta[]
  readonly activeId: string | null
  readonly folder: string | null
}

interface Body {
  saved: string
  current: string
}

const basename = (path: string): string => path.split(/[\\/]/).pop() || path

let counter = 0
const nextId = (): string => `doc-${++counter}`

export class DocumentStore {
  #docs: DocMeta[] = []
  #activeId: string | null = null
  #folder: string | null = null
  #bodies = new Map<string, Body>()
  #listeners = new Set<() => void>()
  #snapshot: Snapshot = { docs: [], activeId: null, folder: null }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  /** Referentially stable between changes — useSyncExternalStore requires it. */
  getSnapshot = (): Snapshot => this.#snapshot

  #emit(): void {
    this.#snapshot = { docs: this.#docs, activeId: this.#activeId, folder: this.#folder }
    for (const listener of this.#listeners) listener()
  }

  #replace(id: string, patch: Partial<DocMeta>): void {
    const index = this.#docs.findIndex((doc) => doc.id === id)
    if (index < 0) return
    const next = [...this.#docs]
    next[index] = { ...next[index]!, ...patch }
    this.#docs = next
    this.#emit()
  }

  get count(): number {
    return this.#docs.length
  }

  get active(): DocMeta | null {
    return this.#docs.find((doc) => doc.id === this.#activeId) ?? null
  }

  find(id: string): DocMeta | null {
    return this.#docs.find((doc) => doc.id === id) ?? null
  }

  byPath(path: string): DocMeta | null {
    return this.#docs.find((doc) => doc.path === path) ?? null
  }

  create(name = 'Untitled'): DocMeta {
    const doc: DocMeta = { id: nextId(), path: null, name, dirty: false, conflict: false }
    this.#bodies.set(doc.id, { saved: '', current: '' })
    this.#docs = [...this.#docs, doc]
    this.#activeId = doc.id
    this.#emit()
    return doc
  }

  /** Opening a file that is already open just brings its tab forward. */
  open(path: string, content: string): DocMeta {
    const existing = this.byPath(path)
    if (existing) {
      this.activate(existing.id)
      return existing
    }
    const doc: DocMeta = {
      id: nextId(),
      path,
      name: basename(path),
      dirty: false,
      conflict: false
    }
    this.#bodies.set(doc.id, { saved: content, current: content })
    // An untouched, unnamed, empty buffer is scaffolding, not a document.
    // Opening a real file should replace it rather than leave a stray tab.
    const pristine = this.#docs.filter(
      (other) => other.path === null && !other.dirty && this.content(other.id) === ''
    )
    for (const stray of pristine) this.#bodies.delete(stray.id)
    this.#docs = [...this.#docs.filter((other) => !pristine.includes(other)), doc]
    this.#activeId = doc.id
    this.#emit()
    return doc
  }

  close(id: string): void {
    const index = this.#docs.findIndex((doc) => doc.id === id)
    if (index < 0) return
    this.#docs = this.#docs.filter((doc) => doc.id !== id)
    this.#bodies.delete(id)
    if (this.#activeId === id) {
      this.#activeId = (this.#docs[index] ?? this.#docs[index - 1] ?? null)?.id ?? null
    }
    this.#emit()
  }

  activate(id: string): void {
    if (this.#activeId === id || !this.find(id)) return
    this.#activeId = id
    this.#emit()
  }

  step(delta: number): void {
    if (this.#docs.length < 2) return
    const index = this.#docs.findIndex((doc) => doc.id === this.#activeId)
    const next = this.#docs[(index + delta + this.#docs.length) % this.#docs.length]
    if (next) this.activate(next.id)
  }

  content(id: string): string {
    return this.#bodies.get(id)?.current ?? ''
  }

  savedContent(id: string): string {
    return this.#bodies.get(id)?.saved ?? ''
  }

  /**
   * Called on every keystroke, so it re-renders only when the *dirty flag*
   * flips — not when the text changes.
   */
  setContent(id: string, text: string): void {
    const body = this.#bodies.get(id)
    if (!body) return
    body.current = text
    const dirty = body.current !== body.saved
    const doc = this.find(id)
    if (doc && doc.dirty !== dirty) this.#replace(id, { dirty })
  }

  markSaved(id: string, path?: string): void {
    const body = this.#bodies.get(id)
    if (body) body.saved = body.current
    this.#replace(id, {
      dirty: false,
      conflict: false,
      ...(path ? { path, name: basename(path) } : {})
    })
  }

  /** Adopt what is now on disk, discarding local edits. */
  reload(id: string, content: string): void {
    const body = this.#bodies.get(id)
    if (body) {
      body.saved = content
      body.current = content
    }
    this.#replace(id, { dirty: false, conflict: false })
  }

  setConflict(id: string, conflict: boolean): void {
    if (this.find(id)?.conflict !== conflict) this.#replace(id, { conflict })
  }

  setFolder(folder: string | null): void {
    this.#folder = folder
    this.#emit()
  }
}
