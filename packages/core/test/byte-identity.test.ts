import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import {
  detectLineSeparator,
  hasMixedLineEndings,
  lineSeparatorFor,
  serializeDocument
} from '../src/document.js'
import { markdownSetup } from '../src/editor.js'

const FIXTURES = join(import.meta.dirname, 'fixtures')
const files = readdirSync(FIXTURES).filter((f) => f.endsWith('.md'))

/**
 * The guard on invariant I1. Loading a file into an EditorState and reading
 * the document back out must reproduce the file byte for byte — no
 * normalisation, no trailing-newline fixups, no line-ending rewrites.
 *
 * This test runs in every phase. If it fails, something has started treating
 * the document as a model instead of as text.
 */
describe('I1 — the document is the markdown string', () => {
  it('has fixtures to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`round-trips ${file} byte for byte`, () => {
      const original = readFileSync(join(FIXTURES, file))
      const text = original.toString('utf8')

      const state = EditorState.create({
        doc: text,
        extensions: [...lineSeparatorFor(text), ...markdownSetup({ codeLanguages: [] })]
      })

      const roundTripped = Buffer.from(serializeDocument(state), 'utf8')
      expect(roundTripped.equals(original)).toBe(true)
      expect(roundTripped.length).toBe(original.length)
    })
  }

  it('survives an edit-and-undo cycle', () => {
    const text = readFileSync(join(FIXTURES, 'kitchen-sink.md'), 'utf8')
    const state = EditorState.create({
      doc: text,
      extensions: [...lineSeparatorFor(text), ...markdownSetup({ codeLanguages: [] })]
    })
    const edited = state.update({ changes: { from: 0, insert: 'x' } }).state
    const reverted = edited.update({ changes: { from: 0, to: 1, insert: '' } }).state
    expect(serializeDocument(reverted)).toBe(text)
  })
})

describe('line separator detection', () => {
  it('detects LF, CRLF, and the absence of line breaks', () => {
    expect(detectLineSeparator('a\nb')).toBe('\n')
    expect(detectLineSeparator('a\r\nb')).toBe('\r\n')
    expect(detectLineSeparator('no breaks')).toBeUndefined()
    expect(detectLineSeparator('')).toBeUndefined()
  })

  it('picks the dominant separator in a mixed document', () => {
    expect(detectLineSeparator('a\r\nb\r\nc\nd')).toBe('\r\n')
    expect(detectLineSeparator('a\nb\nc\r\nd')).toBe('\n')
  })

  it('flags mixed line endings, which cannot round-trip', () => {
    expect(hasMixedLineEndings('a\r\nb\nc')).toBe(true)
    expect(hasMixedLineEndings('a\r\nb\r\n')).toBe(false)
    expect(hasMixedLineEndings('a\nb\n')).toBe(false)
    expect(hasMixedLineEndings('single line')).toBe(false)
  })

  it('would lose CRLF without the separator extension', () => {
    const text = 'a\r\nb\r\n'
    const naive = EditorState.create({ doc: text })
    expect(naive.doc.toString()).not.toBe(text)

    const correct = EditorState.create({ doc: text, extensions: lineSeparatorFor(text) })
    expect(serializeDocument(correct)).toBe(text)
    // …and doc.toString() still would, which is exactly the trap.
    expect(correct.doc.toString()).not.toBe(text)
  })
})
