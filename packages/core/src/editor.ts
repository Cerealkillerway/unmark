import {
  bracketMatching,
  foldGutter,
  indentOnInput,
  syntaxHighlighting
} from '@codemirror/language'
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands'
import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightSpecialChars,
  keymap,
  rectangularSelection
} from '@codemirror/view'
import { lineSeparatorFor } from './document.js'
import { markdownDecorations } from './decorations/plugin.js'
import { inlineRules } from './decorations/inline.js'
import type { RuleTable } from './decorations/types.js'
import { markdownLanguage, type MarkdownLanguageOptions } from './markdown.js'
import { markdownHighlightStyle } from './theme/highlight.js'
import { markdownTheme } from './theme/theme.js'

export interface MarkdownSetupOptions extends MarkdownLanguageOptions {
  /** Replace or extend the node -> decoration rules. */
  rules?: RuleTable
  /** Drop the bundled theme and highlight style. */
  theme?: boolean
}

/** Every rule the decoration plugin knows about. */
export function defaultRules(): RuleTable {
  return { ...inlineRules }
}

/**
 * The @md/core extension bundle: markdown parsing, inline-WYSIWYG decorations,
 * theme, and the editing basics that make a text field usable.
 *
 * Line wrapping is on because this is a prose editor.
 */
export function markdownSetup(options: MarkdownSetupOptions = {}): Extension[] {
  const { rules = defaultRules(), theme = true, ...language } = options

  return [
    markdownLanguage(language),
    markdownDecorations(rules),

    history(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    highlightSpecialChars(),
    indentOnInput(),
    bracketMatching(),
    EditorState.allowMultipleSelections.of(true),
    EditorView.lineWrapping,
    EditorView.editorAttributes.of({ class: 'cm-md-editor' }),
    EditorView.contentAttributes.of({ spellcheck: 'true', autocapitalize: 'off' }),

    keymap.of([...defaultKeymap, ...historyKeymap]),

    ...(theme ? [markdownTheme, syntaxHighlighting(markdownHighlightStyle)] : [])
  ]
}

export interface CreateEditorConfig extends MarkdownSetupOptions {
  /** Initial markdown. I1: this string is the document, byte for byte. */
  doc?: string
  parent: Element | DocumentFragment
  /** Extensions appended after the bundle, so they win on conflicts. */
  extensions?: Extension[]
  onChange?: (doc: string, view: EditorView) => void
}

/**
 * Convenience factory. I3: the view is created once and owned by the caller;
 * later document changes arrive through `view.dispatch()`, never by rebuilding.
 */
export function createEditor(config: CreateEditorConfig): EditorView {
  const { doc = '', parent, extensions = [], onChange, ...setup } = config

  const listener = onChange
    ? [
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString(), update.view)
        })
      ]
    : []

  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        // Must come first: it decides how `doc` is split into lines (I1).
        ...lineSeparatorFor(doc),
        ...markdownSetup(setup),
        ...listener,
        ...extensions
      ]
    })
  })
}

// foldGutter is re-exported so apps can opt in without adding a CodeMirror dep.
export { foldGutter }
