import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { isRevealed } from './reveal.js'
import type { DecoRange, NodeRule, RuleTable, Span } from './types.js'

/** Class worn by a marker that is currently visible. */
export const SYNTAX_CLASS = 'cm-md-syntax'

/** @lezer/markdown names every syntax-character node `…Mark`. */
function isMarker(name: string, rule: NodeRule): boolean {
  return rule.markerNames ? rule.markerNames.includes(name) : name.endsWith('Mark')
}

function markerChildren(node: SyntaxNode, rule: NodeRule): SyntaxNode[] {
  const out: SyntaxNode[] = []
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (isMarker(child.name, rule)) out.push(child)
  }
  return out
}

/**
 * The content range: the node minus any markers flush against its start and
 * its end. Interior markers (the `](` of a link) are left inside the content.
 */
function contentSpan(node: Span, markers: readonly Span[]): Span {
  let from = node.from
  let to = node.to
  for (const m of markers) {
    if (m.from === from) from = m.to
  }
  for (let i = markers.length - 1; i >= 0; i--) {
    const m = markers[i]!
    if (m.to === to) to = m.from
  }
  return from <= to ? { from, to } : { from, to: from }
}

/**
 * `(state, visibleRanges) -> decoration ranges`, as plain data.
 *
 * Pure and view-free so it can be tested directly (§7). Only the visible
 * ranges are walked — a whole-document tree walk makes large files lag
 * (trap #8).
 *
 * The returned array is sorted by `from`, then by kind so that a `replace`
 * at a position precedes a `mark` starting at the same position. Callers
 * feeding a RangeSetBuilder depend on that order (trap #5).
 */
export function buildDecorationRanges(
  state: EditorState,
  visible: readonly Span[],
  rules: RuleTable
): DecoRange[] {
  const out: DecoRange[] = []
  const seen = new Set<string>()
  const tree = syntaxTree(state)
  const selection = state.selection

  const visit = (ref: SyntaxNodeRef): void => {
    const rule = rules[ref.name]
    if (!rule) return

    // A node straddling the gap between two visible ranges is entered twice.
    const key = `${ref.name}:${ref.from}:${ref.to}`
    if (seen.has(key)) return
    seen.add(key)

    const node = ref.node
    const markers = markerChildren(node, rule)
    const content = contentSpan(node, markers)

    if (rule.whole && ref.to > ref.from) {
      out.push({ from: ref.from, to: ref.to, kind: 'mark', class: rule.whole })
    }
    if (rule.content && content.to > content.from) {
      out.push({ from: content.from, to: content.to, kind: 'mark', class: rule.content })
    }

    if (!markers.length) return

    const revealed = rule.keepMarkers || isRevealed(node, selection)
    for (const marker of markers) {
      if (marker.to <= marker.from) continue
      out.push(
        revealed
          ? {
              from: marker.from,
              to: marker.to,
              kind: 'mark',
              class: rule.marker ?? SYNTAX_CLASS
            }
          : { from: marker.from, to: marker.to, kind: 'replace' }
      )
    }
  }

  for (const range of visible) {
    tree.iterate({ from: range.from, to: range.to, enter: visit })
  }

  return sortDecoRanges(out)
}

/** Ascending `from`; `replace` before `mark`; then ascending `to`. */
export function sortDecoRanges(ranges: DecoRange[]): DecoRange[] {
  return ranges.sort(
    (a, b) =>
      a.from - b.from ||
      (a.kind === b.kind ? 0 : a.kind === 'replace' ? -1 : 1) ||
      a.to - b.to
  )
}
