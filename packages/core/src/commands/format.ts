import type { EditorView } from '@codemirror/view'
import type { CommandContext, CommandDef } from './types.js'
import {
  PREFIX_BULLET,
  PREFIX_ORDERED,
  PREFIX_QUOTE,
  PREFIX_TASK,
  WRAP_CODE,
  WRAP_EMPHASIS,
  WRAP_STRIKETHROUGH,
  WRAP_STRONG,
  headingPrefix,
  toggleLink,
  toggleLinePrefix,
  toggleWrap,
  type LinePrefixSpec,
  type WrapSpec
} from './transforms.js'

const editable = (ctx: CommandContext): boolean => ctx.view !== null && !ctx.view.state.readOnly

/** Lifts a view-taking transform into a CommandDef body. */
function onView(fn: (view: EditorView) => boolean): (ctx: CommandContext) => boolean {
  return (ctx) => (ctx.view ? fn(ctx.view) : false)
}

interface FormatOptions {
  id: string
  title: string
  keys?: readonly string[]
}

function wrapCommand(options: FormatOptions, spec: WrapSpec): CommandDef {
  return {
    ...options,
    category: 'Format',
    scope: 'editor',
    when: editable,
    run: onView((view) => toggleWrap(view, spec))
  }
}

function prefixCommand(options: FormatOptions, spec: LinePrefixSpec): CommandDef {
  return {
    ...options,
    category: 'Format',
    scope: 'editor',
    when: editable,
    run: onView((view) => toggleLinePrefix(view, spec))
  }
}

const headingCommands: CommandDef[] = [1, 2, 3, 4, 5, 6].map((level) =>
  prefixCommand(
    { id: `format.heading${level}`, title: `Heading ${level}`, keys: [`Mod-${level}`] },
    headingPrefix(level)
  )
)

/**
 * Every format action in one list (I4). Keys are declared here and nowhere
 * else — the CM6 keymap, the Electron menu and the command palette are all
 * derived from this table.
 */
export const formatCommands: readonly CommandDef[] = [
  wrapCommand({ id: 'format.bold', title: 'Bold', keys: ['Mod-b'] }, WRAP_STRONG),
  wrapCommand({ id: 'format.italic', title: 'Italic', keys: ['Mod-i'] }, WRAP_EMPHASIS),
  wrapCommand({ id: 'format.code', title: 'Inline Code', keys: ['Mod-e'] }, WRAP_CODE),
  wrapCommand(
    { id: 'format.strikethrough', title: 'Strikethrough', keys: ['Mod-Shift-x'] },
    WRAP_STRIKETHROUGH
  ),
  ...headingCommands,
  prefixCommand(
    { id: 'format.paragraph', title: 'Paragraph', keys: ['Mod-0'] },
    { prefix: '', pattern: /^\s*#{1,6}\s+/ }
  ),
  prefixCommand(
    { id: 'format.bulletList', title: 'Bullet List', keys: ['Mod-Shift-8'] },
    PREFIX_BULLET
  ),
  prefixCommand(
    { id: 'format.orderedList', title: 'Ordered List', keys: ['Mod-Shift-7'] },
    PREFIX_ORDERED
  ),
  prefixCommand({ id: 'format.taskList', title: 'Task List', keys: ['Mod-Shift-9'] }, PREFIX_TASK),
  prefixCommand({ id: 'format.quote', title: 'Blockquote', keys: ["Mod-Shift-'"] }, PREFIX_QUOTE),
  {
    id: 'format.link',
    title: 'Link',
    category: 'Format',
    keys: ['Mod-k'],
    scope: 'editor',
    when: editable,
    run: onView((view) => toggleLink(view))
  }
]
