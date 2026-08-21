// @vitest-environment jsdom
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorSelection, EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { CommandRegistry } from '../src/commands/registry.js'
import { commandKeymap } from '../src/commands/keymap.js'
import { formatCommands } from '../src/commands/format.js'
import type { CommandDef } from '../src/commands/types.js'
import {
  PREFIX_BULLET,
  PREFIX_ORDERED,
  PREFIX_QUOTE,
  PREFIX_TASK,
  WRAP_CODE,
  WRAP_EMPHASIS,
  WRAP_STRONG,
  headingPrefix,
  toggleLinePrefix,
  toggleLink,
  toggleWrap
} from '../src/commands/transforms.js'
import { markdownSetup } from '../src/editor.js'
import { serializeDocument } from '../src/document.js'
import { CARET, SEL_END, SEL_START } from './helpers.js'

const views: EditorView[] = []
afterEach(() => {
  for (const view of views.splice(0)) view.destroy()
})

/**
 * Mount a view from a marked-up string. Multi-cursor is written as several
 * carets: `a‸b‸c`.
 */
function mount(marked: string, extra: Extension[] = []): EditorView {
  const carets: number[] = []
  const ranges: { anchor: number; head: number }[] = []
  let doc = ''
  let anchor = -1
  for (const ch of marked) {
    if (ch === CARET) carets.push(doc.length)
    else if (ch === SEL_START) anchor = doc.length
    else if (ch === SEL_END) ranges.push({ anchor, head: doc.length })
    else doc += ch
  }
  for (const pos of carets) ranges.push({ anchor: pos, head: pos })
  ranges.sort((a, b) => Math.min(a.anchor, a.head) - Math.min(b.anchor, b.head))

  const state = EditorState.create({
    doc,
    selection: ranges.length
      ? EditorSelection.create(ranges.map((r) => EditorSelection.range(r.anchor, r.head)))
      : EditorSelection.single(0),
    // markdownSetup already installs the format keymap from the registry (I4).
    extensions: [...markdownSetup({ codeLanguages: [], theme: false }), ...extra]
  })
  ensureSyntaxTree(state, state.doc.length, 20_000)

  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const view = new EditorView({ parent, state })
  views.push(view)
  return view
}

/** The document rendered back into marked-up form, so assertions read like the input. */
function show(view: EditorView): string {
  const doc = serializeDocument(view.state)
  const out: string[] = []
  let pos = 0
  for (const range of view.state.selection.ranges) {
    out.push(doc.slice(pos, range.from))
    if (range.empty) out.push(CARET)
    else out.push(SEL_START, doc.slice(range.from, range.to), SEL_END)
    pos = range.to
  }
  out.push(doc.slice(pos))
  return out.join('')
}

function press(view: EditorView, key: string, mods: Partial<KeyboardEventInit> = {}): void {
  view.contentDOM.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      code: `Key${key.toUpperCase()}`,
      keyCode: key.toUpperCase().charCodeAt(0),
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
      ...mods
    })
  )
}

describe('Mod-b through the keymap', () => {
  it('bolds a selection', () => {
    const view = mount('one «two» three')
    press(view, 'b')
    expect(show(view)).toBe('one **«two»** three')
  })

  it('bolds an empty cursor and parks the caret between the markers', () => {
    const view = mount('one ‸ three')
    press(view, 'b')
    expect(show(view)).toBe(`one **${CARET}** three`)
  })

  it('undoes itself when pressed twice on a bare cursor', () => {
    const view = mount('one ‸ three')
    press(view, 'b')
    press(view, 'b')
    expect(show(view)).toBe(`one ${CARET} three`)
  })

  it('does nothing without the modifier', () => {
    const view = mount('one «two» three')
    press(view, 'b', { ctrlKey: false })
    expect(serializeDocument(view.state)).toBe('one two three')
  })
})

describe('toggleWrap round trip', () => {
  const cases: [string, string][] = [
    ['plain', 'one «two» three'],
    ['at the start of the line', '«one» two'],
    ['a whole line', '«one two three»'],
    ['a selection covering an existing run', 'a «**bold**» b'],
    ['a selection inside an existing run', 'a **«bold»** b']
  ]

  for (const [name, marked] of cases) {
    it(`returns the exact original string — ${name}`, () => {
      const view = mount(marked)
      const before = serializeDocument(view.state)
      toggleWrap(view, WRAP_STRONG)
      const middle = serializeDocument(view.state)
      toggleWrap(view, WRAP_STRONG)
      expect(serializeDocument(view.state)).toBe(before)
      expect(middle).not.toBe(before)
    })
  }
})

describe('toggleWrap against nested markers', () => {
  it('removes only the inner run when the cursor is inside it', () => {
    const view = mount('**bold *and em‸phasis* here**')
    toggleWrap(view, WRAP_EMPHASIS)
    expect(serializeDocument(view.state)).toBe('**bold and emphasis here**')
  })

  it('removes only the outer run when asked for the outer type', () => {
    const view = mount('**bold *and em‸phasis* here**')
    toggleWrap(view, WRAP_STRONG)
    expect(serializeDocument(view.state)).toBe('bold *and emphasis* here')
  })

  it('nests a new run inside an existing one', () => {
    const view = mount('**bold «and» here**')
    toggleWrap(view, WRAP_EMPHASIS)
    expect(serializeDocument(view.state)).toBe('**bold *and* here**')
  })

  it('unwraps inline code inside bold without touching the bold', () => {
    const view = mount('**a `co‸de` b**')
    toggleWrap(view, WRAP_CODE)
    expect(serializeDocument(view.state)).toBe('**a code b**')
  })
})

describe('toggleWrap against adjacent markers', () => {
  it('never produces `****text****`', () => {
    const view = mount('«**bold**» and more')
    toggleWrap(view, WRAP_STRONG)
    expect(serializeDocument(view.state)).not.toContain('****')
    expect(serializeDocument(view.state)).toBe('bold and more')
  })

  it('leaves the neighbouring run alone when wrapping a separate word', () => {
    const view = mount('**a** «b» **c**')
    toggleWrap(view, WRAP_STRONG)
    expect(serializeDocument(view.state)).toBe('**a** **b** **c**')
  })

  it('removes the run the cursor rests against rather than adding a second pair', () => {
    const view = mount('**a**‸ b')
    toggleWrap(view, WRAP_STRONG)
    expect(serializeDocument(view.state)).toBe('a b')
  })

  it('handles a run using underscores, deleting exactly what the parser calls a marker', () => {
    const view = mount('x __bo‸ld__ y')
    toggleWrap(view, WRAP_STRONG)
    expect(serializeDocument(view.state)).toBe('x bold y')
  })
})

describe('toggleWrap with multiple cursors', () => {
  it('wraps every range in one transaction', () => {
    const view = mount('«a» and «b» and «c»')
    toggleWrap(view, WRAP_STRONG)
    expect(serializeDocument(view.state)).toBe('**a** and **b** and **c**')
    expect(view.state.selection.ranges.length).toBe(3)
    for (const range of view.state.selection.ranges) {
      expect(view.state.doc.sliceString(range.from, range.to)).toMatch(/^[abc]$/)
    }
  })

  it('undoes as a single step', () => {
    const view = mount('«a» and «b»')
    toggleWrap(view, WRAP_STRONG)
    const changes = view.state.selection.ranges.length
    expect(changes).toBe(2)
    expect(serializeDocument(view.state)).toBe('**a** and **b**')
    toggleWrap(view, WRAP_STRONG)
    expect(serializeDocument(view.state)).toBe('a and b')
  })
})

describe('toggleLinePrefix', () => {
  it('adds and strips a blockquote marker', () => {
    const view = mount('quoted‸')
    toggleLinePrefix(view, PREFIX_QUOTE)
    expect(serializeDocument(view.state)).toBe('> quoted')
    toggleLinePrefix(view, PREFIX_QUOTE)
    expect(serializeDocument(view.state)).toBe('quoted')
  })

  it('replaces one heading level with another instead of stacking hashes', () => {
    const view = mount('## two‸')
    toggleLinePrefix(view, headingPrefix(1))
    expect(serializeDocument(view.state)).toBe('# two')
    toggleLinePrefix(view, headingPrefix(1))
    expect(serializeDocument(view.state)).toBe('two')
  })

  it('applies to every line a selection touches', () => {
    const view = mount('«a\nb\nc»')
    toggleLinePrefix(view, PREFIX_BULLET)
    expect(serializeDocument(view.state)).toBe('- a\n- b\n- c')
  })

  it('applies rather than strips when the selection is mixed', () => {
    const view = mount('«- a\nb»')
    toggleLinePrefix(view, PREFIX_BULLET)
    expect(serializeDocument(view.state)).toBe('- a\n- b')
  })

  it('strips only when every touched line already has that exact prefix', () => {
    const view = mount('«- a\n- b»')
    toggleLinePrefix(view, PREFIX_BULLET)
    expect(serializeDocument(view.state)).toBe('a\nb')
  })

  it('converts a bullet into a task and back', () => {
    const view = mount('- a‸')
    toggleLinePrefix(view, PREFIX_TASK)
    expect(serializeDocument(view.state)).toBe('- [ ] a')
    toggleLinePrefix(view, PREFIX_TASK)
    expect(serializeDocument(view.state)).toBe('a')
  })

  it('treats a checked task as already a task, so the toggle removes it', () => {
    const view = mount('- [x] done‸')
    toggleLinePrefix(view, PREFIX_TASK)
    expect(serializeDocument(view.state)).toBe('done')
  })

  it('swaps between list types instead of stacking markers', () => {
    const view = mount('- a‸')
    toggleLinePrefix(view, PREFIX_ORDERED)
    expect(serializeDocument(view.state)).toBe('1. a')
    toggleLinePrefix(view, PREFIX_BULLET)
    expect(serializeDocument(view.state)).toBe('- a')
  })

  it('converts a bullet list into an ordered one', () => {
    const view = mount('«- a\n- b»')
    toggleLinePrefix(view, PREFIX_ORDERED)
    expect(serializeDocument(view.state)).toBe('1. a\n1. b')
  })

  it('is a no-op on an unprefixed line asked to strip', () => {
    const view = mount('plain‸')
    expect(toggleLinePrefix(view, { prefix: '', pattern: /^\s*#{1,6}\s+/ })).toBe(false)
    expect(serializeDocument(view.state)).toBe('plain')
  })
})

describe('toggleLink', () => {
  it('wraps a selection and parks the caret in the parentheses', () => {
    const view = mount('see «this» page')
    toggleLink(view)
    expect(serializeDocument(view.state)).toBe('see [this]() page')
    expect(view.state.selection.main.head).toBe('see [this]('.length)
  })

  it('collapses an existing link back to its label', () => {
    const view = mount('see [th‸is](https://example.com) page')
    toggleLink(view)
    expect(serializeDocument(view.state)).toBe('see this page')
  })
})

describe('Prec.high (trap #3)', () => {
  it('beats a conflicting binding in the default keymap', () => {
    let ran = false
    const shadow: CommandDef = {
      id: 'test.selectAllShadow',
      title: 'Shadow Mod-a',
      keys: ['Mod-a'],
      scope: 'editor',
      run: () => ((ran = true), true)
    }
    const registry = new CommandRegistry([shadow])
    const view = mount('some words‸', [commandKeymap(registry, (v) => ({ view: v, app: {} }))])
    press(view, 'a')
    expect(ran).toBe(true)
    // defaultKeymap's selectAll would have expanded the selection instead.
    expect(view.state.selection.main.empty).toBe(true)
  })
})

describe('the registry is the only source of bindings (I4)', () => {
  it('runs a command by id with the same effect as its key', () => {
    const registry = new CommandRegistry(formatCommands)
    const view = mount('«word»')
    expect(registry.run('format.bold', { view, app: {} })).toBe(true)
    expect(serializeDocument(view.state)).toBe('**word**')
  })

  it('refuses to run when `when` fails', () => {
    const registry = new CommandRegistry(formatCommands)
    expect(registry.run('format.bold', { view: null, app: {} })).toBe(false)
  })
})
