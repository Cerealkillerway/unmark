/** A half-open document range. */
export interface Span {
  readonly from: number
  readonly to: number
}

/**
 * A decoration described as plain data, so the builder can be unit-tested
 * without instantiating an EditorView (see §7: jsdom has no layout and
 * view-level tests are flaky).
 *
 *  - `mark`    styles the range, leaving the text in place.
 *  - `replace` collapses the range to nothing. Inline only — never `block`.
 */
export type DecoKind = 'mark' | 'replace'

export interface DecoRange extends Span {
  readonly kind: DecoKind
  /** CSS class, for `mark` ranges. */
  readonly class?: string
}

/**
 * How one syntax-tree node should be decorated.
 *
 * A node's *content* is what remains after its leading and trailing marker
 * children are removed. `**bold**` has content `bold`; the two `**` are markers.
 */
export interface NodeRule {
  /** Class applied to the content range. */
  readonly content?: string
  /** Class applied to the entire node range, markers included. */
  readonly whole?: string
  /**
   * Class applied to marker children while they are visible.
   * Defaults to `cm-md-syntax`.
   */
  readonly marker?: string
  /**
   * Markers of this node are never hidden. §4.2 hard exceptions: fenced code
   * (the language tag must stay editable) and front matter.
   */
  readonly keepMarkers?: boolean
  /**
   * Child node names treated as markers. Defaults to any name ending in
   * `Mark`, which is the @lezer/markdown convention.
   */
  readonly markerNames?: readonly string[]
}

export type RuleTable = Readonly<Record<string, NodeRule>>
