import { EditorState, type Extension } from '@codemirror/state'

export type LineSeparator = '\n' | '\r\n'

const CRLF = /\r\n/g
const ANY_EOL = /\r\n|\n|\r/g

function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0
  let n = 0
  while (re.exec(text) !== null) n++
  return n
}

/**
 * I1 guard for line endings.
 *
 * CodeMirror splits an incoming document on /\r\n?|\n/ and joins it back with
 * `\n`, so a CRLF file loaded with the defaults silently comes back as LF —
 * byte drift across the whole file on the first save. Setting
 * `EditorState.lineSeparator` makes the split and the join symmetrical.
 *
 * Returns the dominant separator, or `undefined` for a document with no line
 * breaks (where the default is already correct).
 */
export function detectLineSeparator(text: string): LineSeparator | undefined {
  const total = countMatches(text, ANY_EOL)
  if (total === 0) return undefined
  return countMatches(text, CRLF) * 2 > total ? '\r\n' : '\n'
}

/**
 * True when a document mixes CRLF and LF. Such a file cannot survive a
 * round-trip through CodeMirror unchanged whatever separator is chosen; the
 * shell should warn rather than silently rewrite it.
 */
export function hasMixedLineEndings(text: string): boolean {
  const total = countMatches(text, ANY_EOL)
  if (total === 0) return false
  const crlf = countMatches(text, CRLF)
  return crlf !== 0 && crlf !== total
}

/** The `EditorState.lineSeparator` extension for a document, if one is needed. */
export function lineSeparatorFor(text: string): Extension[] {
  const sep = detectLineSeparator(text)
  return sep ? [EditorState.lineSeparator.of(sep)] : []
}

/**
 * Serialize a state back to the exact text that should be written to disk.
 *
 * `doc.toString()` is NOT that string: Text always joins its lines with `\n`
 * regardless of how the document was split. `state.lineBreak` reflects the
 * configured separator, so this is the only I1-safe way to save.
 */
export function serializeDocument(state: EditorState): string {
  return state.doc.sliceString(0, state.doc.length, state.lineBreak)
}
