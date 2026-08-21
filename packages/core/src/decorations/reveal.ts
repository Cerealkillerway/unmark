import type { EditorSelection } from '@codemirror/state'
import type { Span } from './types.js'

/**
 * The one reveal rule (§4.2), applied identically to every node.
 *
 * A node's markers are hidden unless some range of the current selection
 * overlaps the node's interior:
 *
 *     R.from < N.to && R.to > N.from
 *
 * Empty selections and multi-range selections both fall out of this formula:
 * for a caret at `p` it reduces to `N.from < p < N.to`, i.e. strictly inside.
 *
 * NOTE ON THE SPEC. §4.2 writes this predicate with inclusive bounds
 * (`R.from <= N.to && R.to >= N.from`). That version contradicts §1 and the
 * Phase 1 acceptance criterion — both require that typing the final `*` of
 * `**test**` *hides* the markers, and after that keystroke the caret sits
 * exactly at `N.to`, which the inclusive form would reveal. Strict overlap is
 * the only reading that satisfies the stated behaviour, and it keeps §4.2's
 * intent everywhere else: entering the node, including its markers, reveals it.
 *
 * Nested nodes are evaluated independently, so an inner `code` inside an outer
 * `strong` can be revealed on its own.
 */
export function isRevealed(node: Span, selection: EditorSelection): boolean {
  for (const range of selection.ranges) {
    if (range.from < node.to && range.to > node.from) return true
  }
  return false
}
