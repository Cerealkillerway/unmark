import { EditorSelection } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { isRevealed } from '../src/decorations/reveal.js'
import { classesAt, decorate, hidden, rendered } from './helpers.js'

describe('inline rendering', () => {
  it('hides the markers of a complete strong span', () => {
    expect(rendered('**test**‸')).toBe('test')
    expect(hidden('**test**‸')).toEqual(['**', '**'])
  })

  it('styles the content, not the markers', () => {
    // 'test' begins at offset 2 in '**test**'
    expect(classesAt('**test**|', 2)).toEqual(['cm-md-strong'])
    // offset 0 is inside the leading '**', which is replaced, not marked
    expect(classesAt('**test**|', 0)).toEqual([])
  })

  it('handles emphasis, inline code, and strikethrough', () => {
    expect(rendered('*a* `b` ~~c~~‸')).toBe('a b c')
    expect(classesAt('*abc*|', 1)).toEqual(['cm-md-em'])
    expect(classesAt('`abc`|', 1)).toEqual(['cm-md-code'])
    expect(classesAt('~~abc~~|', 2)).toEqual(['cm-md-strike'])
  })

  it('leaves incomplete syntax entirely alone', () => {
    // No node exists yet, so nothing is hidden and nothing is styled. This
    // falls out of the parser — there is no partial-match state machine.
    expect(rendered('**test‸')).toBe('**test')
    expect(hidden('**test‸')).toEqual([])
    expect(decorate('**test‸').filter((r) => r.class === 'cm-md-strong')).toEqual([])

    expect(rendered('`code‸')).toBe('`code')
    expect(rendered('~~struck‸')).toBe('~~struck')
  })

  it('defers to CommonMark on partially-closed runs', () => {
    // `**test*` is not "half a strong span": CommonMark reads it as a literal
    // asterisk followed by an emphasised `test`, and so does the parser. We
    // render whatever the tree says, which is the whole point of I1.
    expect(rendered('**test*‸')).toBe('*test')
    expect(classesAt('**test*|', 2)).toEqual(['cm-md-em'])
  })

  it('renders a lone asterisk as literal text', () => {
    expect(rendered('a * b‸')).toBe('a * b')
  })

  it('decorates nested inline nodes independently', () => {
    const doc = '**bold with `code` inside**'
    expect(rendered(doc + '‸')).toBe('bold with code inside')
    expect(classesAt(doc + '‸', doc.indexOf('code'))).toEqual(['cm-md-code', 'cm-md-strong'])
  })
})

describe('the reveal rule (§4.2)', () => {
  it('reveals markers when the caret is inside the node', () => {
    expect(rendered('**te‸st**')).toBe('**test**')
    expect(hidden('**te‸st**')).toEqual([])
  })

  it('keeps markers hidden when the caret sits just past the node', () => {
    // The Phase 1 headline: typing the final '*' renders bold immediately.
    expect(rendered('**test**‸')).toBe('test')
  })

  it('keeps markers hidden when the caret sits just before the node', () => {
    expect(rendered('‸**test**')).toBe('test')
  })

  it('reveals as soon as the caret steps into the trailing marker', () => {
    expect(rendered('**test*‸*')).toBe('**test**')
  })

  it('re-hides when the caret leaves', () => {
    expect(rendered('**test** and ‸more')).toBe('test and more')
  })

  it('reveals only the node the caret is in', () => {
    expect(rendered('**a** *b‸b* **c**')).toBe('a *bb* c')
  })

  it('reveals a nested node and its ancestors, since the caret is inside both', () => {
    // The predicate is applied to every node independently. A caret inside
    // `code` is, by containment, also inside the enclosing strong span, so
    // both sets of markers come back.
    expect(rendered('**bold `co‸de` here**')).toBe('**bold `code` here**')
  })

  it('leaves an inner node hidden when the caret is elsewhere in its parent', () => {
    // Caret in the parent but outside the code span: only the parent reveals.
    expect(rendered('**bo‸ld `code` here**')).toBe('**bold code here**')
  })

  it('reveals every node a selection overlaps', () => {
    expect(rendered('**a** «x *b* y» **c**')).toBe('a x *b* y c')
  })

  it('works with multiple cursors', () => {
    const spans = [
      { from: 0, to: 8 },
      { from: 20, to: 28 }
    ]
    const sel = EditorSelection.create([
      EditorSelection.cursor(4),
      EditorSelection.cursor(50)
    ])
    expect(isRevealed(spans[0]!, sel)).toBe(true)
    expect(isRevealed(spans[1]!, sel)).toBe(false)
  })

  it('is strict overlap, so the boundaries do not reveal', () => {
    const node = { from: 10, to: 20 }
    expect(isRevealed(node, EditorSelection.single(10))).toBe(false)
    expect(isRevealed(node, EditorSelection.single(20))).toBe(false)
    expect(isRevealed(node, EditorSelection.single(11))).toBe(true)
    expect(isRevealed(node, EditorSelection.single(19))).toBe(true)
    // a selection that merely abuts the node does not reveal it
    expect(isRevealed(node, EditorSelection.single(0, 10))).toBe(false)
    expect(isRevealed(node, EditorSelection.single(20, 30))).toBe(false)
    // one that overlaps by a single character does
    expect(isRevealed(node, EditorSelection.single(0, 11))).toBe(true)
  })
})

describe('decoration ordering (trap #5)', () => {
  it('emits ranges sorted by from, with replace before mark', () => {
    const ranges = decorate('**a** *b* `c` ~~d~~ **e**‸')
    for (let i = 1; i < ranges.length; i++) {
      const prev = ranges[i - 1]!
      const cur = ranges[i]!
      expect(cur.from).toBeGreaterThanOrEqual(prev.from)
      if (cur.from === prev.from && prev.kind !== cur.kind) {
        expect(prev.kind).toBe('replace')
      }
    }
  })

  it('never emits an empty range', () => {
    for (const r of decorate('**a** *b* `c` ~~d~~‸')) {
      expect(r.to).toBeGreaterThan(r.from)
    }
  })
})
