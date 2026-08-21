import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(
  join(import.meta.dirname, '..', 'src', 'renderer', 'styles', 'app.css'),
  'utf8'
)

/** Comments talk about `.cm-*`; only the rules matter here. */
const RULES = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * §4.7's acceptance criterion, as a test: the whole editor restyles from a
 * single block of custom properties, and the app never writes a `.cm-*` rule.
 * If this ever fails, the contract has a hole and a third-party consumer would
 * hit it too.
 */
describe('the app themes the editor through variables alone', () => {
  it('contains no .cm-* selector', () => {
    expect(RULES).not.toMatch(/\.cm-/)
  })

  it('maps the whole contract in one block on .app', () => {
    const block = /\.app \{\s*(--md-[\s\S]*?)\}/.exec(RULES)?.[1]
    expect(block, 'no --md-* block found on .app').toBeDefined()
    for (const name of [
      '--md-color-bg',
      '--md-color-text',
      '--md-color-heading',
      '--md-color-marker',
      '--md-color-accent',
      '--md-color-selection',
      '--md-color-code-bg',
      '--md-color-quote-border',
      '--md-font-body',
      '--md-font-mono'
    ]) {
      expect(block, name).toContain(`${name}:`)
    }
  })

  it('drives light and dark from the same variables with different values', () => {
    expect(RULES).toMatch(/:root\[data-theme='light'\]/)
    expect(RULES).toMatch(/:root\[data-theme='dark'\]/)
    // Every editor variable resolves through an app token, so flipping the
    // theme block flips the editor with it.
    const block = /\.app \{\s*(--md-[\s\S]*?)\}/.exec(RULES)?.[1] ?? ''
    const values = block.match(/--md-[a-z0-9-]+:\s*([^;]+);/g) ?? []
    expect(values.length).toBeGreaterThan(15)
    for (const value of values) {
      expect(value, value).toMatch(/var\(--|color-mix\(/)
    }
  })
})
