import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { yamlFrontmatter } from '@codemirror/lang-yaml'
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
  /**
   * Parse a `---` delimited YAML block at the top of the document as front
   * matter rather than as a thematic break followed by a setext heading.
   * On by default.
   */
  frontMatter?: boolean
}

/**
 * CommonMark + GFM (tables, task lists, strikethrough, autolinks), optionally
 * wrapped so the document is `Frontmatter? Body`.
 *
 * Subscript/Superscript are deliberately left out: they would turn `H~2~O`
 * into a subscript and surprise anyone writing plain prose.
 */
export function markdownLanguage(options: MarkdownLanguageOptions = {}): Extension {
  const { codeLanguages = languages, parserExtensions = [], frontMatter = true } = options

  const md = markdown({
    codeLanguages: codeLanguages as LanguageDescription[],
    extensions: [GFM, ...parserExtensions]
  })

  // The outer parser is `Document = Frontmatter? Body`, with Body handed back
  // to the markdown parser via parseMixed and the YAML block parsed by the
  // YAML parser — so front matter gets real highlighting, not a misparse into
  // HorizontalRule + SetextHeading2.
  return frontMatter ? yamlFrontmatter({ content: md }) : md
}
