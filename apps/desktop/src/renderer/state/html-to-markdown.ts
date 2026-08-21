import TurndownService from 'turndown'

/**
 * HTML → markdown for foreign pastes (§4.6).
 *
 * Turndown lives here rather than in `@md/core`: I2 allows `@codemirror/*` and
 * `@lezer/*` and nothing else, so core takes a converter as an option and the
 * shell supplies one.
 *
 * The output style is chosen to match what this editor writes, so a paste and
 * a hand-typed equivalent are the same bytes: ATX headings, `-` bullets,
 * fenced code, `**` for strong and `*` for emphasis.
 */
const service = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined'
})

// Turndown has no GFM rules of its own.
service.addRule('strikethrough', {
  filter: ['del', 's'],
  replacement: (content) => `~~${content}~~`
})

/**
 * Turndown's own list rule indents continuations by three spaces after the
 * bullet (`-   item`). This editor writes `- item`, and a paste should be
 * indistinguishable from typing.
 *
 * Added *before* `taskListItem` on purpose: Turndown checks rules in reverse
 * registration order, so the task rule must be registered later to win.
 */
service.addRule('listItem', {
  filter: 'li',
  replacement: (content, node, options) => {
    const text = content
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n')
      .replace(/\n/gm, '\n  ')
    const parent = node.parentNode as HTMLElement | null
    let prefix = `${options.bulletListMarker} `
    if (parent?.nodeName === 'OL') {
      const start = Number(parent.getAttribute('start') ?? 1)
      const index = [...parent.children].indexOf(node as HTMLElement)
      prefix = `${start + index}. `
    }
    return prefix + text + (node.nextSibling && !/\n$/.test(text) ? '\n' : '')
  }
})

service.addRule('taskListItem', {
  filter: (node) =>
    node.nodeName === 'LI' &&
    node.firstElementChild?.nodeName === 'INPUT' &&
    (node.firstElementChild as HTMLInputElement).type === 'checkbox',
  replacement: (content, node) => {
    const box = (node as HTMLElement).firstElementChild as HTMLInputElement
    const text = content.replace(/^\s+/, '').replace(/\n/g, '\n  ')
    return `- [${box.checked ? 'x' : ' '}] ${text}\n`
  }
})

service.addRule('table', {
  filter: 'table',
  replacement: (_content, node) => {
    const rows = [...(node as HTMLTableElement).rows]
    if (rows.length === 0) return ''
    const cells = (row: HTMLTableRowElement): string[] =>
      [...row.cells].map((cell) => (cell.textContent ?? '').trim().replace(/\|/g, '\\|'))
    const line = (values: string[]): string => `| ${values.join(' | ')} |`

    const head = cells(rows[0]!)
    const body = rows.slice(1).map((row) => line(cells(row)))
    const divider = line(head.map(() => '---'))
    return `\n\n${[line(head), divider, ...body].join('\n')}\n\n`
  }
})

// A bare <br> inside a paragraph is a hard break, not a blank line.
service.addRule('lineBreak', { filter: 'br', replacement: () => '  \n' })

export function htmlToMarkdown(html: string): string {
  return service.turndown(html).replace(/\n{3,}/g, '\n\n').trim()
}
