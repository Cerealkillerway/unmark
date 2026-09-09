import {
  bracketMatching,
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
import { markdownClipboard, type ClipboardOptions } from './clipboard/index.js'
import { commandKeymap } from './commands/keymap.js'
import { formatCommands } from './commands/format.js'
import { viewCommands } from './commands/view.js'
import { CommandRegistry } from './commands/registry.js'
import type { AppBridge } from './commands/types.js'
import { lineSeparatorFor, serializeDocument } from './document.js'
import { markdownLinks, type LinkOptions } from './links.js'
import { imagePreviews, type ImageOptions } from './decorations/images.js'
import { tablePreviews, type TableOptions } from './decorations/tables.js'
import { markdownDecorations } from './decorations/plugin.js'
import { blockRules, linkRules } from './decorations/block.js'
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
  /**
   * The registry the keymap is derived from (I4). Pass the same instance the
   * shell builds its menus and palette from, so a shortcut and a menu item can
   * never disagree. `false` omits the format keymap entirely.
   */
  commands?: CommandRegistry | false
  /** Handed to every command as `ctx.app`. */
  app?: AppBridge
  /**
   * Dual-format copy and HTML paste (§4.6). `false` leaves CodeMirror's own
   * plain-text clipboard in place.
   */
  clipboard?: ClipboardOptions | false
  /** Mod-click to follow a link. `false` leaves links inert. */
  links?: LinkOptions | false
  /**
   * Render images in place. Off unless configured: `src` resolution needs to
   * know where the document lives, which only the shell can say.
   */
  images?: ImageOptions | false
  /**
   * Render tables a row at a time, under the reveal rule. On by default: it
   * needs nothing from the shell, unlike images, whose `src` only the shell
   * can resolve. `false` leaves a table as the styled monospace source it was.
   */
  tables?: TableOptions | false
}

/** Every rule the decoration plugin knows about. */
export function defaultRules(): RuleTable {
  return { ...blockRules, ...linkRules, ...inlineRules }
}

/**
 * A fresh registry holding the built-in format commands.
 *
 * Fresh, not shared: `register` throws on duplicate ids, so a module-level
 * singleton would make two editors on one page fight over it.
 */
export function defaultCommands(): CommandRegistry {
  return new CommandRegistry([...formatCommands, ...viewCommands])
}

/**
 * The @md/core extension bundle: markdown parsing, inline-WYSIWYG decorations,
 * theme, and the editing basics that make a text field usable.
 *
 * Line wrapping is on because this is a prose editor.
 */
export function markdownSetup(options: MarkdownSetupOptions = {}): Extension[] {
  const {
    rules = defaultRules(),
    theme = true,
    commands = defaultCommands(),
    app = {},
    clipboard = {},
    links = {},
    images = false,
    tables = {},
    ...language
  } = options

  return [
    markdownLanguage(language),
    markdownDecorations(rules),
    ...(clipboard === false ? [] : [markdownClipboard(clipboard)]),
    ...(links === false ? [] : [markdownLinks(links)]),
    ...(images === false ? [] : [imagePreviews(images)]),
    ...(tables === false ? [] : [tablePreviews(tables)]),

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

    // Prec.high lives inside commandKeymap — without it the base keymap below
    // wins on overlapping bindings.
    ...(commands === false ? [] : [commandKeymap(commands, (view) => ({ view, app }))]),
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
          // serializeDocument, not doc.toString(): Text always joins with \n,
          // which would silently rewrite a CRLF file (I1).
          if (update.docChanged) onChange(serializeDocument(update.state), update.view)
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
