import { syntaxTree } from '@codemirror/language'
import { EditorSelection, type ChangeSpec, type EditorState, type Line } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'

/**
 * Format transforms (§4.4).
 *
 * Every one of these is syntax-tree aware. String matching is the obvious
 * shortcut and it is wrong: it turns `**bold**` into `****bold****` when the
 * selection edges land on the markers, and it cannot tell `*a*` inside
 * `**a**` from a standalone emphasis. The tree already knows; ask it.
 *
 * Each transform is a single `changeByRange` transaction, so multi-cursor
 * works and undo treats the whole toggle as one step.
 */

export interface WrapSpec {
  /** The literal inserted on both sides, e.g. `**`. */
  readonly marker: string
  /** Node names that count as "already wrapped", e.g. `StrongEmphasis`. */
  readonly nodes: readonly string[]
}

export const WRAP_STRONG: WrapSpec = { marker: '**', nodes: ['StrongEmphasis'] }
export const WRAP_EMPHASIS: WrapSpec = { marker: '*', nodes: ['Emphasis'] }
export const WRAP_CODE: WrapSpec = { marker: '`', nodes: ['InlineCode'] }
export const WRAP_STRIKETHROUGH: WrapSpec = { marker: '~~', nodes: ['Strikethrough'] }

function climb(
  start: SyntaxNode | null,
  names: readonly string[],
  from: number,
  to: number
): SyntaxNode | null {
  for (let node = start; node; node = node.parent) {
    if (names.includes(node.name) && node.from <= from && node.to >= to) return node
  }
  return null
}

/**
 * The innermost node of one of `names` containing [from, to], inclusive of
 * the node's own boundaries.
 *
 * Walking the tree rather than scanning text is what makes nesting work: an
 * `*a*` inside `**a**` resolves to Emphasis, not to a naive `*` run.
 *
 * Boundaries are inclusive deliberately. A cursor resting against a marker —
 * at either end of `**bold**`, or in the gap of `**a** **b**` — is treated as
 * inside the adjacent node, so the toggle unwraps it. The alternative is to
 * insert a fresh pair right beside an existing one, which produces the
 * `****text****` marker soup §4.4 calls out as a bug. Unwrapping the neighbour
 * is at worst surprising, and one undo away.
 */
function enclosing(
  state: EditorState,
  from: number,
  to: number,
  names: readonly string[]
): SyntaxNode | null {
  const tree = syntaxTree(state)
  return (
    climb(tree.resolveInner(from, 1), names, from, to) ??
    climb(tree.resolveInner(from, -1), names, from, to)
  )
}

interface MarkerSpans {
  readonly open: { from: number; to: number }
  readonly close: { from: number; to: number }
}

/**
 * The marker runs at each end of an already-wrapped node, read off the tree.
 *
 * Taken from the node's own children rather than assumed to equal the marker
 * we would have inserted: `__bold__` is StrongEmphasis too, and InlineCode
 * delimiters can be any run of backticks. Removing exactly what the parser
 * calls a marker is what makes the round trip byte-exact (I1).
 */
function markerSpans(node: SyntaxNode, marker: string): MarkerSpans | null {
  let first: SyntaxNode | null = null
  let last: SyntaxNode | null = null
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (!child.name.endsWith('Mark')) continue
    if (!first) first = child
    last = child
  }
  if (first && last && first !== last && first.from === node.from && last.to === node.to) {
    return { open: { from: first.from, to: first.to }, close: { from: last.from, to: last.to } }
  }
  const len = marker.length
  if (node.to - node.from < len * 2) return null
  return { open: { from: node.from, to: node.from + len }, close: { from: node.to - len, to: node.to } }
}

/**
 * Add or remove `marker` around every selection range.
 *
 * Toggling twice is a strict round trip: removal deletes exactly the marker
 * runs the tree reports, so the original string comes back byte for byte (I1).
 * On an empty cursor it inserts the pair and parks the caret between them.
 */
export function toggleWrap(view: EditorView, spec: WrapSpec): boolean {
  const { state } = view
  const { marker, nodes } = spec
  const len = marker.length

  view.dispatch(
    state.changeByRange((range) => {
      const node = enclosing(state, range.from, range.to, nodes)
      const spans = node ? markerSpans(node, marker) : null

      if (spans) {
        const changes: ChangeSpec[] = [spans.open, spans.close]
        // Pull each endpoint back by whatever was deleted before it.
        const shift = (pos: number): number => {
          let out = pos
          for (const span of [spans.open, spans.close]) {
            if (pos >= span.to) out -= span.to - span.from
            else if (pos > span.from) out -= pos - span.from
          }
          return out
        }
        return { changes, range: EditorSelection.range(shift(range.from), shift(range.to)) }
      }

      // An empty pair — `**|**` — is not a node the parser will report, so
      // the tree cannot tell us it is there. Without this, pressing the key
      // twice on a bare cursor stacks a second pair and produces `****|****`.
      if (
        range.empty &&
        state.doc.sliceString(range.from - len, range.from) === marker &&
        state.doc.sliceString(range.from, range.from + len) === marker
      ) {
        return {
          changes: [
            { from: range.from - len, to: range.from },
            { from: range.from, to: range.from + len }
          ],
          range: EditorSelection.cursor(range.from - len)
        }
      }

      const changes: ChangeSpec[] = [
        { from: range.from, insert: marker },
        { from: range.to, insert: marker }
      ]
      return {
        changes,
        range: range.empty
          ? EditorSelection.cursor(range.from + len)
          : EditorSelection.range(range.from + len, range.to + len)
      }
    }),
    { scrollIntoView: true, userEvent: 'input.format' }
  )
  return true
}

/** The lines a range touches, deduplicated across multi-cursor. */
function linesIn(state: EditorState, from: number, to: number): Line[] {
  const out: Line[] = []
  for (let pos = from; ; ) {
    const line = state.doc.lineAt(pos)
    out.push(line)
    if (line.to >= to) break
    pos = line.to + 1
  }
  return out
}

export interface LinePrefixSpec {
  /**
   * The literal written at the start of the line, e.g. `## ` or `> `.
   * An empty string means "strip whatever this family already has".
   */
  readonly prefix: string
  /**
   * Matches the prefix family this command may replace. Anchored at the line
   * start; the matched text is what gets replaced or removed. It is
   * deliberately wider than `prefix` — asking for an ordered list on a bullet
   * should swap the marker, not stack `1. ` in front of `- `.
   */
  readonly pattern: RegExp
  /**
   * Recognises "this line already *is* what the command produces", when that
   * is wider than the literal prefix — `- [x] ` is a task just as much as
   * `- [ ] ` is. Defaults to exact equality with `prefix`.
   */
  readonly matches?: RegExp
}

/** Any list marker: bullet or ordered, with an optional task box. */
const ANY_LIST = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/

export const PREFIX_QUOTE: LinePrefixSpec = { prefix: '> ', pattern: /^\s*>\s?/ }
export const PREFIX_BULLET: LinePrefixSpec = { prefix: '- ', pattern: ANY_LIST }
export const PREFIX_ORDERED: LinePrefixSpec = { prefix: '1. ', pattern: ANY_LIST }
export const PREFIX_TASK: LinePrefixSpec = {
  prefix: '- [ ] ',
  pattern: ANY_LIST,
  matches: /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s+$/
}

export function headingPrefix(level: number): LinePrefixSpec {
  return { prefix: `${'#'.repeat(level)} `, pattern: /^\s*#{1,6}\s+/ }
}

/**
 * Add, replace or strip a line prefix across the selection.
 *
 * Add/strip is decided once for the whole selection — if every touched line
 * already carries *this exact* prefix the operation strips, otherwise it
 * applies. That is what makes a multi-line toggle feel like one action rather
 * than a per-line flip that scrambles a mixed selection.
 */
export function toggleLinePrefix(view: EditorView, spec: LinePrefixSpec): boolean {
  const { state } = view
  const { prefix, pattern, matches } = spec

  const lines: Line[] = []
  const seen = new Set<number>()
  for (const range of state.selection.ranges) {
    for (const line of linesIn(state, range.from, range.to)) {
      if (!seen.has(line.from)) {
        seen.add(line.from)
        lines.push(line)
      }
    }
  }

  const existing = lines.map((line) => pattern.exec(line.text))
  const already = (text: string | undefined): boolean =>
    text !== undefined && (matches ? matches.test(text) : text === prefix)
  const allHavePrefix = prefix !== '' && existing.every((match) => already(match?.[0]))

  const changes: ChangeSpec[] = []
  for (const [i, line] of lines.entries()) {
    const match = existing[i]
    const from = line.from
    const to = line.from + (match?.[0].length ?? 0)
    const insert = allHavePrefix ? '' : prefix
    if (insert === '' && from === to) continue
    changes.push({ from, to, insert })
  }
  if (changes.length === 0) return false

  view.dispatch(state.update({ changes, scrollIntoView: true, userEvent: 'input.format' }))
  return true
}

/**
 * Wrap the selection as a link, or insert an empty one.
 *
 * If the selection already sits inside a Link node, the whole link collapses
 * back to its label — the same round-trip contract as `toggleWrap`.
 */
export function toggleLink(view: EditorView, url = ''): boolean {
  const { state } = view

  view.dispatch(
    state.changeByRange((range) => {
      const node = enclosing(state, range.from, range.to, ['Link'])
      if (node) {
        const text = state.doc.sliceString(node.from, node.to)
        const label = /^\[([^\]]*)\]\(.*\)$/s.exec(text)?.[1]
        if (label !== undefined) {
          return {
            changes: { from: node.from, to: node.to, insert: label },
            range: EditorSelection.cursor(node.from + label.length)
          }
        }
      }

      const label = state.doc.sliceString(range.from, range.to)
      const insert = `[${label}](${url})`
      return {
        changes: { from: range.from, to: range.to, insert },
        // Park the caret inside the parentheses, ready for the URL.
        range: EditorSelection.cursor(range.from + label.length + 3 + url.length)
      }
    }),
    { scrollIntoView: true, userEvent: 'input.format' }
  )
  return true
}
