import { EditorView } from '@codemirror/view'
import './core.css'

/**
 * The CodeMirror theme. Every declaration resolves through the custom
 * properties in core.css (§4.7 / I5) — there are no literal colours here, so
 * a consuming app can retheme the editor without touching a `.cm-*` selector.
 */
export const markdownTheme = EditorView.theme({
  '&': {
    color: 'var(--md-color-text)',
    backgroundColor: 'var(--md-color-bg)',
    fontFamily: 'var(--md-font-body)',
    fontSize: 'var(--md-font-size)',
    height: '100%'
  },
  '.cm-scroller': {
    fontFamily: 'var(--md-font-body)',
    lineHeight: 'var(--md-line-height)',
    overflowY: 'auto'
  },
  '.cm-content': {
    padding: 'var(--md-content-padding)',
    maxWidth: 'var(--md-content-width)',
    margin: '0 auto',
    caretColor: 'var(--md-color-cursor)'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-line': { padding: '0' },

  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--md-color-cursor)',
    borderLeftWidth: '1.5px'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--md-color-selection)'
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },

  /* Revealed syntax characters. */
  '.cm-md-syntax': {
    fontFamily: 'var(--md-font-mono)',
    fontSize: 'var(--md-mono-size)',
    fontWeight: '400',
    fontStyle: 'normal',
    color: 'var(--md-color-accent-soft)'
  },

  /* Inline. */
  '.cm-md-strong': { fontWeight: '600', color: 'var(--md-color-strong)' },
  '.cm-md-em': { fontStyle: 'italic' },
  '.cm-md-strike': { textDecoration: 'line-through', color: 'var(--md-color-muted)' },
  '.cm-md-code': {
    fontFamily: 'var(--md-font-mono)',
    fontSize: 'var(--md-mono-size)',
    color: 'var(--md-color-code)',
    backgroundColor: 'var(--md-color-code-bg)',
    border: '1px solid var(--md-color-code-border)',
    borderRadius: '4px',
    padding: '0.05em 0.32em'
  },

  /* Headings. Sizes live on the line so the whole line reflows. */
  '.cm-md-line-h1': { fontSize: 'var(--md-h1-size)', lineHeight: 'var(--md-heading-line-height)', padding: '0.7em 0 0.15em' },
  '.cm-md-line-h2': { fontSize: 'var(--md-h2-size)', lineHeight: 'var(--md-heading-line-height)', padding: '0.7em 0 0.1em' },
  '.cm-md-line-h3': { fontSize: 'var(--md-h3-size)', lineHeight: 'var(--md-heading-line-height)', padding: '0.6em 0 0.1em' },
  '.cm-md-line-h4': { fontSize: 'var(--md-h4-size)', padding: '0.5em 0 0.1em' },
  '.cm-md-line-h5': { fontSize: 'var(--md-h5-size)', padding: '0.5em 0 0.1em' },
  '.cm-md-line-h6': { fontSize: 'var(--md-h6-size)', padding: '0.5em 0 0.1em' },
  '.cm-md-h1, .cm-md-h2, .cm-md-h3, .cm-md-h4, .cm-md-h5, .cm-md-h6': {
    fontWeight: 'var(--md-heading-weight)',
    color: 'var(--md-color-heading)',
    letterSpacing: '-0.012em'
  },

  /* Blockquote. */
  '.cm-md-line-quote': {
    borderLeft: '2px solid var(--md-color-quote-border)',
    paddingLeft: '1.1em',
    color: 'var(--md-color-quote)'
  },
  '.cm-md-quote': { fontStyle: 'italic' },

  /* Lists — markers stay visible; hiding `1.` would destroy the numbering. */
  '.cm-md-line-list': { paddingLeft: '1.4em', textIndent: '-1.4em' },
  '.cm-md-list-mark': {
    fontFamily: 'var(--md-font-mono)',
    fontSize: 'var(--md-mono-size)',
    color: 'var(--md-color-marker)'
  },
  '.cm-md-task-mark': {
    fontFamily: 'var(--md-font-mono)',
    fontSize: 'var(--md-mono-size)',
    color: 'var(--md-color-accent)'
  },

  /* Thematic break: the `---` collapses and the line draws the rule. */
  '.cm-md-line-hr': {
    display: 'flex',
    alignItems: 'center',
    minHeight: '1.6em',
    position: 'relative'
  },
  '.cm-md-line-hr::after': {
    content: '""',
    position: 'absolute',
    left: '0',
    right: '0',
    top: '50%',
    borderTop: '1px solid var(--md-color-rule)'
  },

  /* Code blocks and front matter. */
  '.cm-md-line-code, .cm-md-line-frontmatter': {
    fontFamily: 'var(--md-font-mono)',
    fontSize: 'var(--md-mono-size)',
    backgroundColor: 'var(--md-color-code-bg)',
    color: 'var(--md-color-code)'
  },
  '.cm-md-line-code': { paddingLeft: '0.9em', paddingRight: '0.9em' },
  '.cm-md-line-frontmatter': { paddingLeft: '0.9em', color: 'var(--md-color-muted)' },
  '.cm-md-fence': { color: 'var(--md-color-marker)' },
  '.cm-md-code-info': { color: 'var(--md-color-accent-soft)' },

  /* Tables. A revealed row — the one the caret is on — is its markdown, in
     monospace so the pipes line up with the row above and below it. */
  '.cm-md-line-table': {
    fontFamily: 'var(--md-font-mono)',
    fontSize: 'var(--md-mono-size)'
  },
  '.cm-md-table-delim': { color: 'var(--md-color-marker)' },
  '.cm-md-table-header': { fontWeight: '600', color: 'var(--md-color-strong)' },

  /* ...and every row that is not being edited is drawn.

     Each row is its own widget, so that vertical motion and clicks address a
     row rather than the whole table. `--md-table-width` is how a table escapes
     the prose measure: it is a width for the wrapper, and the matching negative
     margins re-centre it over the text column. */
  '.cm-md-table-wrap': {
    overflowX: 'auto',
    /* Resolved *here*, on the element that inherits `--md-table-available`.
       A custom property substitutes its own `var()`s at the element it is
       declared on, so the same expression written on `:root` — or on an app's
       theme block — would look the measured width up where it does not exist
       and silently fall back to the prose measure every time. */
    '--md-table-w':
      'var(--md-table-width, max(100%, calc(var(--md-table-available, 100%) - var(--md-table-gutter, 3rem))))',
    width: 'var(--md-table-w)',
    marginInline: 'calc((100% - var(--md-table-w)) / 2)'
  },
  '.cm-md-table': {
    width: '100%',
    borderCollapse: 'collapse',
    /* The widths the widget sets on <col> only bind under fixed layout, and
       they are what makes separately drawn rows line up as one table. */
    tableLayout: 'fixed'
  },
  '.cm-md-table th, .cm-md-table td': {
    border: '1px solid var(--md-color-table-border)',
    /* Adjacent rows are separate <table> elements, so a top border on each
       would draw every interior rule twice. Only the row that starts a run
       carries one — see `top` in tables.ts. */
    borderTopWidth: '0',
    padding: '0.35em 0.6em',
    verticalAlign: 'top',
    textAlign: 'left',
    /* A long unbroken cell must not widen the column it was apportioned. */
    overflowWrap: 'anywhere'
  },
  '.cm-md-table-top th, .cm-md-table-top td': { borderTopWidth: '1px' },
  '.cm-md-table th': {
    fontWeight: '600',
    color: 'var(--md-color-strong)',
    backgroundColor: 'var(--md-color-table-header-bg)'
  },
  '.cm-md-table-code': {
    fontFamily: 'var(--md-font-mono)',
    fontSize: 'var(--md-mono-size)',
    color: 'var(--md-color-code)'
  },

  /* Links. */
  '.cm-md-link': { color: 'var(--md-color-link)' },
  '.cm-md-link-mark': {
    fontFamily: 'var(--md-font-mono)',
    fontSize: 'var(--md-mono-size)',
    color: 'var(--md-color-marker)'
  },
  '.cm-md-url, .cm-md-link-label': {
    fontFamily: 'var(--md-font-mono)',
    fontSize: 'var(--md-mono-size)',
    color: 'var(--md-color-muted)'
  },
  '.cm-md-line-linkref': { color: 'var(--md-color-muted)' },

  /* Images. */
  '.cm-md-image-wrap': {
    display: 'inline-block',
    verticalAlign: 'top'
  },
  '.cm-md-image': {
    display: 'inline-block',
    maxWidth: '100%',
    borderRadius: '6px',
    border: '1px solid var(--md-color-border)',
    verticalAlign: 'top'
  },

  /*
   * A source that will not load — unresolvable, or broken on load. Deliberately
   * legible rather than decorative: the alt text is the only clue to which
   * image failed, so it stays readable and the frame around it just says
   * "picture, missing".
   */
  '.cm-md-image-broken': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4em',
    maxWidth: '100%',
    padding: '0.15em 0.5em',
    borderRadius: '6px',
    border: '1px dashed var(--md-color-border)',
    color: 'var(--md-color-muted)',
    verticalAlign: 'top'
  },
  '.cm-md-image-broken-icon': {
    width: '1.1em',
    height: '1.1em',
    flex: '0 0 auto'
  },
  '.cm-md-image-broken-label': {
    fontFamily: 'var(--md-font-mono)',
    fontSize: 'var(--md-mono-size)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },

  /*
   * The floating preview shown while the caret is inside an image's markdown.
   * `.cm-tooltip` already carries a border and background from CodeMirror's
   * base theme; both are overridden here so the panel follows §4.7's custom
   * properties like everything else.
   */
  '.cm-tooltip:has(.cm-md-image-lightbox)': {
    border: '1px solid var(--md-color-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--md-color-bg)',
    overflow: 'hidden'
  },
  // The content inside is display:block or inline-flex, so there is no
  // baseline gap to collapse and no line-height to set — which keeps §4.7's
  // "typography comes from the contract" rule intact here.
  '.cm-md-image-lightbox': {
    display: 'block',
    padding: '4px'
  },
  '.cm-md-image-lightbox img': {
    display: 'block',
    maxWidth: 'min(420px, 60vw)',
    borderRadius: '4px'
  },
  '.cm-md-image-lightbox .cm-md-image-broken': {
    border: '0',
    whiteSpace: 'normal'
  },

  /* Holding Mod turns links into something you can click. */
  '&.cm-md-mod .cm-md-link': {
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationColor: 'var(--md-color-link-underline)'
  }
})
