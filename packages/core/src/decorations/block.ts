import type { NodeRule, RuleTable } from './types.js'

const heading = (level: 1 | 2 | 3 | 4 | 5 | 6): NodeRule => ({
  line: `cm-md-line-h${level}`,
  content: `cm-md-h${level}`,
  absorbSpace: true
})

/**
 * Setext headings keep their underline visible, styled as syntax.
 *
 * Hiding it would mean collapsing the line, and a replacing decoration that
 * covers a line break cannot be supplied by a ViewPlugin — CodeMirror computes
 * vertical layout before plugins update, so those must come from a state
 * field. There is now such a field — `lines.ts`, which fenced code uses — and
 * `hideLines` here would collapse the underline. It stays visible anyway: a
 * setext heading is already styled as a heading, and an underline that
 * disappears leaves `Title` looking like a paragraph the reader cannot tell
 * from one. §4.2 lists it as an exception; nothing has changed that.
 */
const setext = (level: 1 | 2): NodeRule => ({
  line: `cm-md-line-h${level}`,
  content: `cm-md-h${level}`,
  keepMarkers: true
})

/**
 * Block nodes (Phase 2).
 *
 * Two groups keep their markers on purpose:
 *  - Frontmatter: §4.2 hard exception.
 *  - Lists and tables: hiding `1.` would destroy the numbering and hiding a
 *    table's pipes would destroy the column structure. §4.2 puts tables out of
 *    scope for v1 — styled monospace, no hiding.
 *
 * FencedCode used to be a third: its markers were kept because a fence cannot
 * be hidden with an inline `replace` — the line would stay behind as a blank
 * row — and the language tag has to stay editable. It now hides its two fence
 * lines whole (`hideLines`, see `lines.ts`), and the caret landing anywhere on
 * the block brings them back, language tag included.
 */
export const blockRules: RuleTable = {
  ATXHeading1: heading(1),
  ATXHeading2: heading(2),
  ATXHeading3: heading(3),
  ATXHeading4: heading(4),
  ATXHeading5: heading(5),
  ATXHeading6: heading(6),
  SetextHeading1: setext(1),
  SetextHeading2: setext(2),

  Blockquote: {
    line: 'cm-md-line-quote',
    content: 'cm-md-quote',
    absorbSpace: true,
    // The QuoteMark opening a lazy continuation line lives under Paragraph.
    deepMarkers: true,
    markerNames: ['QuoteMark']
  },

  BulletList: { line: 'cm-md-line-list' },
  OrderedList: { line: 'cm-md-line-list' },
  ListItem: { keepMarkers: true, marker: 'cm-md-list-mark' },
  Task: { keepMarkers: true, marker: 'cm-md-task-mark', markerNames: ['TaskMarker'] },

  // The `---` is the syntax; the line decoration draws the actual rule.
  HorizontalRule: { line: 'cm-md-line-hr', hideSelf: true },

  // `keepMarkers` and `hideLines` together: the builder never replaces a fence
  // inline (that would leave the line behind, empty), and the state field
  // takes the whole line away instead.
  FencedCode: {
    line: 'cm-md-line-code',
    keepMarkers: true,
    hideLines: true,
    marker: 'cm-md-fence'
  },
  CodeInfo: { whole: 'cm-md-code-info' },
  CodeBlock: { line: 'cm-md-line-code' },

  Frontmatter: {
    line: 'cm-md-line-frontmatter',
    keepMarkers: true,
    marker: 'cm-md-fence',
    markerNames: ['DashLine']
  },

  Table: { line: 'cm-md-line-table', keepMarkers: true },
  TableDelimiter: { whole: 'cm-md-table-delim' },
  TableHeader: { whole: 'cm-md-table-header' }
}

/**
 * Links and images. The URL is styled but never hidden in v1 — collapsing a
 * link to its label needs a widget and Mod-click handling, which is Phase 8.
 */
/**
 * Links collapse to their label; the URL comes back when the caret moves in.
 *
 * `URL` and `LinkTitle` are listed as markers so they fold away with the
 * brackets — they are syntax from the reader's point of view, even though the
 * parser does not name them `*Mark`. Mod-click (see `links.ts`) is what
 * replaces the lost ability to click through.
 */
export const linkRules: RuleTable = {
  Link: {
    marker: 'cm-md-link-mark',
    content: 'cm-md-link',
    markerNames: ['LinkMark', 'URL', 'LinkTitle']
  },
  Image: {
    marker: 'cm-md-link-mark',
    content: 'cm-md-link',
    markerNames: ['LinkMark', 'URL', 'LinkTitle']
  },
  Autolink: { marker: 'cm-md-link-mark', markerNames: ['LinkMark'] },
  URL: { whole: 'cm-md-url' },
  LinkLabel: { whole: 'cm-md-link-label' },
  LinkReference: { line: 'cm-md-line-linkref' }
}
