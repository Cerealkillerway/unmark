import { syntaxTree } from '@codemirror/language'
import {
  StateField,
  type EditorSelection,
  type EditorState,
  type Extension
} from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import type { SyntaxNode, Tree } from '@lezer/common'
import { isMarker } from './builder.js'
import { isLineRevealed } from './reveal.js'
import type { NodeRule, RuleTable, Span } from './types.js'

/**
 * Line-level hiding: the second decoration source (§4.1).
 *
 * A `replace` decoration that swallows a line break changes the editor's
 * vertical layout, and CodeMirror settles layout before view plugins run — so
 * such a decoration may only come from a state field. That is the whole
 * reason this lives apart from `plugin.ts` instead of being one more thing
 * the builder emits.
 *
 * It is what lets a fenced code block hide its ``` lines the way `**bold**`
 * hides its asterisks. Constructs that keep their markers unconditionally
 * (front matter, setext underlines) simply do not set `hideLines`.
 */

/**
 * The only nodes a hideable block can be nested inside.
 *
 * A state field has no viewport to iterate, and unlike the builder it cannot
 * pretend it has one: the height map derives the document's height from block
 * decorations, so decorating only the viewport would make the scrollbar jump
 * around as it scrolled. The walk is whole-document, and trap #8 is answered
 * by keeping it O(blocks) rather than O(nodes) — a paragraph's inline tree,
 * the bulk of any real document, is never entered — and by only re-walking
 * when the document or the tree actually changed.
 */
const CONTAINERS = new Set([
  'Document',
  'Blockquote',
  'BulletList',
  'OrderedList',
  'ListItem'
])

/** A block that can collapse, and the range whose selection brings it back. */
export interface Collapsible {
  /** Every line the block spans, first character to last. */
  readonly reveal: Span
  /** The lines that go: the outer ones, whole. */
  readonly lines: readonly Span[]
}

/** Every collapsible block in the document, in document order. */
export function collapsibleBlocks(state: EditorState, rules: RuleTable): Collapsible[] {
  const out: Collapsible[] = []
  syntaxTree(state).iterate({
    enter: (ref) => {
      const rule = rules[ref.name]
      if (!rule?.hideLines) return CONTAINERS.has(ref.name)
      const block = collapsibleAt(state, ref.node, rule)
      if (block) out.push(block)
      return false
    }
  })
  return out
}

function collapsibleAt(
  state: EditorState,
  node: SyntaxNode,
  rule: NodeRule
): Collapsible | null {
  const first = state.doc.lineAt(node.from)
  const last = state.doc.lineAt(node.to)
  if (last.number === first.number) return null

  // Only the outer lines can go, and only when the node's own opening and
  // closing markers are what sits on them. A marker on a middle line — the
  // `>` of a quoted code block — belongs to a line the reader still needs.
  const open = node.firstChild
  const close = node.lastChild
  const lines: Span[] = []
  if (open && isMarker(open.name, rule) && open.from < first.to) {
    lines.push({ from: first.from, to: first.to })
  }
  if (close && isMarker(close.name, rule) && close.to > last.from) {
    lines.push({ from: last.from, to: last.to })
  }

  // Never collapse a block down to nothing. An empty ```js/``` pair would
  // otherwise vanish outright — unclickable, and gone from the page with no
  // hint that it is still in the file.
  if (lines.length === 0 || lines.length > last.number - first.number) return null

  return {
    reveal: { from: first.from, to: last.to },
    lines: lines.filter((l) => l.to > l.from)
  }
}

/**
 * The whole lines that are currently collapsed, in document order.
 *
 * Pure and view-free, like `buildDecorationRanges`, so the behaviour can be
 * tested as `(doc, selection) -> lines` (§7).
 */
export function collapsedLineRanges(state: EditorState, rules: RuleTable): Span[] {
  return collapsed(collapsibleBlocks(state, rules), state.selection)
}

function collapsed(blocks: readonly Collapsible[], selection: EditorSelection): Span[] {
  const out: Span[] = []
  for (const block of blocks) {
    if (!isLineRevealed(block.reveal, selection)) out.push(...block.lines)
  }
  return out
}

/**
 * A block replacement over a line's entire text takes the line itself —
 * height, line break and all — which is exactly what hiding a fence means.
 * Covering a neighbouring line break instead would work too, but it would put
 * the decoration's range in the neighbour's line and dirty it on every edit.
 */
const COLLAPSE = Decoration.replace({ block: true })

/**
 * The tree walk is worth caching: moving the caret is the one interaction
 * this field exists to answer, and a caret move changes which blocks are
 * revealed, never which blocks exist.
 */
interface Scan {
  readonly tree: Tree
  readonly blocks: readonly Collapsible[]
  readonly deco: DecorationSet
}

function scan(state: EditorState, rules: RuleTable, tree: Tree): Scan {
  const blocks = collapsibleBlocks(state, rules)
  return { tree, blocks, deco: decorations(blocks, state.selection) }
}

function decorations(
  blocks: readonly Collapsible[],
  selection: EditorSelection
): DecorationSet {
  return Decoration.set(
    collapsed(blocks, selection).map((line) => COLLAPSE.range(line.from, line.to)),
    true
  )
}

/** The extension. Collapses the marker lines of every `hideLines` rule. */
export function collapsedLines(rules: RuleTable): Extension {
  return StateField.define<Scan>({
    create: (state) => scan(state, rules, syntaxTree(state)),
    update(prev, tr) {
      // I6 has no bearing here: while an IME composition runs, the caret is
      // inside the node being edited, so its lines are revealed either way.
      const tree = syntaxTree(tr.state)
      // A newer tree for the same text arrives in a transaction of its own,
      // as the parser works its way through the document.
      if (tr.docChanged || tree !== prev.tree) return scan(tr.state, rules, tree)
      if (!tr.selection) return prev
      return { ...prev, deco: decorations(prev.blocks, tr.state.selection) }
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.deco)
  })
}
