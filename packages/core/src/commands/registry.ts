import type { CommandContext, CommandDef, CommandDescriptor } from './types.js'

/**
 * The single source of truth for every user-invocable action (I4).
 *
 * Keymaps, menus, palettes and toolbar buttons all read this registry — a
 * command that is not registered cannot be invoked, and one that is
 * registered is reachable from all four without extra wiring.
 */
export class CommandRegistry {
  readonly #commands = new Map<string, CommandDef>()

  constructor(defs: readonly CommandDef[] = []) {
    this.register(...defs)
  }

  /** @throws if an id is already taken — silent shadowing is never intended. */
  register(...defs: readonly CommandDef[]): this {
    for (const def of defs) {
      if (this.#commands.has(def.id)) {
        throw new Error(`Duplicate command id: ${def.id}`)
      }
      this.#commands.set(def.id, def)
    }
    return this
  }

  get(id: string): CommandDef | undefined {
    return this.#commands.get(id)
  }

  all(): CommandDef[] {
    return [...this.#commands.values()]
  }

  /** True when the command exists and its `when` guard passes. */
  enabled(id: string, ctx: CommandContext): boolean {
    const def = this.#commands.get(id)
    return def ? (def.when?.(ctx) ?? true) : false
  }

  /** @returns true if a command ran and reported that it handled the event. */
  run(id: string, ctx: CommandContext): boolean {
    const def = this.#commands.get(id)
    if (!def) return false
    if (def.when && !def.when(ctx)) return false
    return def.run(ctx)
  }

  /**
   * A snapshot safe to send over IPC or store in component state. Enabled
   * state is resolved against `ctx` at call time, so the shell re-describes
   * whenever focus or selection changes.
   */
  describe(ctx: CommandContext): CommandDescriptor[] {
    return this.all().map((def) => ({
      id: def.id,
      title: def.title,
      ...(def.category === undefined ? {} : { category: def.category }),
      ...(def.keys === undefined ? {} : { keys: [...def.keys] }),
      scope: def.scope,
      enabled: def.when?.(ctx) ?? true
    }))
  }
}
