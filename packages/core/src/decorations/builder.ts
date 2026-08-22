import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { isRevealed } from './reveal.js'
import type { DecoRange, NodeRule, RuleTable, Span } from './types.js'

/** Class worn by a marker that is currently visible. */
export const SYNTAX_CLASS = 'cm-md-syntax'

/** @lezer/markdown names most syntax-character nodes `…Mark`. */
export function isMarker(name: string, rule: NodeRule): boolean {
  return rule.markerNames ? rule.markerNames.includes(name) : name.endsWith('Mark')
}

function markerChildren(node: SyntaxNode, rule: NodeRule): Span[] {
  const out: Span[] = []
  if (rule.deepMarkers) {
    node.toTree().iterate({
      enter: (child) => {
        if (child.from === 0 && child.to === node.to - node.from) return
        if (isMarker(child.name, rule)) {
          out.push({ from: node.from + child.from, to: node.from + child.to })
        }
      }
    })
    return out
  }
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (isMarker(child.name, rule)) out.push({ from: child.from, to: child.to })
  }
  return out
}

const isSpace = (ch: string): boolean => ch === ' ' || ch === '\t'

/**
 * Grow a marker over the whitespace that separates it from the content, so
 * hiding `#` in `# Heading` does not leave the heading indented by one and
 * hiding the closing `##` of `## Closed ##` does not leave a trailing space.
 *
 * A marker opening a line grows rightwards; one closing the node grows
 * leftwards. Never crosses a line boundary.
 */
function absorbSpaces(state: EditorState, span: Span, node: Span): Span {
  let { from, to } = span

  const startLine = state.doc.lineAt(from)
  if (from === node.from || from === startLine.from) {
    const endLine = state.doc.lineAt(to)
    while (to < endLine.to && isSpace(state.doc.sliceString(to, to + 1))) to++
  }

  if (to === node.to) {
    const line = state.doc.lineAt(from)
    while (from > line.from && isSpace(state.doc.sliceString(from - 1, from))) from--
  }

  return { from, to }
}

/**
 * The content range: the node minus any markers flush against its start and
 * its end. Interior markers (the `](` of a link, the `>` starting the second
 * line of a blockquote) stay inside the content.
 */
function contentSpan(node: Span, markers: readonly Span[]): Span {
  let from = node.from
  let to = node.to
  for (const m of markers) {
    if (m.from <= from && m.to > from) from = m.to
  }
  for (let i = markers.length - 1; i >= 0; i--) {
    const m = markers[i]!
    if (m.to >= to && m.from < to) to = m.from
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
 * The returned array is sorted so a RangeSetBuilder will accept it (trap #5).
 */
export function buildDecorationRanges(
  state: EditorState,
  visible: readonly Span[],
  rules: RuleTable
): DecoRange[] {
  const out: DecoRange[] = []
  const seen = new Set<string>()
  const seenLines = new Set<string>()
  const tree = syntaxTree(state)
  const selection = state.selection

  const addLines = (span: Span, cls: string): void => {
    let pos = span.from
    while (pos <= span.to) {
      const line = state.doc.lineAt(pos)
      const key = `${cls}:${line.from}`
      if (!seenLines.has(key)) {
        seenLines.add(key)
        out.push({ from: line.from, to: line.from, kind: 'line', class: cls })
      }
      if (line.to >= span.to) break
      pos = line.to + 1
    }
  }

  const visit = (ref: SyntaxNodeRef): void => {
    const rule = rules[ref.name]
    if (!rule) return

    // A node straddling the gap between two visible ranges is entered twice.
    const key = `${ref.name}:${ref.from}:${ref.to}`
    if (seen.has(key)) return
    seen.add(key)

    const node = ref.node
    const revealed = rule.keepMarkers || isRevealed(node, selection)

    if (rule.line) addLines(node, rule.line)

    if (rule.hideSelf) {
      if (ref.to > ref.from) {
        out.push(
          revealed
            ? { from: ref.from, to: ref.to, kind: 'mark', class: rule.marker ?? SYNTAX_CLASS }
            : { from: ref.from, to: ref.to, kind: 'replace' }
        )
      }
      return
    }

    let markers = markerChildren(node, rule)
    if (rule.absorbSpace) {
      markers = markers.map((m) => absorbSpaces(state, m, node))
    }
    const content = contentSpan(node, markers)

    if (rule.whole && ref.to > ref.from) {
      out.push({ from: ref.from, to: ref.to, kind: 'mark', class: rule.whole })
    }
    if (rule.content && content.to > content.from) {
      out.push({ from: content.from, to: content.to, kind: 'mark', class: rule.content })
    }

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

  return dedupe(sortDecoRanges(out))
}

/**
 * Nested nodes of the same shape can emit the same decoration twice — an inner
 * blockquote's QuoteMark is also a deep marker of the outer one.
 */
function dedupe(sorted: readonly DecoRange[]): DecoRange[] {
  const out: DecoRange[] = []
  for (const r of sorted) {
    const prev = out[out.length - 1]
    if (
      prev &&
      prev.from === r.from &&
      prev.to === r.to &&
      prev.kind === r.kind &&
      prev.class === r.class
    ) {
      continue
    }
    out.push(r)
  }
  return out
}

const KIND_ORDER: Record<DecoRange['kind'], number> = { line: 0, replace: 1, mark: 2 }

/** Ascending `from`; line before replace before mark; then ascending `to`. */
export function sortDecoRanges(ranges: DecoRange[]): DecoRange[] {
  return ranges.sort(
    (a, b) => a.from - b.from || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.to - b.to
  )
}
