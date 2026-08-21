import { describe, expect, it } from 'vitest'
import { CommandRegistry } from '../src/commands/registry.js'
import { formatCommands } from '../src/commands/format.js'
import type { CommandContext, CommandDef } from '../src/commands/types.js'

const ctx: CommandContext = { view: null, app: {} }

const def = (id: string, extra: Partial<CommandDef> = {}): CommandDef => ({
  id,
  title: id,
  scope: 'editor',
  run: () => true,
  ...extra
})

describe('CommandRegistry', () => {
  it('throws on a duplicate id rather than shadowing silently', () => {
    const registry = new CommandRegistry([def('a')])
    expect(() => registry.register(def('a'))).toThrow(/Duplicate command id: a/)
  })

  it('checks `when` before dispatching', () => {
    let ran = false
    const registry = new CommandRegistry([
      def('blocked', { when: () => false, run: () => ((ran = true), true) })
    ])
    expect(registry.run('blocked', ctx)).toBe(false)
    expect(ran).toBe(false)
  })

  it('reports false for an unknown id', () => {
    expect(new CommandRegistry().run('nope', ctx)).toBe(false)
    expect(new CommandRegistry().enabled('nope', ctx)).toBe(false)
  })

  it('passes the context through to run', () => {
    let seen: CommandContext | null = null
    const registry = new CommandRegistry([def('x', { run: (c) => ((seen = c), true) })])
    registry.run('x', ctx)
    expect(seen).toBe(ctx)
  })
})

describe('describe()', () => {
  it('is serializable — no functions survive the projection', () => {
    const registry = new CommandRegistry(formatCommands)
    const described = registry.describe(ctx)
    expect(described.length).toBe(formatCommands.length)
    expect(JSON.parse(JSON.stringify(described))).toEqual(described)
    for (const d of described) {
      for (const value of Object.values(d)) {
        expect(typeof value).not.toBe('function')
      }
    }
  })

  it('resolves `enabled` against the context at call time', () => {
    const registry = new CommandRegistry([
      def('needsView', { when: (c) => c.view !== null }),
      def('always')
    ])
    const described = registry.describe(ctx)
    expect(described.find((d) => d.id === 'needsView')?.enabled).toBe(false)
    expect(described.find((d) => d.id === 'always')?.enabled).toBe(true)
  })

  it('carries the scope that decides accelerator ownership', () => {
    const registry = new CommandRegistry(formatCommands)
    expect(registry.describe(ctx).every((d) => d.scope === 'editor')).toBe(true)
  })

  it('every format command is disabled without a view', () => {
    const registry = new CommandRegistry(formatCommands)
    expect(registry.describe(ctx).every((d) => !d.enabled)).toBe(true)
  })

  it('declares no duplicate keys across the format table', () => {
    const seen = new Set<string>()
    for (const command of formatCommands) {
      for (const key of command.keys ?? []) {
        expect(seen.has(key), `${key} bound twice`).toBe(false)
        seen.add(key)
      }
    }
  })
})
