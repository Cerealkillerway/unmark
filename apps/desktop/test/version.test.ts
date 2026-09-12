import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The version beside the wordmark.
 *
 * `version-updater` owns the number in `package.json`, so the only way the
 * title bar can be wrong is if something else states it independently. These
 * check that nothing does.
 */

const root = join(import.meta.dirname, '..')
const read = (...parts: string[]): string => readFileSync(join(root, ...parts), 'utf8')

const PACKAGE = JSON.parse(read('package.json')) as { version: string }
const CONFIG = read('electron.vite.config.ts')
const TITLE_BAR = read('src', 'renderer', 'components', 'TitleBar.tsx')

describe('the version in the title bar', () => {
  it('is substituted from package.json at build time', () => {
    expect(CONFIG).toContain('__APP_VERSION__')
    // Read from the file version-updater maintains, not restated here.
    expect(CONFIG).toMatch(/readFileSync\(\s*resolve\(root, 'package\.json'\)/)
  })

  it('is rendered from the constant rather than written out', () => {
    expect(TITLE_BAR).toContain('__APP_VERSION__')
    // The drift this guards against: someone typing the number into the JSX,
    // where the next release would leave it stale and nothing would fail.
    const literal = new RegExp(`['"\`>]\\s*v?${PACKAGE.version.replace(/\./g, '\\.')}`)
    expect(TITLE_BAR).not.toMatch(literal)
  })

  it('has a version worth showing', () => {
    expect(PACKAGE.version).toMatch(/^\d+\.\d+\.\d+/)
  })
})
