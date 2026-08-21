import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { filesFromArgv } from '../src/main/files.js'

const dir = mkdtempSync(join(tmpdir(), 'unmark-argv-'))
const note = join(dir, 'notes.md')
writeFileSync(note, '# hi\n')

/**
 * `unmark notes.md` and a double-clicked `.md` both arrive here. Without this
 * the file associations configured in electron-builder are decorative.
 */
describe('filesFromArgv', () => {
  it('picks up a file named on a packaged command line', () => {
    expect(filesFromArgv(['/opt/unmark/unmark', note], 1)).toEqual([note])
  })

  it('skips the project path in development, where argv is `electron . file`', () => {
    expect(filesFromArgv(['/path/to/electron', '.', note], 2)).toEqual([note])
  })

  it('resolves a relative path against the working directory', () => {
    const relative = filesFromArgv(['x', 'package.json'], 1)
    expect(relative).toEqual([resolve('package.json')])
  })

  it('drops switches — a relaunch can carry flags we know nothing about', () => {
    expect(filesFromArgv(['x', '--no-sandbox', '--inspect=9229', note], 1)).toEqual([note])
  })

  it('drops paths that are not readable files', () => {
    expect(filesFromArgv(['x', join(dir, 'missing.md'), dir, note], 1)).toEqual([note])
  })

  it('is empty for a bare launch', () => {
    expect(filesFromArgv(['/opt/unmark/unmark'], 1)).toEqual([])
  })
})
