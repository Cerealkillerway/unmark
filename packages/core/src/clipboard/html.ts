import { parser as baseParser, GFM } from '@lezer/markdown'
import type { SyntaxNode } from '@lezer/common'

/**
 * Markdown → HTML for the clipboard (§4.6).
 *
 * Parsed with the same Lezer grammar the editor uses, so what gets copied
 * agrees with what is rendered. Nested code languages are deliberately not
 * configured here: a fence's content goes into `<pre><code>` verbatim and
 * there is nothing to gain from parsing it twice.
 *
 * Nothing outside `@lezer/*` is used, which is what keeps this inside I2.
 */

const parser = baseParser.configure(GFM)

const escapeText = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeAttr = (text: string): string => escapeText(text).replace(/"/g, '&quot;')

/** Syntax nodes that carry no content: `**`, `#`, `>`, `- `, `[ ]`. */
const isMark = (name: string): boolean => name.endsWith('Mark') || name === 'TaskMarker'

function childrenOf(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = []
  for (let child = node.firstChild; child; child = child.nextSibling) out.push(child)
  return out
}

interface Context {
  readonly text: string
  /** Render a ListItem's single paragraph without a `<p>`, as HTML does for tight lists. */
  readonly tight?: boolean
}

/**
 * Children are rendered in place; the text *between* them is emitted raw.
 * Skipping a child skips its text too, which is how markers disappear.
 */
function inner(node: SyntaxNode, ctx: Context, skip: (child: SyntaxNode) => boolean): string {
  let out = ''
  let pos = node.from
  for (const child of childrenOf(node)) {
    if (child.from > pos) out += escapeText(ctx.text.slice(pos, child.from))
    if (skip(child)) {
      pos = Math.max(pos, child.to)
      // A marker that opens a line takes the space after it with it, the same
      // way the editor's decorations do — otherwise every continuation line of
      // a blockquote arrives indented by one.
      if (child.from === 0 || ctx.text[child.from - 1] === '\n') {
        while (pos < node.to && (ctx.text[pos] === ' ' || ctx.text[pos] === '\t')) pos++
      }
      continue
    }
    out += render(child, ctx)
    pos = Math.max(pos, child.to)
  }
  if (pos < node.to) out += escapeText(ctx.text.slice(pos, node.to))
  return out
}

const content = (node: SyntaxNode, ctx: Context): string => inner(node, ctx, (c) => isMark(c.name))

/**
 * A block container's children are rendered without the text between them —
 * that text is only the newlines and indentation holding the block structure
 * together, and emitting it puts stray whitespace inside `<ul>` and
 * `<blockquote>`.
 */
function blockChildren(node: SyntaxNode, ctx: Context): string {
  let out = ''
  for (const child of childrenOf(node)) {
    if (!isMark(child.name)) out += render(child, ctx)
  }
  return out
}

/** The `[label]` half of a link or image: everything that is not syntax. */
const linkLabel = (node: SyntaxNode, ctx: Context): string =>
  inner(node, ctx, (c) => isMark(c.name) || c.name === 'URL' || c.name === 'LinkTitle')

function urlOf(node: SyntaxNode, ctx: Context): string | null {
  for (const child of childrenOf(node)) {
    if (child.name === 'URL') return ctx.text.slice(child.from, child.to)
  }
  return null
}

function fencedCode(node: SyntaxNode, ctx: Context): string {
  let language = ''
  let from = node.from
  let to = node.to
  for (const child of childrenOf(node)) {
    if (child.name === 'CodeInfo') language = ctx.text.slice(child.from, child.to).trim()
    if (child.name === 'CodeMark') {
      if (child.from === node.from) from = child.to
      if (child.to === node.to) to = child.from
    }
    if (child.name === 'CodeInfo') from = child.to
  }
  const code = ctx.text.slice(from, to).replace(/^\n/, '').replace(/\n[ \t]*$/, '')
  const attr = language ? ` class="language-${escapeAttr(language.split(/\s+/)[0] ?? '')}"` : ''
  return `<pre><code${attr}>${escapeText(code)}</code></pre>`
}

function table(node: SyntaxNode, ctx: Context): string {
  let head = ''
  const rows: string[] = []
  for (const child of childrenOf(node)) {
    if (child.name === 'TableDelimiter') continue
    const cells = childrenOf(child)
      .filter((cell) => cell.name === 'TableCell')
      .map((cell) => content(cell, ctx).trim())
    if (cells.length === 0) continue
    if (child.name === 'TableHeader') {
      head = `<thead><tr>${cells.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead>`
    } else {
      rows.push(`<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    }
  }
  return `<table>${head}${rows.length ? `<tbody>${rows.join('')}</tbody>` : ''}</table>`
}

function listItem(node: SyntaxNode, ctx: Context): string {
  const task = childrenOf(node).find((child) => child.name === 'Task')
  if (task) {
    const marker = childrenOf(task).find((child) => child.name === 'TaskMarker')
    const checked = marker && /[xX]/.test(ctx.text.slice(marker.from, marker.to))
    // A Task holds inline text directly, so its gaps *are* the content.
    const body = content(task, { ...ctx, tight: true }).trim()
    return `<li><input type="checkbox" disabled${checked ? ' checked' : ''}> ${body}</li>`
  }
  return `<li>${blockChildren(node, { ...ctx, tight: true }).trim()}</li>`
}

function render(node: SyntaxNode, ctx: Context): string {
  const name = node.name

  const heading = /^(?:ATX|Setext)Heading([1-6])$/.exec(name)
  if (heading) return `<h${heading[1]}>${content(node, ctx).trim()}</h${heading[1]}>`

  switch (name) {
    case 'Document':
      return blockChildren(node, ctx)
    case 'Paragraph':
      return ctx.tight ? content(node, ctx) : `<p>${content(node, ctx)}</p>`
    case 'Blockquote':
      return `<blockquote>${blockChildren(node, { ...ctx, tight: false })}</blockquote>`
    case 'BulletList':
      return `<ul>${blockChildren(node, ctx)}</ul>`
    case 'OrderedList':
      return `<ol>${blockChildren(node, ctx)}</ol>`
    case 'ListItem':
      return listItem(node, ctx)
    case 'HorizontalRule':
      return '<hr>'
    case 'FencedCode':
      return fencedCode(node, ctx)
    case 'CodeBlock':
      return `<pre><code>${escapeText(
        ctx.text
          .slice(node.from, node.to)
          .split('\n')
          .map((line) => line.replace(/^ {1,4}/, ''))
          .join('\n')
      )}</code></pre>`
    case 'Table':
      return table(node, ctx)
    case 'StrongEmphasis':
      return `<strong>${content(node, ctx)}</strong>`
    case 'Emphasis':
      return `<em>${content(node, ctx)}</em>`
    case 'Strikethrough':
      return `<del>${content(node, ctx)}</del>`
    case 'InlineCode':
      return `<code>${content(node, ctx)}</code>`
    case 'Link': {
      const url = urlOf(node, ctx)
      const label = linkLabel(node, ctx)
      return url ? `<a href="${escapeAttr(url)}">${label}</a>` : label
    }
    case 'Image': {
      const url = urlOf(node, ctx)
      const alt = linkLabel(node, ctx)
      return url ? `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}">` : alt
    }
    case 'Autolink':
    case 'URL': {
      const href = name === 'URL' ? ctx.text.slice(node.from, node.to) : (urlOf(node, ctx) ?? '')
      return `<a href="${escapeAttr(href)}">${escapeText(href)}</a>`
    }
    case 'HardBreak':
      return '<br>'
    case 'Escape':
      return escapeText(ctx.text.slice(node.from + 1, node.to))
    case 'Entity':
    case 'HTMLTag':
    case 'HTMLBlock':
    case 'CommentBlock':
      // Raw HTML in markdown means the author wants that HTML.
      return ctx.text.slice(node.from, node.to)
    default:
      return content(node, ctx)
  }
}

/** Whether the fragment is block-level, which decides the sentinel wrapper's tag. */
function isBlock(html: string): boolean {
  return /^<(?:p|h[1-6]|ul|ol|li|blockquote|pre|hr|table|div)\b/i.test(html.trim())
}

export interface MarkdownHtmlResult {
  readonly html: string
  readonly block: boolean
}

export function markdownToHtml(markdown: string): MarkdownHtmlResult {
  const tree = parser.parse(markdown)
  const top = tree.topNode

  // A selection that is just prose — a phrase pulled out of a sentence — is
  // pasted inline. Wrapping it in `<p>` would insert a paragraph break in the
  // target document, which is not what "copy these three words" means.
  const only = childrenOf(top)
  if (only.length === 1 && only[0]!.name === 'Paragraph') {
    return { html: content(only[0]!, { text: markdown, tight: true }), block: false }
  }

  const html = render(top, { text: markdown })
  return { html, block: isBlock(html) }
}
