import type { EditorView } from '@codemirror/view'

/**
 * Whatever the shell wants to expose to commands that reach outside the
 * editor — file dialogs, tabs, window controls. `@md/core` never implements
 * this (I2): it only names the seam so `file.save` can be a command like any
 * other, and so the registry has a single shape for every action.
 */
export interface AppBridge {
  readonly [capability: string]: unknown
}

export interface CommandContext {
  /** null when focus is outside the editor — a palette input, a sidebar. */
  readonly view: EditorView | null
  readonly app: AppBridge
}

/** Where a keystroke is handled, which decides who owns the accelerator. */
export type CommandScope = 'editor' | 'app'

export interface CommandDef {
  /** Namespaced and stable: menus, keymaps and IPC all address it. */
  readonly id: string
  readonly title: string
  /** Groups the command in the palette and the menu bar. */
  readonly category?: string
  /** CodeMirror notation, e.g. `['Mod-b']`. */
  readonly keys?: readonly string[]
  readonly scope: CommandScope
  readonly when?: (ctx: CommandContext) => boolean
  /** @returns true if the command handled the event. */
  readonly run: (ctx: CommandContext) => boolean
}

/**
 * The serializable projection of a command — no functions, so it can cross
 * the Electron IPC boundary. The main process builds menus from these; it
 * cannot hold `run`, which closes over a renderer-side EditorView.
 */
export interface CommandDescriptor {
  readonly id: string
  readonly title: string
  readonly category?: string
  readonly keys?: readonly string[]
  readonly scope: CommandScope
  readonly enabled: boolean
}
