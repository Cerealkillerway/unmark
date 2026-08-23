import type { EditorSelection } from '@codemirror/state'
import type { Span } from './types.js'

/**
 * The one reveal rule (§4.2), applied identically to every node.
 *
 * For a caret, the positions that reveal a node are the half-open interval
 * `[N.from, N.to)`. For a selection, it is strict overlap:
 *
 *     caret:     N.from <= p < N.to
 *     selection: R.from < N.to && R.to > N.from
 *
 * The two ends are deliberately not symmetric.
 *
 * `N.to` is excluded because of §1 and the Phase 1 acceptance criterion: after
 * typing the final `*` of `**test**` the caret sits exactly at `N.to`, and the
 * whole promise of the editor is that the bold renders on that keystroke. An
 * inclusive end would leave the markers up instead.
 *
 * `N.from` is included because the first position of a node is a place a
 * keystroke can still change what the node *is*, and you cannot edit what you
 * cannot see. Turning `[link](img.jpg)` into `![link](img.jpg)` means typing a
 * `!` at exactly `N.from`; with that position hidden, the caret fell out of
 * edit mode on the way there and the marker collapsed just as it was needed.
 * The same goes for prepending a `!`, a `#`, or a `>` to anything else.
 *
 * NOTE ON THE SPEC. §4.2 writes this predicate with inclusive bounds on both
 * sides (`R.from <= N.to && R.to >= N.from`). That contradicts the Phase 1
 * criterion above, so the end stays exclusive; the start is what §4.2 gets
 * right and strict overlap got wrong.
 *
 * A selection is judged by strict overlap at both ends, so one that merely
 * abuts a node — ending exactly where the node begins — does not reveal it.
 * A caret is a position *in* the text; a range that stops short of a node has
 * not reached it.
 *
 * Nested nodes are evaluated independently, so an inner `code` inside an outer
 * `strong` can be revealed on its own.
 */
export function isRevealed(node: Span, selection: EditorSelection): boolean {
  for (const range of selection.ranges) {
    if (range.empty) {
      if (range.from >= node.from && range.from < node.to) return true
    } else if (range.from < node.to && range.to > node.from) {
      return true
    }
  }
  return false
}

export function isLineRevealed(lines: Span, selection: EditorSelection): boolean {
  for (const range of selection.ranges) {
    if (range.from <= lines.to && range.to >= lines.from) return true
  }
  return false
}
