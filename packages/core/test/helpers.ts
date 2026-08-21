import { EditorSelection, EditorState, type Extension } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { buildDecorationRanges } from '../src/decorations/builder.js'
import { defaultRules } from '../src/editor.js'
import { markdownSetup } from '../src/editor.js'
import type { DecoRange, RuleTable } from '../src/decorations/types.js'

export const baseExtensions = (extra: Extension[] = []): Extension[] => [
  ...markdownSetup({ codeLanguages: [], theme: false }),
  ...extra
]

/**
 * `|` marks a caret; `[` and `]` mark a selection. Everything else is document
 * text. Returns a fully-parsed state so the tree is never partial.
 */
export function stateFrom(marked: string, rules?: RuleTable): EditorState {
  let doc = ''
  let anchor = -1
  let head = -1
  for (const ch of marked) {
    if (ch === '|') {
      anchor = head = doc.length
    } else if (ch === '[') {
      anchor = doc.length
    } else if (ch === ']') {
      head = doc.length
    } else {
      doc += ch
    }
  }
  const selection =
    anchor >= 0 && head >= 0
      ? EditorSelection.single(anchor, head)
      : EditorSelection.single(0)

  const state = EditorState.create({ doc, selection, extensions: baseExtensions() })
  // Force a complete parse: visible-range walking in the plugin relies on the
  // viewport being parsed, and there is no viewport in a headless test.
  ensureSyntaxTree(state, state.doc.length, 10_000)
  void rules
  return state
}

export function decorate(marked: string, rules: RuleTable = defaultRules()): DecoRange[] {
  const state = stateFrom(marked)
  return buildDecorationRanges(state, [{ from: 0, to: state.doc.length }], rules)
}

/** The text a reader actually sees: the document minus every `replace` range. */
export function rendered(marked: string, rules: RuleTable = defaultRules()): string {
  const state = stateFrom(marked)
  const ranges = buildDecorationRanges(state, [{ from: 0, to: state.doc.length }], rules)
  const doc = state.doc.toString()
  let out = ''
  let pos = 0
  for (const r of ranges) {
    if (r.kind !== 'replace') continue
    if (r.from > pos) out += doc.slice(pos, r.from)
    pos = Math.max(pos, r.to)
  }
  return out + doc.slice(pos)
}

/** Classes applied over a given document offset. */
export function classesAt(marked: string, offset: number, rules: RuleTable = defaultRules()): string[] {
  return decorate(marked, rules)
    .filter((r) => r.kind === 'mark' && r.from <= offset && r.to > offset)
    .map((r) => r.class!)
    .sort()
}

export function hidden(marked: string, rules: RuleTable = defaultRules()): string[] {
  const state = stateFrom(marked)
  const doc = state.doc.toString()
  return buildDecorationRanges(state, [{ from: 0, to: state.doc.length }], rules)
    .filter((r) => r.kind === 'replace')
    .map((r) => doc.slice(r.from, r.to))
}
