import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (...parts: string[]): string =>
  readFileSync(join(import.meta.dirname, '..', 'src', 'theme', ...parts), 'utf8')

const CONTRACT = read('core.css')
const THEME = read('theme.ts')
const HIGHLIGHT = read('highlight.ts')

/** §4.7's stated minimum surface. */
const REQUIRED = [
  '--md-font-body',
  '--md-font-mono',
  '--md-font-size',
  '--md-line-height',
  '--md-color-bg',
  '--md-color-text',
  '--md-color-muted',
  '--md-color-border',
  '--md-color-accent',
  '--md-color-selection',
  '--md-color-heading',
  '--md-color-code-bg',
  '--md-color-quote-border',
  '--md-h1-size',
  '--md-h2-size',
  '--md-h3-size',
  '--md-h4-size',
  '--md-h5-size',
  '--md-h6-size',
  '--md-content-width',
  '--md-content-padding'
]

describe('the theming contract (§4.7)', () => {
  it('declares every variable the contract names', () => {
    for (const name of REQUIRED) {
      expect(CONTRACT, name).toContain(`${name}:`)
    }
  })

  it('declares the defaults where an app can override them', () => {
    // On `:root`, not on the editor element: a value set directly on
    // `.cm-md-editor` would beat anything a wrapper class declared.
    expect(CONTRACT).toMatch(/^:root \{/m)
    expect(CONTRACT).not.toMatch(/^\.cm-md-editor \{/m)
  })

  it('ships a dark palette that an explicit light choice still overrides', () => {
    expect(CONTRACT).toContain("@media (prefers-color-scheme: dark)")
    expect(CONTRACT).toContain(":root:not([data-theme='light'])")
    expect(CONTRACT).toContain(":root[data-theme='dark']")
  })

  /**
   * Scrollbars are painted by the UA, not by us, and the UA reads
   * `color-scheme` to decide which way round. A palette that flips the
   * colours without flipping the scheme leaves light scrollbars on a dark
   * document — so the scheme belongs to every palette block, not just one.
   */
  it('declares a colour scheme with every palette', () => {
    const palettes = [
      /^:root \{[\s\S]*?^\}/m,
      /^@media \(prefers-color-scheme: dark\) \{[\s\S]*?^\}/m,
      /^:root\[data-theme='dark'\] \{[\s\S]*?^\}/m
    ].map((pattern) => pattern.exec(CONTRACT)?.[0])

    expect(palettes.every(Boolean), 'a palette block went missing').toBe(true)
    expect(palettes[0]).toContain('color-scheme: light;')
    expect(palettes[1]).toContain('color-scheme: dark;')
    expect(palettes[2]).toContain('color-scheme: dark;')
  })

  it('puts the scrollbar on the contract, derived so dark needs no restatement', () => {
    for (const name of [
      '--md-scrollbar-width',
      '--md-color-scrollbar-thumb',
      '--md-color-scrollbar-track'
    ]) {
      expect(CONTRACT, name).toContain(`${name}:`)
    }
    // Derived from the ink, which each palette already sets — a literal here
    // would be a fourth place the dark theme has to remember to change.
    expect(CONTRACT).toMatch(/--md-color-scrollbar-thumb:[^;]*var\(--md-color-text\)/)
  })
})

/**
 * The point of the contract is that restyling never requires a `.cm-*` rule.
 * That only holds if the theme itself paints with variables and nothing else —
 * one hard-coded hex here and some corner of the editor stops responding.
 */
describe('the CM6 theme paints only with contract variables', () => {
  const literal = /:\s*(#[0-9a-fA-F]{3,8}|rgba?\(|oklch\(|hsla?\()/g

  it('has no hard-coded colour in theme.ts', () => {
    expect(THEME.match(literal) ?? []).toEqual([])
  })

  /**
   * Structural values — a 1px border, a 4px radius — stay literal on purpose.
   * They are layout, not palette, and §4.7 does not put them in the contract.
   * What must be variable is everything a reader sees as *typography*.
   */
  it('takes every font and text size from the contract', () => {
    const typographic = THEME.match(/(?:fontFamily|fontSize|lineHeight):\s*'[^']+'/g) ?? []
    expect(typographic.length).toBeGreaterThan(4)
    for (const value of typographic) {
      expect(value, value).toContain('var(--md-')
    }
    // A literal `400` is "not bold", a structural reset. The weight headings
    // are actually drawn at has to come from the contract.
    expect(THEME).toContain('var(--md-heading-weight)')
  })

  it('paints the editor scrollbar from the contract too', () => {
    // The scroller restates the inherited properties so an editor themed on a
    // wrapper resolves its scrollbar against that wrapper, not against :root.
    const block = /'\.cm-scroller': \{([\s\S]*?)\},/.exec(THEME)?.[1]
    expect(block, 'no .cm-scroller block found').toBeDefined()
    expect(block).toContain('var(--md-scrollbar-width)')
    expect(block).toContain('var(--md-color-scrollbar-thumb)')
    expect(block).toContain('var(--md-color-scrollbar-track)')
  })

  it('takes every highlight colour from a variable', () => {
    const colours = HIGHLIGHT.match(/color:\s*'[^']+'/g) ?? []
    expect(colours.length).toBeGreaterThan(4)
    for (const colour of colours) {
      // Either a --md-hl-* token with a fallback, or a contract colour.
      expect(colour, colour).toMatch(/var\(--md-(?:hl-[a-z-]+,|color-)/)
    }
  })
})
