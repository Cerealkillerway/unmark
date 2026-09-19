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

  it('maps the scrollbar through the contract as well', () => {
    const block = /\.app \{\s*(--md-[\s\S]*?)\}/.exec(RULES)?.[1] ?? ''
    expect(block).toContain('--md-color-scrollbar-thumb:')
    expect(block).toContain('--md-color-scrollbar-track:')
    expect(block).toContain('--md-scrollbar-width:')
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

/**
 * The chrome scrolls in five places — sidebar, outline, palette list, editor
 * slot, the caret readout — and none of them was styling its scrollbar, so the
 * UA drew its light one straight through the dark theme. Both properties
 * inherit, which is what makes one declaration on the root the whole fix.
 */
describe('the shell themes its own scrollbars', () => {
  it('declares a colour scheme with each palette', () => {
    const dark = /^:root,\n:root\[data-theme='dark'\] \{[\s\S]*?^\}/m.exec(RULES)?.[0]
    const light = /^:root\[data-theme='light'\] \{[\s\S]*?^\}/m.exec(RULES)?.[0]
    expect(dark, 'no dark palette block found').toBeDefined()
    expect(light, 'no light palette block found').toBeDefined()
    expect(dark).toContain('color-scheme: dark;')
    expect(light).toContain('color-scheme: light;')
  })

  it('sets the scrollbar once on the root, where it inherits from', () => {
    const root = /^:root \{[\s\S]*?^\}/m.exec(RULES)?.[0] ?? ''
    expect(root).toContain(
      'scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);'
    )
    expect(root).toContain('scrollbar-width: var(--scrollbar-width);')
    // Derived from the ink each palette already sets, not restated per theme.
    expect(root).toMatch(/--scrollbar-thumb:[^;]*var\(--text\)/)
  })

  it('leaves the tab strip opt-out intact', () => {
    expect(RULES).toMatch(/\.tabs \{[\s\S]*?scrollbar-width: none;/)
  })
})
