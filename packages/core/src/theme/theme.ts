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
  }
})
