import { syntaxTree } from '@codemirror/language'
import { Facet, Prec, StateField, type EditorState, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  keymap,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import type { SyntaxNode, Tree } from '@lezer/common'
import { isLineRevealed } from './reveal.js'
import type { Span } from './types.js'

/**
 * Tables, rendered a row at a time (§4.2's exception, revisited).
 *
 * Every other construct here folds *within* a line: hide the four asterisks of
 * `**bold**` and the characters that remain keep their order, so a document
 * offset still maps to a place on the screen. A table does not have that
 * property. A grid lays cells out in two dimensions, and the moment a whole
 * table becomes one rendered object, caret movement and editing inside it stop
 * corresponding to offsets in the markdown string. That is the version of this
 * feature the README calls its own project, and it still is.
 *
 * Doing it one *row* at a time is what makes it tractable. A row is a line, so
 * the reveal rule that governs everything else applies unchanged: rows the
 * caret is not on render as a table, and the row the caret is on is raw
 * markdown, editable as ordinary text. Nothing ever has to map a position
 * inside a rendered cell back to the source, because the rendered rows are
 * exactly the rows nobody is editing.
 *
 * The header and the alignment line below it are one unit. `|:---|` is pure
 * syntax with nothing in it to read, and revealing a header without the line
 * that says how its columns align would be showing half a construct.
 *
 * Like `lines.ts`, and for the same reason, this is a StateField rather than a
 * ViewPlugin: replacing a line break changes the editor's vertical layout, and
 * CodeMirror settles layout before view plugins run.
 */

export interface TableOptions {
  /**
   * Widest a column may count as, in characters, when widths are apportioned
   * from content. Caps the pathological case — one cell holding a paragraph —
   * from squeezing every other column down to nothing.
   */
  maxColumnChars?: number
  /**
   * Narrowest a column may count as. Without a floor, a `Codice` column beside
   * two paragraph-sized ones is apportioned about a twentieth of the table and
   * renders one letter per line, spelling itself vertically.
   */
  minColumnChars?: number
}

/** `:---`, `---:`, `:---:` — anything else is the renderer's default. */
export type Align = 'left' | 'center' | 'right' | null

/**
 * A cell's inline markdown as plain data.
 *
 * Data and not DOM so the whole model stays testable as a pure function of
 * `(doc, selection)` (§7), and so a widget can hold its content without
 * holding an `EditorState` alive.
 */
export type Inline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'break' }
  | { readonly kind: 'tag'; readonly tag: InlineTag; readonly children: readonly Inline[] }

export type InlineTag = 'strong' | 'em' | 'del' | 'code' | 'link'

export interface RenderRow {
  readonly header: boolean
  readonly cells: readonly (readonly Inline[])[]
}

interface Row extends RenderRow {
  /** The row's line, first character to last, newline excluded. */
  readonly line: Span
}

/** A group of lines the reveal rule is applied to as one. */
interface Unit {
  readonly reveal: Span
  /** What to draw while it is not revealed. Never empty. */
  readonly rows: readonly Row[]
}

interface Table {
  readonly units: readonly Unit[]
  readonly align: readonly Align[]
  /** Each column's share of the width, summing to 1. */
  readonly widths: readonly number[]
}

const childrenOf = (node: SyntaxNode): SyntaxNode[] => {
  const out: SyntaxNode[] = []
  for (let child = node.firstChild; child; child = child.nextSibling) out.push(child)
  return out
}

/* ------------------------------------------------------------------ *
 * A cell's contents
 * ------------------------------------------------------------------ */

const BR = /^<br\s*\/?>$/i

const TAGS: Readonly<Record<string, InlineTag>> = {
  StrongEmphasis: 'strong',
  Emphasis: 'em',
  Strikethrough: 'del',
  InlineCode: 'code',
  Link: 'link',
  Autolink: 'link',
  URL: 'link'
}

/**
 * One cell's inline markdown, read off the syntax tree.
 *
 * Built node by node rather than by handing a string to `markdownToHtml` and
 * setting `innerHTML`. That function passes raw HTML straight through, which
 * is right for the clipboard and wrong here: this content goes inside the
 * editor, where the same string is a script injection and — in an app that
 * deliberately never fetches remote images — an `<img src="https://…">` that
 * phones home on a document you merely opened. `<br>` is recognised because a
 * line break inside a cell has no markdown spelling. Every other tag stays the
 * literal text the author typed.
 */
export function cellInlines(state: EditorState, cell: SyntaxNode): Inline[] {
  const slice = (from: number, to: number): string => state.doc.sliceString(from, to)

  const walk = (node: SyntaxNode, from: number, to: number): Inline[] => {
    const out: Inline[] = []
    const push = (text: string): void => {
      if (text) out.push({ kind: 'text', text })
    }

    let pos = from
    for (const child of childrenOf(node)) {
      if (child.from >= to || child.to <= from) continue
      if (child.from > pos) push(slice(pos, child.from))
      pos = Math.max(pos, child.to)

      // `**`, `` ` ``, `~~` — the markers themselves carry nothing to show.
      if (child.name.endsWith('Mark')) continue

      if (child.name === 'HTMLTag') {
        if (BR.test(slice(child.from, child.to))) out.push({ kind: 'break' })
        else push(slice(child.from, child.to))
        continue
      }
      if (child.name === 'Escape') {
        push(slice(child.from + 1, child.to))
        continue
      }

      const tag = TAGS[child.name]
      if (!tag) {
        out.push(...walk(child, child.from, child.to))
        continue
      }
      out.push({ kind: 'tag', tag, children: walk(child, child.from, child.to) })
    }
    if (pos < to) push(slice(pos, to))
    return out
  }

  // A cell's own leading and trailing spaces are padding, not content.
  return trim(walk(cell, cell.from, cell.to))
}

function trim(nodes: readonly Inline[]): Inline[] {
  const out = nodes.slice()
  const edit = (index: number, transform: (text: string) => string): void => {
    const node = out[index]
    if (node?.kind !== 'text') return
    const text = transform(node.text)
    if (text) out[index] = { kind: 'text', text }
    else out.splice(index, 1)
  }
  if (out.length > 0) edit(0, (text) => text.replace(/^\s+/, ''))
  if (out.length > 0) edit(out.length - 1, (text) => text.replace(/\s+$/, ''))
  return out
}

/** How much room a cell's text wants, for apportioning column widths. */
function measure(nodes: readonly Inline[]): number {
  let total = 0
  for (const node of nodes) {
    if (node.kind === 'text') total += node.text.length
    else if (node.kind === 'tag') total += measure(node.children)
  }
  return total
}

/* ------------------------------------------------------------------ *
 * The model
 * ------------------------------------------------------------------ */

function alignmentsOf(state: EditorState, delimiter: SyntaxNode): Align[] {
  return state.doc
    .sliceString(delimiter.from, delimiter.to)
    .split('|')
    .slice(1, -1)
    .map((spec) => {
      const trimmed = spec.trim()
      const left = trimmed.startsWith(':')
      const right = trimmed.endsWith(':')
      if (left && right) return 'center'
      if (right) return 'right'
      if (left) return 'left'
      return null
    })
}

/**
 * Column widths, apportioned from the widest cell in each column.
 *
 * One table's rendered rows can end up in more than one widget — a revealed
 * row in the middle splits them — and two `<table>` elements size their
 * columns independently. Computing the shares once for the whole table and
 * setting them explicitly is what keeps the fragments lined up across the gap.
 */
function widthsOf(
  rows: readonly Row[],
  columns: number,
  cap: number,
  floor: number
): number[] {
  const widest = new Array<number>(columns).fill(0)
  for (const row of rows) {
    row.cells.forEach((cell, index) => {
      if (index < columns) widest[index] = Math.max(widest[index]!, Math.min(measure(cell), cap))
    })
  }
  const clamped = widest.map((value) => Math.max(value, floor))
  const total = clamped.reduce((sum, value) => sum + value, 0)
  return clamped.map((value) => value / total)
}

function tableAt(
  state: EditorState,
  node: SyntaxNode,
  cap: number,
  floor: number
): Table | null {
  const children = childrenOf(node)
  const header = children.find((child) => child.name === 'TableHeader')
  const delimiter = children.find((child) => child.name === 'TableDelimiter')
  // @lezer/markdown does not produce a Table without both, but a partial parse
  // mid-edit can hand us anything, and there is nothing to draw without them.
  if (!header || !delimiter) return null

  const lineSpan = (target: SyntaxNode): Span => ({
    from: state.doc.lineAt(target.from).from,
    to: state.doc.lineAt(target.to).to
  })

  const rowAt = (target: SyntaxNode, isHeader: boolean): Row => ({
    header: isHeader,
    line: lineSpan(target),
    cells: childrenOf(target)
      .filter((child) => child.name === 'TableCell')
      .map((child) => cellInlines(state, child))
  })

  const headerRow = rowAt(header, true)
  const bodyRows = children
    .filter((child) => child.name === 'TableRow')
    .map((child) => rowAt(child, false))

  // The header decides how many columns there are. GFM is explicit that a row
  // with more cells than the header has the excess ignored, and taking the
  // widest row instead invented a phantom empty column at the right edge of
  // any table with one over-long row.
  const columns = Math.max(headerRow.cells.length, 1)

  return {
    units: [
      {
        // Header and alignment line reveal together, so the unit runs from the
        // top of the header to the end of the delimiter's line.
        reveal: { from: headerRow.line.from, to: lineSpan(delimiter).to },
        rows: [headerRow]
      },
      ...bodyRows.map((row): Unit => ({ reveal: row.line, rows: [row] }))
    ],
    align: alignmentsOf(state, delimiter),
    widths: widthsOf([headerRow, ...bodyRows], columns, cap, floor)
  }
}

/** Every table in the document, in document order. */
export function tablesIn(state: EditorState, cap = 40, floor = 8): Table[] {
  const out: Table[] = []
  syntaxTree(state).iterate({
    enter: (ref) => {
      if (ref.name !== 'Table') return true
      const table = tableAt(state, ref.node, cap, floor)
      if (table) out.push(table)
      // Never descend into a table's cells from here: this walk is
      // whole-document (a state field has no viewport), so it stays O(rows)
      // — trap #8. `tableAt` visits the cells of the tables it finds.
      return false
    }
  })
  return out
}


/**
 * The units currently drawn, each on its own.
 *
 * One decoration per unit and not per run of adjacent ones, which matters for
 * two reasons that are really the same reason: a block decoration is one block
 * to CodeMirror. Merged, a whole table is a single block — `ArrowDown` from the
 * line above it lands below the last row, and a click anywhere in it resolves
 * to the same boundary position, so there is no way to reach row three. Split,
 * each row is a block of its own, so vertical motion and clicks address rows.
 *
 * `top` says whether this unit draws its own top border: true for a table's
 * first unit, and for any unit whose predecessor is revealed, since a raw
 * markdown row above needs an edge under it. Every other unit leaves its top
 * off so that adjacent rows — separate `<table>` elements — meet in a single
 * line rather than a doubled one.
 *
 * Pure and view-free, so the behaviour is testable as `(doc, selection) ->
 * ranges` the way §7 asks for.
 */
export function renderedUnits(
  state: EditorState,
  tables: readonly Table[]
): { readonly span: Span; readonly rows: readonly Row[]; readonly table: Table; readonly top: boolean }[] {
  const out: { span: Span; rows: readonly Row[]; table: Table; top: boolean }[] = []
  for (const table of tables) {
    let previousRevealed = true
    table.units.forEach((unit, index) => {
      if (isLineRevealed(unit.reveal, state.selection)) {
        previousRevealed = true
        return
      }
      out.push({
        span: unit.reveal,
        rows: unit.rows,
        table,
        top: index === 0 || previousRevealed
      })
      previousRevealed = false
    })
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Moving between rows
 * ------------------------------------------------------------------ */

/**
 * Where a vertical keystroke should land when the default would skip a row.
 *
 * CodeMirror moves the caret vertically by looking at coordinates, and a drawn
 * row is one block: from the line above a table, `ArrowDown`'s natural target
 * is the line *after* whichever block comes next, so the row is stepped over
 * rather than entered. This decides when to override that.
 *
 * It is given the default target rather than computing one, so the two cases
 * that must keep working keep working: a long wrapped line above a table still
 * moves through its own visual rows (the default target never reaches the
 * table, so nothing is overridden), and any motion that already lands inside a
 * unit is left alone.
 *
 * @param head where the caret is now
 * @param target where the default motion would put it
 * @returns the position to use instead, or null to let the default stand
 */
export function rowMotionTarget(
  state: EditorState,
  tables: readonly Table[],
  head: number,
  target: number,
  forward: boolean
): number | null {
  const column = head - state.doc.lineAt(head).from

  for (const unit of drawnUnitsBetween(state, tables, head, target, forward)) {
    // Entering from above lands on the unit's first line, from below on its
    // last — the edge you arrived at. For the header unit, whose two lines
    // reveal together, that is the header going down and the alignment line
    // coming up.
    const line = state.doc.lineAt(forward ? unit.from : unit.to)
    return Math.min(line.from + column, line.to)
  }
  return null
}

/** Drawn units the default motion would jump clean over, nearest first. */
function drawnUnitsBetween(
  state: EditorState,
  tables: readonly Table[],
  head: number,
  target: number,
  forward: boolean
): Span[] {
  const spans = renderedUnits(state, tables)
    .map((unit) => unit.span)
    .filter((span) =>
      // Wholly past the caret in the direction of travel, and the default
      // target at or beyond its far edge — that is what "stepped over" means.
      // The bound on the far edge is inclusive: landing exactly on a unit's
      // outermost position is still arriving at the wrong end of it, since a
      // unit entered from below should open at its last line, not its first.
      forward ? span.from > head && span.to <= target : span.to < head && span.from >= target
    )
  return forward ? spans : spans.reverse()
}

function moveByRow(view: EditorView, forward: boolean): boolean {
  const tables = view.state.field(tableState, false)?.tables
  if (!tables || tables.length === 0) return false

  const range = view.state.selection.main
  // A selection has its own meaning for the arrow keys — collapse it — and
  // that is the default keymap's job, not this one's.
  if (!range.empty) return false

  const target = view.moveVertically(range, forward)
  const redirect = rowMotionTarget(view.state, tables, range.head, target.head, forward)
  if (redirect === null) return false

  view.dispatch({
    selection: { anchor: redirect },
    scrollIntoView: true,
    userEvent: 'select'
  })
  return true
}

/* ------------------------------------------------------------------ *
 * The widget
 * ------------------------------------------------------------------ */

const signatureOf = (
  rows: readonly RenderRow[],
  align: readonly Align[],
  widths: readonly number[],
  top: boolean
): string => JSON.stringify([rows, align, widths.map((width) => width.toFixed(4)), top])

/** One row nobody is editing, drawn as a one-row `<table>`. */
class TableWidget extends WidgetType {
  constructor(
    readonly rows: readonly RenderRow[],
    readonly align: readonly Align[],
    readonly widths: readonly number[],
    readonly top: boolean,
    readonly signature: string
  ) {
    super()
  }

  override eq(other: TableWidget): boolean {
    return other.signature === this.signature
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = this.top ? 'cm-md-table-wrap cm-md-table-top' : 'cm-md-table-wrap'

    const table = document.createElement('table')
    table.className = 'cm-md-table'

    // Explicit widths plus fixed layout: every row is its own element, and
    // this is what makes them line up as one table.
    const group = document.createElement('colgroup')
    for (const width of this.widths) {
      const col = document.createElement('col')
      col.style.width = `${(width * 100).toFixed(3)}%`
      group.appendChild(col)
    }
    table.appendChild(group)

    for (const row of this.rows) {
      const tr = document.createElement('tr')
      for (let index = 0; index < this.widths.length; index++) {
        const cell = document.createElement(row.header ? 'th' : 'td')
        const align = this.align[index]
        if (align) cell.style.textAlign = align
        // A ragged row — fewer cells than the header — gets empty ones, the
        // way every other markdown renderer treats it.
        appendInlines(cell, row.cells[index] ?? [])
        tr.appendChild(cell)
      }
      table.appendChild(tr)
    }

    wrap.appendChild(table)
    return wrap
  }

  /** Let clicks through, so putting the caret in a row still reveals it. */
  override ignoreEvent(): boolean {
    return false
  }
}

const ELEMENTS: Readonly<Record<InlineTag, string>> = {
  strong: 'strong',
  em: 'em',
  del: 'del',
  code: 'code',
  link: 'span'
}

function appendInlines(target: HTMLElement, nodes: readonly Inline[]): void {
  for (const node of nodes) {
    if (node.kind === 'text') {
      target.appendChild(document.createTextNode(node.text))
      continue
    }
    if (node.kind === 'break') {
      target.appendChild(document.createElement('br'))
      continue
    }
    const element = document.createElement(ELEMENTS[node.tag])
    // A link is drawn but not made clickable: Mod-click is a DOM handler over
    // the editor's own text, and a widget's interior is not that. Put the
    // caret in the row and the real markdown — and the real link — comes back.
    if (node.tag === 'link') element.className = 'cm-md-link'
    if (node.tag === 'code') element.className = 'cm-md-table-code'
    appendInlines(element, node.children)
    target.appendChild(element)
  }
}

/* ------------------------------------------------------------------ *
 * The extension
 * ------------------------------------------------------------------ */

/**
 * Options as a facet so the state field can be defined once, at module scope.
 * The arrow-key commands need to read the field, and a field created inside
 * `tablePreviews()` would be a different object on every call.
 */
const tableConfig = Facet.define<TableOptions, Required<TableOptions>>({
  combine: (values) => ({
    maxColumnChars: values[0]?.maxColumnChars ?? 40,
    minColumnChars: values[0]?.minColumnChars ?? 8
  })
})

interface Scan {
  readonly tree: Tree
  readonly tables: readonly Table[]
  readonly deco: DecorationSet
}

function decorations(state: EditorState, tables: readonly Table[]): DecorationSet {
  return Decoration.set(
    renderedUnits(state, tables).map(({ span, rows, table, top }) =>
      Decoration.replace({
        block: true,
        widget: new TableWidget(
          rows,
          table.align,
          table.widths,
          top,
          signatureOf(rows, table.align, table.widths, top)
        )
      }).range(span.from, span.to)
    ),
    true
  )
}

function scan(state: EditorState, tree: Tree): Scan {
  const { maxColumnChars, minColumnChars } = state.facet(tableConfig)
  const tables = tablesIn(state, maxColumnChars, minColumnChars)
  return { tree, tables, deco: decorations(state, tables) }
}

const tableState = StateField.define<Scan>({
  create: (state) => scan(state, syntaxTree(state)),
  update(prev, tr) {
    // I6 needs nothing special, for the same reason it needs nothing in
    // lines.ts: a composition runs inside the row being edited, that row is
    // revealed and therefore not drawn, and every other row's widget compares
    // equal by signature so CodeMirror keeps its existing DOM.
    const tree = syntaxTree(tr.state)
    // A newer tree for the same text arrives in a transaction of its own, as
    // the parser works through the document.
    if (tr.docChanged || tree !== prev.tree) return scan(tr.state, tree)
    if (!tr.selection) return prev
    return { ...prev, deco: decorations(tr.state, prev.tables) }
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.deco)
})

/**
 * Publishes the editor's full inner width as `--md-table-available`.
 *
 * A table wants more room than prose does, but the width it may have is the
 * *editor's*, and nothing inside `.cm-content` can see that number: the content
 * element is capped at `--md-content-width` and centred, so a percentage there
 * resolves against the text measure and a table can only ever be a multiple of
 * the column it is trying to escape. Guessing a multiple is what the first
 * attempt at this did, and a guess is either too narrow on a wide window or
 * overflowing on a narrow one.
 *
 * So the width is measured and handed to CSS as a length. Reading layout is
 * done in `requestMeasure`'s read phase, which is the one place CodeMirror
 * allows it without forcing a reflow mid-update.
 */
const availableWidth = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      this.measure(view)
    }

    update(update: ViewUpdate): void {
      if (update.geometryChanged) this.measure(update.view)
    }

    measure(view: EditorView): void {
      view.requestMeasure({
        read: (measured) => measured.scrollDOM.clientWidth,
        write: (width, measured) => {
          // Zero means the editor is not laid out yet — detached, or in a
          // headless test. Publishing `0px` would make every expression built
          // on it collapse, so leave the property unset and let its fallback
          // stand.
          if (width > 0) measured.dom.style.setProperty('--md-table-available', `${width}px`)
        }
      })
    }
  }
)

/**
 * Render tables one row at a time, under the reveal rule.
 */
export function tablePreviews(options: TableOptions = {}): Extension {
  return [
    tableConfig.of(options),
    tableState,
    availableWidth,
    // Trap #3: without Prec.high the base keymap's own ArrowUp/ArrowDown sit at
    // equal precedence and win, and these would silently never run.
    Prec.high(
      keymap.of([
        { key: 'ArrowDown', run: (view) => moveByRow(view, true) },
        { key: 'ArrowUp', run: (view) => moveByRow(view, false) }
      ])
    )
  ]
}
