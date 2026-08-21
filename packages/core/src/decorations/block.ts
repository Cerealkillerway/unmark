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
 * field. Rather than run a second decoration source for one rare construct,
 * the underline is shown in muted syntax type under the heading. This is the
 * same kind of documented exception as §4.2's fences and front matter.
 */
const setext = (level: 1 | 2): NodeRule => ({
  line: `cm-md-line-h${level}`,
  content: `cm-md-h${level}`,
  keepMarkers: true
})

/**
 * Block nodes (Phase 2).
 *
 * Three groups keep their markers on purpose:
 *  - FencedCode: §4.2 hard exception. The fences and the info string are
 *    structural and the language tag must stay editable.
 *  - Frontmatter: §4.2 hard exception.
 *  - Lists and tables: hiding `1.` would destroy the numbering and hiding a
 *    table's pipes would destroy the column structure. §4.2 puts tables out of
 *    scope for v1 — styled monospace, no hiding.
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

  FencedCode: { line: 'cm-md-line-code', keepMarkers: true, marker: 'cm-md-fence' },
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
export const linkRules: RuleTable = {
  Link: { keepMarkers: true, marker: 'cm-md-link-mark', content: 'cm-md-link' },
  Image: { keepMarkers: true, marker: 'cm-md-link-mark', content: 'cm-md-link' },
  Autolink: { keepMarkers: true, marker: 'cm-md-link-mark' },
  URL: { whole: 'cm-md-url' },
  LinkLabel: { whole: 'cm-md-link-label' },
  LinkReference: { line: 'cm-md-line-linkref' }
}
