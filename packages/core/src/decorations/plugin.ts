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
import type { DecoRange, RuleTable } from './types.js'

const REPLACE = Decoration.replace({})
const markCache = new Map<string, Decoration>()

function markFor(cls: string): Decoration {
  let deco = markCache.get(cls)
  if (!deco) {
    deco = Decoration.mark({ class: cls })
    markCache.set(cls, deco)
  }
  return deco
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
    value: r.kind === 'replace' ? REPLACE : markFor(r.class ?? 'cm-md-syntax')
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
 * The single ViewPlugin that owns the decoration set (§4.1).
 *
 * Rebuilt on document change, selection change, viewport change, and when the
 * incremental parser produces a newer tree for the same document.
 */
export function markdownDecorations(rules: RuleTable): Extension {
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
