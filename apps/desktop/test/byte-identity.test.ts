import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listFolder, readDocument, writeDocument } from '../src/main/files.js'

const FIXTURES: [string, string][] = [
  ['lf.md', '# Title\n\nA **bold** word.\n'],
  ['crlf.md', '# Title\r\n\r\nA **bold** word.\r\n'],
  ['no-trailing-newline.md', '**test**'],
  ['tabs-and-unicode.md', '\t- café — naïve — 日本語 — 👋🏽  \nline with trailing spaces   \n'],
  ['bom.md', '﻿# With a byte order mark\n'],
  ['mixed.md', 'one\r\ntwo\nthree\r\n']
]

/**
 * I1's outermost guarantee, at the layer that actually touches the disk: open
 * a file, write it back untouched, and the bytes must be identical. No line
 * ending normalization, no BOM handling, no trailing newline fixups.
 */
describe('open → save with no edit', () => {
  it('is byte-identical for every fixture', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'unmark-'))
    for (const [name, text] of FIXTURES) {
      const path = join(dir, name)
      await writeFile(path, text, 'utf8')
      const before = await readFile(path)

      const content = await readDocument(path)
      await writeDocument({ path, content })

      const after = await readFile(path)
      expect(after.equals(before), name).toBe(true)
    }
  })
})

describe('listFolder', () => {
  it('lists markdown and directories only, directories first', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'unmark-'))
    await writeFile(join(dir, 'b.md'), '')
    await writeFile(join(dir, 'a.md'), '')
    await writeFile(join(dir, 'image.png'), '')
    await writeFile(join(dir, '.hidden.md'), '')

    const listing = await listFolder(dir)
    expect(listing.entries.map((entry) => entry.name)).toEqual(['a.md', 'b.md'])
  })
})
