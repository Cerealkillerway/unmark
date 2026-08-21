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

  /* Tables — out of scope for v1 (§4.2): styled monospace, nothing hidden. */
  '.cm-md-line-table': {
    fontFamily: 'var(--md-font-mono)',
    fontSize: 'var(--md-mono-size)'
  },
  '.cm-md-table-delim': { color: 'var(--md-color-marker)' },
  '.cm-md-table-header': { fontWeight: '600', color: 'var(--md-color-strong)' },

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

  /* Image previews. */
  '.cm-md-image': {
    display: 'inline-block',
    maxWidth: '100%',
    borderRadius: '6px',
    border: '1px solid var(--md-color-border)',
    verticalAlign: 'top'
  },
  '.cm-md-image-missing': {
    fontFamily: 'var(--md-font-mono)',
    fontSize: 'var(--md-mono-size)',
    color: 'var(--md-color-muted)',
    borderBottom: '1px dashed var(--md-color-border)'
  },

  /* Holding Mod turns links into something you can click. */
  '&.cm-md-mod .cm-md-link': {
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationColor: 'var(--md-color-link-underline)'
  }
})
