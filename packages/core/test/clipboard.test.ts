import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CLIPBOARD_SENTINEL,
  isOwnHtml,
  markdownToHtml,
  wrapWithSentinel
} from '../src/clipboard/index.js'

const html = (markdown: string): string => markdownToHtml(markdown).html

/** A lone paragraph is emitted inline; these cases want the block form. */
const block = (markdown: string): string => markdownToHtml(`${markdown}\n\ntail`).html.replace(/<p>tail<\/p>$/, '')

describe('markdownToHtml — inline', () => {
  it('renders the marks the editor hides', () => {
    expect(html('**bold**')).toBe('<strong>bold</strong>')
    expect(html('*em*')).toBe('<em>em</em>')
    expect(html('~~gone~~')).toBe('<del>gone</del>')
    expect(html('`code`')).toBe('<code>code</code>')
  })

  it('nests', () => {
    expect(html('**bold with `code` in it**')).toBe(
      '<strong>bold with <code>code</code> in it</strong>'
    )
  })

  it('escapes text that would otherwise be markup', () => {
    expect(html('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d')
    expect(html('5 > 4 && 3 < 4')).toBe('5 &gt; 4 &amp;&amp; 3 &lt; 4')
  })

  it('passes an inline HTML tag through — markdown says that is deliberate', () => {
    expect(html('**<b>x</b>**')).toBe('<strong><b>x</b></strong>')
  })

  it('renders links, images and autolinks', () => {
    expect(html('[label](https://example.com)')).toBe('<a href="https://example.com">label</a>')
    expect(html('![alt](/pic.png)')).toBe('<img src="/pic.png" alt="alt">')
    expect(html('<https://example.com>')).toBe(
      '<a href="https://example.com">https://example.com</a>'
    )
  })

  it('quotes an attribute that contains a quote', () => {
    expect(html('[x](https://e.com/"a")')).toContain('&quot;')
  })

  it('unescapes a backslash escape', () => {
    expect(html('\\*not em\\*')).toBe('*not em*')
  })
})

describe('markdownToHtml — blocks', () => {
  it('renders headings at their level', () => {
    expect(html('# One')).toBe('<h1>One</h1>')
    expect(html('### Three ###')).toBe('<h3>Three</h3>')
    expect(html('Title\n=====')).toBe('<h1>Title</h1>')
  })

  it('renders lists, tight, without stray paragraphs', () => {
    expect(html('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(html('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>')
    expect(html('- one\n  - nested')).toBe('<ul><li>one<ul><li>nested</li></ul></li></ul>')
  })

  it('renders task items as checkboxes', () => {
    expect(html('- [ ] todo\n- [x] done')).toBe(
      '<ul><li><input type="checkbox" disabled> todo</li>' +
        '<li><input type="checkbox" disabled checked> done</li></ul>'
    )
  })

  it('renders blockquotes without their markers', () => {
    expect(html('> quoted')).toBe('<blockquote><p>quoted</p></blockquote>')
    expect(html('> one\n> two')).toBe('<blockquote><p>one\ntwo</p></blockquote>')
  })

  it('keeps a lone paragraph inline but a real block as a block', () => {
    expect(markdownToHtml('just words').block).toBe(false)
    expect(markdownToHtml('# Heading').block).toBe(true)
    expect(markdownToHtml('one\n\ntwo').block).toBe(true)
  })

  it('renders a block that follows prose', () => {
    expect(block('# One')).toBe('<h1>One</h1>')
  })

  it('renders a fence with its language and without its markers', () => {
    expect(html('```js\nconst a = 1\n```')).toBe(
      '<pre><code class="language-js">const a = 1</code></pre>'
    )
  })

  it('renders a thematic break', () => {
    expect(html('---')).toBe('<hr>')
  })

  it('renders a GFM table', () => {
    expect(html('| a | b |\n| - | - |\n| 1 | 2 |')).toBe(
      '<table><thead><tr><th>a</th><th>b</th></tr></thead>' +
        '<tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
    )
  })

  it('passes raw HTML through, because the author asked for it', () => {
    expect(html('<div class="x">hi</div>')).toBe('<div class="x">hi</div>')
  })
})

describe('the whole kitchen sink', () => {
  const text = readFileSync(join(import.meta.dirname, 'fixtures', 'kitchen-sink.md'), 'utf8')

  it('renders without throwing and leaves no markdown syntax behind', () => {
    const out = html(text)
    expect(out).toContain('<h1>')
    expect(out).toContain('<strong>')
    expect(out).toContain('<pre><code')
    expect(out).toContain('<blockquote>')
    // The syntax the editor hides must not survive into the HTML. Literal
    // `**` from the fixture's deliberately unclosed pair does, correctly, and
    // is not what this is checking.
    expect(out).not.toContain('**strong**')
    expect(out).not.toContain('# Kitchen sink')
    expect(out).not.toContain('> A blockquote')
    expect(out).not.toContain('[ ] unchecked')
  })
})

describe('the self-paste sentinel', () => {
  it('marks our own copies', () => {
    const { html: body, block: isBlockLevel } = markdownToHtml('**bold**')
    const wrapped = wrapWithSentinel(body, isBlockLevel)
    expect(wrapped).toBe(`<span ${CLIPBOARD_SENTINEL}="1"><strong>bold</strong></span>`)
    expect(isOwnHtml(wrapped)).toBe(true)
  })

  it('wraps block content in a div and inline content in a span', () => {
    expect(markdownToHtml('# Heading').block).toBe(true)
    expect(wrapWithSentinel('<h1>x</h1>', true)).toMatch(/^<div /)
    expect(wrapWithSentinel('plain', false)).toMatch(/^<span /)
  })

  it('does not see foreign HTML as its own', () => {
    expect(isOwnHtml('<p>from a browser</p>')).toBe(false)
    expect(isOwnHtml('<meta charset="utf-8"><b>word</b>')).toBe(false)
  })
})
