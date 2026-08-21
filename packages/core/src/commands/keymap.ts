import { Prec, type Extension } from '@codemirror/state'
import { keymap, type EditorView, type KeyBinding } from '@codemirror/view'
import type { CommandContext, CommandDef } from './types.js'
import type { CommandRegistry } from './registry.js'

/** Builds the `CommandContext` for a keystroke arriving at `view`. */
export type ContextFor = (view: EditorView) => CommandContext

export function bindingsFor(defs: readonly CommandDef[], contextFor: ContextFor): KeyBinding[] {
  const out: KeyBinding[] = []
  for (const def of defs) {
    if (!def.keys?.length) continue
    const run = (view: EditorView): boolean => {
      const ctx = contextFor(view)
      if (def.when && !def.when(ctx)) return false
      return def.run(ctx)
    }
    for (const key of def.keys) out.push({ key, run, preventDefault: true })
  }
  return out
}

/**
 * The keymap derived from the registry.
 *
 * `Prec.high` is not optional: without it the base and markdown keymaps sit at
 * the same precedence and win on overlapping bindings, so `Mod-i` would keep
 * doing whatever CodeMirror's default does instead of toggling emphasis.
 */
export function commandKeymap(registry: CommandRegistry, contextFor: ContextFor): Extension {
  return Prec.high(keymap.of(bindingsFor(registry.all(), contextFor)))
}
