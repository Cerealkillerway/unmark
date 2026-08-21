import { describe, expect, it } from 'vitest'
import { type CommandRegistry, defaultCommands, type CommandContext } from '@md/core'
import { appCommands, type Shell } from '../src/renderer/state/app-commands.js'
import { commandLabel, filterCommands } from '../src/renderer/state/palette.js'
import { DocumentStore } from '../src/renderer/state/store.js'

function harness(): { registry: CommandRegistry; ctx: CommandContext; calls: string[] } {
  const calls: string[] = []
  const store = new DocumentStore()
  store.open('/tmp/a.md', 'body')

  const record =
    (name: string) =>
    (..._args: unknown[]): never => {
      calls.push(name)
      return undefined as never
    }

  const shell: Shell = {
    store,
    newDocument: record('newDocument'),
    openFiles: record('openFiles'),
    openFolder: record('openFolder'),
    openPath: record('openPath'),
    save: record('save'),
    saveAs: record('saveAs'),
    closeActive: record('closeActive'),
    step: record('step'),
    togglePalette: record('togglePalette'),
    togglePanel: record('togglePanel'),
    toggleFocusMode: record('toggleFocusMode'),
    setTheme: record('setTheme'),
    theme: () => 'dark'
  }

  const registry = defaultCommands()
  registry.register(...appCommands())
  return { registry, ctx: { view: null, app: { shell } }, calls }
}

describe('the command palette', () => {
  it('lists every registered command', () => {
    const { registry, ctx } = harness()
    const descriptors = registry.describe(ctx)
    const listed = filterCommands(descriptors, '')
    expect(listed.length).toBe(registry.all().length)
    expect(new Set(listed.map((c) => c.id))).toEqual(new Set(registry.all().map((c) => c.id)))
  })

  it('runs every app command it lists', () => {
    const { registry, ctx, calls } = harness()
    const app = registry.describe(ctx).filter((c) => c.scope === 'app')
    expect(app.length).toBeGreaterThan(8)
    for (const command of app) {
      expect(registry.run(command.id, ctx), command.id).toBe(true)
    }
    expect(calls.length).toBe(app.length)
  })

  it('disables format commands with no editor focus, and refuses to run them', () => {
    const { registry, ctx } = harness()
    const format = registry.describe(ctx).filter((c) => c.scope === 'editor')
    expect(format.length).toBeGreaterThan(0)
    for (const command of format) {
      expect(command.enabled, command.id).toBe(false)
      expect(registry.run(command.id, ctx), command.id).toBe(false)
    }
  })

  it('finds a command by subsequence across its category', () => {
    const { registry, ctx } = harness()
    const descriptors = registry.describe(ctx)
    expect(filterCommands(descriptors, 'fmb')[0]?.id).toBe('format.bold')
    expect(filterCommands(descriptors, 'save')[0]?.id).toBe('file.save')
    expect(filterCommands(descriptors, 'zzzz')).toEqual([])
  })

  it('labels a command with its category', () => {
    expect(commandLabel({ id: 'x', title: 'Bold', category: 'Format', scope: 'editor', enabled: true })).toBe(
      'Format: Bold'
    )
  })
})
