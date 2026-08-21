import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import type { LanguageDescription } from '@codemirror/language'
import { GFM, type MarkdownConfig } from '@lezer/markdown'
import type { Extension } from '@codemirror/state'

export interface MarkdownLanguageOptions {
  /**
   * Languages available to fenced code blocks (§4.5). Defaults to the full
   * @codemirror/language-data set, lazily loaded from the info string, so
   * fenced contents are parsed by the nested language's own Lezer parser and
   * produce real syntax nodes. Pass `[]` to disable.
   */
  codeLanguages?: readonly LanguageDescription[]
  /**
   * Extra @lezer/markdown *parser* extensions. Named distinctly from
   * CodeMirror's `extensions` because the two are not interchangeable.
   */
  parserExtensions?: MarkdownConfig[]
}

/**
 * CommonMark + GFM (tables, task lists, strikethrough, autolinks).
 *
 * Subscript/Superscript are deliberately left out: they would turn `H~2~O`
 * into a subscript and surprise anyone writing plain prose.
 */
export function markdownLanguage(options: MarkdownLanguageOptions = {}): Extension {
  const { codeLanguages = languages, parserExtensions = [] } = options
  return markdown({
    codeLanguages: codeLanguages as LanguageDescription[],
    extensions: [GFM, ...parserExtensions]
  })
}
