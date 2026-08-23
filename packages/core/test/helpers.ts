import { EditorSelection, EditorState, type Extension } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { buildDecorationRanges } from '../src/decorations/builder.js'
import { collapsedLineRanges } from '../src/decorations/lines.js'
import { defaultRules, markdownSetup } from '../src/editor.js'
import type { DecoRange, RuleTable } from '../src/decorations/types.js'

/**
 * Caret and selection markers. Deliberately characters that never occur in
 * markdown — `|`, `[` and `]` are all real syntax (tables, links, tasks).
 */
export const CARET = '‸'
export const SEL_START = '«'
export const SEL_END = '»'

export const baseExtensions = (extra: Extension[] = []): Extension[] => [
  ...markdownSetup({ codeLanguages: [], theme: false }),
  ...extra
]

export interface Marked {
  doc: string
  selection: EditorSelection
}

/** Strip the markers out of a marked-up string. */
export function parseMarked(marked: string): Marked {
  let doc = ''
  let anchor = -1
  let head = -1
  for (const ch of marked) {
    if (ch === CARET) anchor = head = doc.length
    else if (ch === SEL_START) anchor = doc.length
    else if (ch === SEL_END) head = doc.length
    else doc += ch
  }
  return {
    doc,
    // No marker means "the caret is nowhere near this", which is the end of
    // the document rather than the start of it: offset 0 is the first position
    // of whatever node begins the document, and the reveal rule counts that as
    // being on the node.
    selection:
      anchor >= 0 && head >= 0
        ? EditorSelection.single(anchor, head)
        : EditorSelection.single(doc.length)
  }
}

export function stateFrom(marked: string, extra: Extension[] = []): EditorState {
  const { doc, selection } = parseMarked(marked)
  const state = EditorState.create({ doc, selection, extensions: baseExtensions(extra) })
  // Force a complete parse: the plugin normally relies on CodeMirror having
  // parsed the viewport, and there is no viewport in a headless test.
  ensureSyntaxTree(state, state.doc.length, 20_000)
  return state
}

export function decorateState(state: EditorState, rules: RuleTable = defaultRules()): DecoRange[] {
  return buildDecorationRanges(state, [{ from: 0, to: state.doc.length }], rules)
}

export function decorate(marked: string, rules: RuleTable = defaultRules()): DecoRange[] {
  return decorateState(stateFrom(marked), rules)
}

/** The text a reader actually sees: the document minus every `replace` range. */
export function renderState(state: EditorState, rules: RuleTable = defaultRules()): string {
  const doc = state.doc.toString()
  let out = ''
  let pos = 0
  for (const r of decorateState(state, rules)) {
    if (r.kind !== 'replace') continue
    if (r.from > pos) out += doc.slice(pos, r.from)
    pos = Math.max(pos, r.to)
  }
  return out + doc.slice(pos)
}

export function rendered(marked: string, rules: RuleTable = defaultRules()): string {
  return renderState(stateFrom(marked), rules)
}

/** Classes applied over a given document offset. */
export function classesAt(
  marked: string,
  offset: number,
  rules: RuleTable = defaultRules()
): string[] {
  return decorate(marked, rules)
    .filter((r) => r.kind === 'mark' && r.from <= offset && r.to > offset)
    .map((r) => r.class!)
    .sort()
}

export function hidden(marked: string, rules: RuleTable = defaultRules()): string[] {
  const state = stateFrom(marked)
  const doc = state.doc.toString()
  return decorateState(state, rules)
    .filter((r) => r.kind === 'replace')
    .map((r) => doc.slice(r.from, r.to))
}

/**
 * The whole lines the block-level source takes away, as text.
 *
 * `rendered` only ever shows the builder's work; a collapsed line is gone
 * from the page but still in the document, so it needs its own view.
 */
export function collapsed(marked: string, rules: RuleTable = defaultRules()): string[] {
  const state = stateFrom(marked)
  return collapsedLineRanges(state, rules).map((line) =>
    state.doc.sliceString(line.from, line.to)
  )
}

/** Line-decoration classes on a 1-based line number. */
export function lineClasses(
  marked: string,
  lineNumber: number,
  rules: RuleTable = defaultRules()
): string[] {
  const state = stateFrom(marked)
  const line = state.doc.line(lineNumber)
  return decorateState(state, rules)
    .filter((r) => r.kind === 'line' && r.from === line.from)
    .map((r) => r.class!)
    .sort()
}
