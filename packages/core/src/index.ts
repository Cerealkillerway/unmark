/**
 * @md/core — inline-WYSIWYG markdown editing for CodeMirror 6.
 *
 * I1: the EditorState doc holds the raw markdown, byte for byte as it exists
 * on disk. There is no rich document model and no serialization step —
 * rendering is decorations layered over that text, and nothing else.
 */

export { createEditor, defaultRules, markdownSetup } from './editor.js'
export type { CreateEditorConfig, MarkdownSetupOptions } from './editor.js'

export {
  detectLineSeparator,
  hasMixedLineEndings,
  lineSeparatorFor,
  serializeDocument
} from './document.js'
export type { LineSeparator } from './document.js'

export { markdownLanguage } from './markdown.js'
export type { MarkdownLanguageOptions } from './markdown.js'

export { buildDecorationRanges, sortDecoRanges, SYNTAX_CLASS } from './decorations/builder.js'
export { markdownDecorations, toDecorationSet } from './decorations/plugin.js'
export { isRevealed } from './decorations/reveal.js'
export { inlineRules } from './decorations/inline.js'
export type { DecoKind, DecoRange, NodeRule, RuleTable, Span } from './decorations/types.js'

export { markdownTheme } from './theme/theme.js'
export { markdownHighlightStyle } from './theme/highlight.js'

export const version = '0.1.0'
