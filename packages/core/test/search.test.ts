// @vitest-environment jsdom
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getSearchQuery, setSearchQuery, SearchQuery } from '@codemirror/search'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultCommands, markdownSetup } from '../src/editor.js'
import { findPanelOpen, matchTally, searchInstalledIn, tallyLabel } from '../src/search.js'
import { renderedUnits, tablesIn } from '../src/decorations/tables.js'
import type { CommandContext } from '../src/commands/types.js'

/**
 * Find. The matching is `@codemirror/search`; what is worth testing here is
 * the wiring — that the keys come from the registry (I4) rather than from
 * `searchKeymap`, and that a match inside a drawn table row can be reached.
 */

let view: EditorView | null = null
afterEach(() => {
  view?.destroy()
  view = null
})

function mount(doc: string, search: false | Record<string, unknown> = {}): EditorView {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({
    state: EditorState.create({ doc, extensions: markdownSetup({ search: search as never }) }),
    parent
  })
}

const ctx = (v: EditorView | null): CommandContext => ({ view: v, app: {} })

const run = (id: string, v: EditorView | null): boolean =>
  defaultCommands().run(id, ctx(v))

describe('the registry owns the find keys', () => {
  it('registers find alongside every other command', () => {
    const ids = defaultCommands()
      .all()
      .map((command) => command.id)
    expect(ids).toContain('edit.find')
    expect(ids).toContain('edit.findNext')
    expect(ids).toContain('edit.findPrevious')
  })

  it('binds Mod-f and files it under Edit, scoped to the editor', () => {
    const find = defaultCommands()
      .all()
      .find((command) => command.id === 'edit.find')!
    expect(find.keys).toEqual(['Mod-f'])
    expect(find.category).toBe('Edit')
    // §4.3 and trap #4: an app-scoped accelerator is registered with the OS
    // and would stop CodeMirror ever seeing Mod-f.
    expect(find.scope).toBe('editor')
  })

  it('reports the find commands disabled when search is not configured', () => {
    view = mount('hello', false)
    expect(searchInstalledIn(view.state)).toBe(false)
    const described = defaultCommands()
      .describe(ctx(view))
      .filter((command) => command.id.startsWith('edit.find'))
    expect(described.length).toBeGreaterThan(0)
    // Disabled, not absent: the menu should say the action exists.
    expect(described.every((command) => !command.enabled)).toBe(true)
  })
})

describe('the panel', () => {
  it('opens on the find command and closes on Escape', () => {
    view = mount('one two one')
    expect(findPanelOpen(view.state)).toBe(false)

    run('edit.find', view)
    expect(findPanelOpen(view.state)).toBe(true)

    run('edit.closeFind', view)
    expect(findPanelOpen(view.state)).toBe(false)
  })

  it('leaves Escape alone while the panel is shut', () => {
    // Otherwise this binding would swallow every Escape in the editor, and
    // Escape is how you leave a multi-cursor selection.
    view = mount('one two one')
    const close = defaultCommands()
      .all()
      .find((command) => command.id === 'edit.closeFind')!
    expect(close.when!(ctx(view))).toBe(false)
  })
})

describe('finding', () => {
  it('moves the selection to the next occurrence and wraps', () => {
    view = mount('alpha beta alpha')
    view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: 'alpha' })) })
    expect(getSearchQuery(view.state).search).toBe('alpha')

    view.dispatch({ selection: EditorSelection.single(0) })

    // The search starts at the end of the current selection, so an empty one
    // at the top of the document finds the match that begins there.
    run('edit.findNext', view)
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
      'alpha'
    )
    expect(view.state.selection.main.from).toBe(0)

    run('edit.findNext', view)
    expect(view.state.selection.main.from).toBe(11)

    // Past the last match it comes back round to the first.
    run('edit.findNext', view)
    expect(view.state.selection.main.from).toBe(0)

    run('edit.findPrevious', view)
    expect(view.state.selection.main.from).toBe(11)
  })
})

describe('a match inside a drawn table', () => {
  const DOC = ['| Fruit | Colour |', '| ----- | ------ |', '| apple | red    |', '', 'after'].join(
    '\n'
  )

  it('turns the row back into markdown when the match is selected', () => {
    view = mount(DOC)
    view.dispatch({ selection: EditorSelection.single(view.state.doc.length) })

    // The body row is drawn, so its text is not on screen as text.
    const drawnBefore = renderedUnits(view.state, tablesIn(view.state)).map(
      (unit) => view!.state.doc.lineAt(unit.span.from).number
    )
    expect(drawnBefore).toContain(3)

    view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: 'apple' })) })
    view.dispatch({ selection: EditorSelection.single(0) })
    run('edit.findNext', view)

    // The selection landed on the match...
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
      'apple'
    )
    // ...and the reveal rule took that row out of the drawn set in the same
    // breath, so what is scrolled to is real text rather than a widget.
    const drawnAfter = renderedUnits(view.state, tablesIn(view.state)).map(
      (unit) => view!.state.doc.lineAt(unit.span.from).number
    )
    expect(drawnAfter).not.toContain(3)
  })
})

describe('the match count', () => {
  const tally = (doc: string, at: [number, number], search: string, limit?: number) => {
    const state = EditorState.create({
      doc,
      selection: { anchor: at[0], head: at[1] },
      extensions: markdownSetup()
    })
    return matchTally(state, new SearchQuery({ search }), limit)
  }

  it('counts every occurrence and says which one is selected', () => {
    // "one" at 0, 8 and 12.
    const doc = 'one two one one'
    expect(tally(doc, [0, 3], 'one')).toEqual({ total: 3, current: 1, capped: false })
    expect(tally(doc, [8, 11], 'one')).toEqual({ total: 3, current: 2, capped: false })
    expect(tally(doc, [12, 15], 'one')).toEqual({ total: 3, current: 3, capped: false })
  })

  it('reports no current match when the selection is merely inside one', () => {
    // A caret resting in a match has not arrived at it; this is the number
    // that should advance on Enter, and Enter would move to the first match.
    expect(tally('one two one', [1, 1], 'one').current).toBe(0)
    expect(tally('one two one', [1, 1], 'one').total).toBe(2)
  })

  it('honours the query flags rather than matching on its own terms', () => {
    const state = EditorState.create({ doc: 'Cat cat CAT', extensions: markdownSetup() })
    expect(matchTally(state, new SearchQuery({ search: 'cat' })).total).toBe(3)
    expect(
      matchTally(state, new SearchQuery({ search: 'cat', caseSensitive: true })).total
    ).toBe(1)
    expect(matchTally(state, new SearchQuery({ search: 'c.t', regexp: true })).total).toBe(3)
  })

  it('stops at the limit instead of scanning an unbounded number of matches', () => {
    const counted = tally('x'.repeat(50), [0, 0], 'x', 10)
    expect(counted).toEqual({ total: 10, current: 0, capped: true })
  })

  it('says nothing for an empty or invalid query', () => {
    const state = EditorState.create({ doc: 'abc', extensions: markdownSetup() })
    const empty = new SearchQuery({ search: '' })
    expect(matchTally(state, empty)).toEqual({ total: 0, current: 0, capped: false })
    expect(tallyLabel(empty, matchTally(state, empty))).toBe('')
  })

  it('reads as i/N, or as words when there is nothing to number', () => {
    const query = new SearchQuery({ search: 'one' })
    expect(tallyLabel(query, { total: 3, current: 2, capped: false })).toBe('2/3')
    expect(tallyLabel(query, { total: 0, current: 0, capped: false })).toBe('No results')
    // A capped count is a floor, and says so.
    expect(tallyLabel(query, { total: 500, current: 1, capped: true })).toBe('1/500+')
  })
})

describe('the panel DOM', () => {
  it('shows the counter and updates it as the selection moves', () => {
    view = mount('one two one')
    run('edit.find', view)

    const counter = view.dom.querySelector('.cm-md-find-count')!
    const field = view.dom.querySelector('.cm-md-find-input') as HTMLInputElement
    expect(counter.textContent).toBe('')

    // Typing into the field is what commits the query.
    field.value = 'one'
    field.dispatchEvent(new Event('input'))
    expect(counter.textContent).toBe('0/2')

    run('edit.findNext', view)
    expect(counter.textContent).toBe('1/2')

    run('edit.findNext', view)
    expect(counter.textContent).toBe('2/2')
  })

  it('drops the replace row in a read-only editor', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    view = new EditorView({
      state: EditorState.create({
        doc: 'one',
        extensions: [markdownSetup(), EditorState.readOnly.of(true)]
      }),
      parent
    })
    run('edit.find', view)
    expect(view.dom.querySelectorAll('.cm-md-find-row')).toHaveLength(1)
  })
})
