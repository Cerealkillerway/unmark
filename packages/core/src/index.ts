/**
 * @md/core — inline-WYSIWYG markdown editing for CodeMirror 6.
 *
 * I1: the EditorState doc holds the raw markdown, byte for byte as it exists
 * on disk. There is no rich document model and no serialization step —
 * rendering is decorations layered over that text, and nothing else.
 */

export { createEditor, defaultCommands, defaultRules, markdownSetup } from './editor.js'
export type { CreateEditorConfig, MarkdownSetupOptions } from './editor.js'

export {
  detectLineSeparator,
  hasMixedLineEndings,
  lineSeparatorFor,
  serializeDocument
} from './document.js'
export type { LineSeparator } from './document.js'

export {
  CLIPBOARD_SENTINEL,
  isOwnHtml,
  markdownClipboard,
  markdownToHtml,
  wrapWithSentinel
} from './clipboard/index.js'
export type { ClipboardOptions, MarkdownHtmlResult } from './clipboard/index.js'

export { markdownLinks, urlAt, MOD_HELD_CLASS } from './links.js'
export type { LinkOptions } from './links.js'

export { markdownLanguage } from './markdown.js'
export type { MarkdownLanguageOptions } from './markdown.js'

export { buildDecorationRanges, sortDecoRanges, SYNTAX_CLASS } from './decorations/builder.js'
export { markdownDecorations, toDecorationSet } from './decorations/plugin.js'
export { collapsedLines, collapsedLineRanges, collapsibleBlocks } from './decorations/lines.js'
export type { Collapsible } from './decorations/lines.js'
export {
  imagePreviews,
  imagePreviewsInstalled,
  imagePreviewActive,
  toggleImagePreview
} from './decorations/images.js'
export type { ImageOptions } from './decorations/images.js'
export { tablePreviews, tablesIn, renderedUnits, rowMotionTarget, cellInlines } from './decorations/tables.js'
export type { Align, Inline, InlineTag, RenderRow, TableOptions } from './decorations/tables.js'
export {
  markdownSearch,
  searchCommands,
  searchInstalledIn,
  findPanelOpen,
  matchTally,
  tallyLabel
} from './search.js'
export type { MatchTally, SearchOptions } from './search.js'
export { isLineRevealed, isRevealed } from './decorations/reveal.js'
export { inlineRules } from './decorations/inline.js'
export { blockRules, linkRules } from './decorations/block.js'
export type { DecoKind, DecoRange, NodeRule, RuleTable, Span } from './decorations/types.js'

export {
  bindingsFor,
  commandKeymap,
  CommandRegistry,
  formatCommands,
  headingPrefix,
  toAccelerator,
  toggleLinePrefix,
  toggleLink,
  toggleWrap,
  toKeyBinding,
  viewCommands,
  PREFIX_BULLET,
  PREFIX_ORDERED,
  PREFIX_QUOTE,
  PREFIX_TASK,
  WRAP_CODE,
  WRAP_EMPHASIS,
  WRAP_STRIKETHROUGH,
  WRAP_STRONG
} from './commands/index.js'
export type {
  AppBridge,
  CommandContext,
  CommandDef,
  CommandDescriptor,
  CommandScope,
  ContextFor,
  LinePrefixSpec,
  WrapSpec
} from './commands/index.js'

export { markdownTheme } from './theme/theme.js'
export { markdownHighlightStyle } from './theme/highlight.js'

export const version = '0.1.0'
