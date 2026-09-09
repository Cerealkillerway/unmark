import { describe, expect, it } from 'vitest'
import { cellInlines, renderedUnits, rowMotionTarget, tablesIn } from '../src/decorations/tables.js'
import type { Inline } from '../src/decorations/tables.js'
import { stateFrom, CARET } from './helpers.js'
import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'

/**
 * Tables render a row at a time (§4.2 revisited). The unit of reveal is a row,
 * except the header, which is one unit with the alignment line below it.
 */

const TABLE = [
  '| Fruit | Colour |',
  '| ----- | ------ |',
  '| apple | red    |',
  '| plum  | purple |'
].join('\n')

/** Which rows are drawn, as `[firstLine, lastLine]` line numbers. */
function drawnLines(marked: string): [number, number][] {
  const state = stateFrom(marked)
  return renderedUnits(state, tablesIn(state)).map((unit) => [
    state.doc.lineAt(unit.span.from).number,
    state.doc.lineAt(unit.span.to).number
  ])
}

const flatten = (nodes: readonly Inline[]): string =>
  nodes
    .map((node) =>
      node.kind === 'text'
        ? node.text
        : node.kind === 'break'
          ? '\\n'
          : `<${node.tag}>${flatten(node.children)}</${node.tag}>`
    )
    .join('')

function firstCells(state: EditorState): string[] {
  const out: string[] = []
  syntaxTree(state).iterate({
    enter: (ref) => {
      if (ref.name !== 'TableCell') return true
      out.push(flatten(cellInlines(state, ref.node)))
      return false
    }
  })
  return out
}

describe('reveal, one row at a time', () => {
  it('draws the whole table when the caret is elsewhere', () => {
    // One entry per unit: the header pair, then a row each. Merged, the whole
    // table would be a single block and no arrow key could reach row two.
    expect(drawnLines(TABLE + '\n\nafter')).toEqual([
      [1, 2],
      [3, 3],
      [4, 4]
    ])
  })

  it('reveals only the row the caret is on', () => {
    const marked = [
      '| Fruit | Colour |',
      '| ----- | ------ |',
      `| ${CARET}apple | red    |`,
      '| plum  | purple |'
    ].join('\n')
    // The header unit (lines 1-2) above, the last row below, and line 3 raw.
    expect(drawnLines(marked)).toEqual([
      [1, 2],
      [4, 4]
    ])
  })

  it('treats the header and the alignment line as one unit', () => {
    const inHeader = [
      `| Fru${CARET}it | Colour |`,
      '| ----- | ------ |',
      '| apple | red    |'
    ].join('\n')
    const inDelimiter = [
      '| Fruit | Colour |',
      `| --${CARET}--- | ------ |`,
      '| apple | red    |'
    ].join('\n')

    // Either one reveals both lines, so only the body row is left drawn.
    expect(drawnLines(inHeader)).toEqual([[3, 3]])
    expect(drawnLines(inDelimiter)).toEqual([[3, 3]])
  })

  it('drops just the revealed row out of the middle of a table', () => {
    const marked = [
      '| Fruit | Colour |',
      '| ----- | ------ |',
      `| app${CARET}le | red    |`,
      '| plum  | purple |',
      '| pear  | green  |'
    ].join('\n')
    expect(drawnLines(marked)).toEqual([
      [1, 2],
      [4, 4],
      [5, 5]
    ])
  })

  it('draws nothing when the caret is on the only row of a headerless body', () => {
    const marked = [`| Fru${CARET}it | Colour |`, '| ----- | ------ |'].join('\n')
    expect(drawnLines(marked)).toEqual([])
  })

  it('reveals a row a selection touches', () => {
    const marked = [
      '| Fruit | Colour |',
      '| ----- | ------ |',
      '| apple | red    |',
      '| plum  | purple |'
    ].join('\n')
    const state = stateFrom(marked)
    // A selection across lines 3-4 reveals both, leaving the header drawn.
    const line3 = state.doc.line(3)
    const line4 = state.doc.line(4)
    const selected = state.update({
      selection: { anchor: line3.from + 2, head: line4.from + 2 }
    }).state
    expect(
      renderedUnits(selected, tablesIn(selected)).map((unit) => [
        selected.doc.lineAt(unit.span.from).number,
        selected.doc.lineAt(unit.span.to).number
      ])
    ).toEqual([[1, 2]])
  })
})

describe('columns', () => {
  it('reads alignment off the delimiter line', () => {
    const state = stateFrom(
      ['| a | b | c | d |', '|:--|:-:|--:|---|', '| 1 | 2 | 3 | 4 |'].join('\n')
    )
    expect(tablesIn(state)[0]!.align).toEqual(['left', 'center', 'right', null])
  })

  it('gives every fragment of one table the same widths', () => {
    const marked = [
      '| tiny | a much wider column |',
      '| ---- | ------------------- |',
      `| x${CARET} | y |`,
      '| p | q |'
    ].join('\n')
    const state = stateFrom(marked)
    const [table] = tablesIn(state)
    // Widths come from the whole table, not from whichever rows are drawn, so
    // the fragments above and below a revealed row keep their columns aligned.
    expect(table!.widths).toHaveLength(2)
    expect(table!.widths[0]!).toBeLessThan(table!.widths[1]!)
    expect(table!.widths[0]! + table!.widths[1]!).toBeCloseTo(1)
  })

  it('pads a ragged row rather than dropping its columns', () => {
    const state = stateFrom(['| a | b | c |', '|---|---|---|', '| 1 |'].join('\n'))
    expect(tablesIn(state)[0]!.widths).toHaveLength(3)
  })

  it('ignores cells a row has beyond the header, rather than inventing a column', () => {
    // GFM: excess cells are dropped. Taking the widest row instead drew a
    // phantom empty column down the right-hand edge of the whole table.
    const state = stateFrom(
      ['| a | b |', '|---|---|', '| 1 | 2 | 3 |', '| 4 | 5 |'].join('\n')
    )
    expect(tablesIn(state)[0]!.widths).toHaveLength(2)
  })

  it('keeps a short column from being crushed beside a long one', () => {
    // `Codice` next to two paragraph-length columns was apportioned about a
    // twentieth of the table, which renders one letter per line.
    const state = stateFrom(
      [
        '| Codice | Condizioni |',
        '|--------|------------|',
        `| S0-1 | ${'x'.repeat(120)} |`
      ].join('\n')
    )
    const [narrow] = tablesIn(state)[0]!.widths
    // The floor is 8 characters and the cap 40, so however long the neighbour
    // runs the short column settles at 8/48 — a sixth — instead of the 6/46 it
    // would get from its own length, and never less.
    expect(narrow!).toBeCloseTo(1 / 6)
  })
})

describe('cell contents', () => {
  it('renders inline markdown and drops the markers', () => {
    const state = stateFrom(
      ['| a | b |', '|---|---|', '| **bold** and `code` | *it* |'].join('\n')
    )
    expect(firstCells(state).slice(2)).toEqual([
      '<strong>bold</strong> and <code>code</code>',
      '<em>it</em>'
    ])
  })

  it('turns <br> into a break and leaves every other tag as text', () => {
    const state = stateFrom(
      ['| a |', '|---|', '| one <br> two <span>x</span> |'].join('\n')
    )
    expect(firstCells(state)[1]).toBe('one \\n two <span>x</span>')
  })

  it('trims the padding around a cell', () => {
    const state = stateFrom(['|   a   |', '|-------|', '|   b   |'].join('\n'))
    expect(firstCells(state)).toEqual(['a', 'b'])
  })
})

describe("the reporter's table", () => {
  const REAL = [
    '|Codice| Cose da fare | Condizioni | Valore|',
    '|:---| :-------------- | :---------------------- | :----|',
    '|S0-1| Misurazione peso | solo per BMI < 18.5 o > 25.0 <br> ripete ad ogni incontro|valore numerico con decimi di g, da inserire in grafico|'
  ].join('\n')

  it('draws as a header and one row, with its alignments and its break', () => {
    const state = stateFrom(REAL + '\n\nafter')
    const [table] = tablesIn(state)

    expect(table!.align).toEqual(['left', 'left', 'left', 'left'])
    expect(table!.widths).toHaveLength(4)

    // Two units: the header pair, then the one body row.
    const units = renderedUnits(state, tablesIn(state))
    expect(units.map((unit) => unit.rows.map((row) => row.header))).toEqual([[true], [false]])

    // The header's four cells, then the row's four — the `<br>` among them.
    expect(firstCells(state)).toEqual([
      'Codice',
      'Cose da fare',
      'Condizioni',
      'Valore',
      'S0-1',
      'Misurazione peso',
      'solo per BMI < 18.5 o > 25.0 \\n ripete ad ogni incontro',
      'valore numerico con decimi di g, da inserire in grafico'
    ])
  })
})

describe('borders between separately drawn rows', () => {
  const topFlags = (marked: string): boolean[] => {
    const state = stateFrom(marked)
    return renderedUnits(state, tablesIn(state)).map((unit) => unit.top)
  }

  it('draws one top edge for a whole table', () => {
    // Only the first unit draws its own top: adjacent rows are separate
    // <table> elements, and a top on each would double every rule between them.
    expect(topFlags(TABLE + '\n\nafter')).toEqual([true, false, false])
  })

  it('gives the row after a revealed one its top edge back', () => {
    const marked = [
      '| Fruit | Colour |',
      '| ----- | ------ |',
      `| app${CARET}le | red    |`,
      '| plum  | purple |'
    ].join('\n')
    // Header keeps its top; the row below the raw markdown needs an edge
    // under it, since the line above it is no longer a drawn row.
    expect(topFlags(marked)).toEqual([true, true])
  })
})

describe('arrow keys step row by row', () => {
  /** Where the caret should land, as a line number and column. */
  const landing = (
    marked: string,
    target: number,
    forward: boolean
  ): [number, number] | null => {
    const state = stateFrom(marked)
    const head = state.selection.main.head
    const to = rowMotionTarget(state, tablesIn(state), head, target, forward)
    if (to === null) return null
    const line = state.doc.lineAt(to)
    return [line.number, to - line.from]
  }

  const WITH_PROSE = [
    'before',
    '| Fruit | Colour |',
    '| ----- | ------ |',
    '| apple | red    |',
    'after'
  ].join('\n')

  it('enters the header instead of stepping over the whole table', () => {
    const marked = WITH_PROSE.replace('before', `bef${CARET}ore`)
    const state = stateFrom(marked)
    // What CodeMirror would do unaided: the drawn units are blocks, so the
    // natural target is the line past the last of them.
    const past = state.doc.line(5).from
    expect(landing(marked, past, true)).toEqual([2, 3])
  })

  it('enters the last row when coming up from below', () => {
    const marked = WITH_PROSE.replace('after', `aft${CARET}er`)
    const state = stateFrom(marked)
    const past = state.doc.line(1).from
    // Arriving from underneath lands on the nearest row, not the header.
    expect(landing(marked, past, false)).toEqual([4, 3])
  })

  it('enters the header unit at its alignment line coming up', () => {
    const marked = [
      '| Fruit | Colour |',
      '| ----- | ------ |',
      `| app${CARET}le | red    |`
    ].join('\n')
    const state = stateFrom(marked)
    // The header unit is two lines and reveals as one; coming up you meet the
    // alignment line first, which is line 2.
    expect(landing(marked, state.doc.line(1).from, false)).toEqual([2, 5])
  })

  it('leaves motion alone when the default already lands inside a row', () => {
    const marked = WITH_PROSE.replace('before', `bef${CARET}ore`)
    const state = stateFrom(marked)
    // A target inside the header unit is not a skip, so nothing is overridden
    // — this is the wrapped-line case, where the default must be left alone.
    expect(landing(marked, state.doc.line(2).from + 1, true)).toBeNull()
  })

  it('does nothing in a document with no tables', () => {
    const state = stateFrom(`one${CARET}\ntwo`)
    expect(rowMotionTarget(state, tablesIn(state), 3, 7, true)).toBeNull()
  })
})
