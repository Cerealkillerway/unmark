import { describe, expect, it } from 'vitest'
import { DocumentStore } from '../src/renderer/state/store.js'

describe('DocumentStore', () => {
  it('tracks dirty state against the bytes last agreed with disk', () => {
    const store = new DocumentStore()
    const doc = store.open('/tmp/a.md', 'hello')
    expect(doc.dirty).toBe(false)

    store.setContent(doc.id, 'hello!')
    expect(store.find(doc.id)?.dirty).toBe(true)

    // Typing back to the saved text is not a change.
    store.setContent(doc.id, 'hello')
    expect(store.find(doc.id)?.dirty).toBe(false)
  })

  it('emits only when a visible field changes, not on every keystroke', () => {
    const store = new DocumentStore()
    const doc = store.open('/tmp/a.md', '')
    let emits = 0
    store.subscribe(() => emits++)

    store.setContent(doc.id, 'a')
    expect(emits).toBe(1)
    store.setContent(doc.id, 'ab')
    store.setContent(doc.id, 'abc')
    expect(emits).toBe(1)
  })

  it('brings an already-open file forward instead of opening it twice', () => {
    const store = new DocumentStore()
    const first = store.open('/tmp/a.md', 'x')
    store.open('/tmp/b.md', 'y')
    const again = store.open('/tmp/a.md', 'x')
    expect(again.id).toBe(first.id)
    expect(store.getSnapshot().docs.length).toBe(2)
    expect(store.getSnapshot().activeId).toBe(first.id)
  })

  it('adopts the new path and name on save-as', () => {
    const store = new DocumentStore()
    const doc = store.create()
    store.setContent(doc.id, '# hi')
    store.markSaved(doc.id, '/tmp/notes/hi.md')
    expect(store.find(doc.id)).toMatchObject({ name: 'hi.md', path: '/tmp/notes/hi.md', dirty: false })
  })

  it('clears the conflict flag on reload and keeps the disk bytes', () => {
    const store = new DocumentStore()
    const doc = store.open('/tmp/a.md', 'one')
    store.setContent(doc.id, 'one edited')
    store.setConflict(doc.id, true)

    store.reload(doc.id, 'two')
    expect(store.content(doc.id)).toBe('two')
    expect(store.savedContent(doc.id)).toBe('two')
    expect(store.find(doc.id)).toMatchObject({ dirty: false, conflict: false })
  })

  it('activates a neighbour when the active tab closes', () => {
    const store = new DocumentStore()
    const a = store.open('/tmp/a.md', '')
    const b = store.open('/tmp/b.md', '')
    const c = store.open('/tmp/c.md', '')
    store.activate(b.id)
    store.close(b.id)
    expect(store.getSnapshot().activeId).toBe(c.id)
    store.close(c.id)
    expect(store.getSnapshot().activeId).toBe(a.id)
  })

  it('wraps around when stepping through tabs', () => {
    const store = new DocumentStore()
    const a = store.open('/tmp/a.md', '')
    const b = store.open('/tmp/b.md', '')
    store.activate(a.id)
    store.step(-1)
    expect(store.getSnapshot().activeId).toBe(b.id)
    store.step(1)
    expect(store.getSnapshot().activeId).toBe(a.id)
  })
})
