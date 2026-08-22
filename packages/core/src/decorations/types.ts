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
 *  - `mark`    styles a range, leaving the text in place.
 *  - `replace` collapses a range to nothing. Inline only — never `block`.
 *  - `line`    adds a class to a whole line; `from === to === lineStart`.
 */
export type DecoKind = 'mark' | 'replace' | 'line'

export interface DecoRange extends Span {
  readonly kind: DecoKind
  /** CSS class, for `mark` and `line` ranges. */
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
  /** Class applied to every line the node spans. */
  readonly line?: string
  /**
   * Class applied to marker children while they are visible.
   * Defaults to `cm-md-syntax`.
   */
  readonly marker?: string
  /**
   * Markers of this node are never replaced inline. §4.2 hard exceptions:
   * front matter and tables — and fenced code, which hides its fences a line
   * at a time instead (`hideLines`).
   */
  readonly keepMarkers?: boolean
  /**
   * Child node names treated as markers. Defaults to any name ending in
   * `Mark`, which is the @lezer/markdown convention. `TaskMarker`,
   * `DashLine` and `TableDelimiter` have to be named explicitly.
   */
  readonly markerNames?: readonly string[]
  /**
   * Hide the whitespace that separates a marker from the content along with
   * the marker, so `# Heading` does not render with a leading space and
   * `## Closed ##` does not render with a trailing one.
   */
  readonly absorbSpace?: boolean
  /**
   * Collect markers from the whole subtree rather than the direct children.
   *
   * @lezer/markdown does not put every marker where you would expect: in
   * `> one\n> two` the second QuoteMark is a child of the Paragraph, not of
   * the Blockquote, because the second line is a lazy continuation.
   */
  readonly deepMarkers?: boolean
  /**
   * Collapse the node's own text rather than a child marker's. Used by
   * thematic breaks, where the `---` itself is the syntax and the line
   * decoration draws the rule.
   */
  readonly hideSelf?: boolean
  /**
   * Collapse the node's outer lines — the whole first and last line, when a
   * marker sits on them — while the node is not revealed. This is what makes
   * a fenced code block hide its ``` lines instead of leaving them as two
   * blank rows.
   *
   * Handled by the state field in `lines.ts`, not by the builder: replacing a
   * line break changes the vertical layout, and a ViewPlugin may not do that.
   * A block whose every line carries a marker is left alone — collapsing it
   * would erase it from the page entirely.
   */
  readonly hideLines?: boolean
}

export type RuleTable = Readonly<Record<string, NodeRule>>
