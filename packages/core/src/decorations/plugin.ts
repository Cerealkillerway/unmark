import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, type Extension } from '@codemirror/state'
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from '@codemirror/view'
import { buildDecorationRanges } from './builder.js'
import { collapsedLines } from './lines.js'
import type { DecoRange, RuleTable } from './types.js'

const REPLACE = Decoration.replace({})
const markCache = new Map<string, Decoration>()
const lineCache = new Map<string, Decoration>()

function markFor(cls: string): Decoration {
  let deco = markCache.get(cls)
  if (!deco) {
    deco = Decoration.mark({ class: cls })
    markCache.set(cls, deco)
  }
  return deco
}

function lineFor(cls: string): Decoration {
  let deco = lineCache.get(cls)
  if (!deco) {
    deco = Decoration.line({ class: cls })
    lineCache.set(cls, deco)
  }
  return deco
}

function decorationFor(kind: DecoRange['kind'], cls: string): Decoration {
  if (kind === 'replace') return REPLACE
  return kind === 'line' ? lineFor(cls) : markFor(cls)
}

/**
 * Plain ranges -> a DecorationSet.
 *
 * Trap #5: RangeSetBuilder throws unless ranges arrive sorted by `from` and
 * then by the decoration's own `startSide`. We sort on the real side values
 * rather than assuming what they are.
 */
export function toDecorationSet(ranges: readonly DecoRange[]): DecorationSet {
  const items = ranges.map((r) => ({
    from: r.from,
    to: r.to,
    value: decorationFor(r.kind, r.class ?? 'cm-md-syntax')
  }))
  items.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide)

  const builder = new RangeSetBuilder<Decoration>()
  for (const item of items) builder.add(item.from, item.to, item.value)
  return builder.finish()
}

function compute(view: EditorView, rules: RuleTable): DecorationSet {
  return toDecorationSet(buildDecorationRanges(view.state, view.visibleRanges, rules))
}

/**
 * The two decoration sources (§4.1): the ViewPlugin below, which owns
 * everything that fits inside a line, and the state field from `lines.ts`,
 * which collapses whole lines — a ViewPlugin is not allowed to, since that
 * changes the editor's vertical layout.
 */
export function markdownDecorations(rules: RuleTable): Extension {
  return [collapsedLines(rules), inlineDecorations(rules)]
}

/**
 * The ViewPlugin that owns the inline decoration set.
 *
 * Rebuilt on document change, selection change, viewport change, and when the
 * incremental parser produces a newer tree for the same document.
 */
function inlineDecorations(rules: RuleTable): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = compute(view, rules)
      }

      update(update: ViewUpdate): void {
        // I6: hiding or revealing markers mid-composition corrupts IME input
        // and breaks the macOS accent picker. Leave the set alone until the
        // composition commits; the next update rebuilds it.
        if (update.view.composing) return

        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.decorations = compute(update.view, rules)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  )
}
