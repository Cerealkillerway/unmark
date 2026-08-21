import { describe, expect, it } from 'vitest'
import { buildMenu } from '../src/main/menu.js'
import type { MenuCommand } from '../src/shared/ipc.js'

interface Item {
  label?: string
  accelerator?: string
  registerAccelerator?: boolean
  enabled?: boolean
  role?: string
  type?: string
  submenu?: Item[]
  click?: () => void
}

const commands: MenuCommand[] = [
  { id: 'format.bold', title: 'Bold', category: 'Format', keys: ['Mod-b'], scope: 'editor', enabled: true },
  { id: 'format.link', title: 'Link', category: 'Format', keys: ['Mod-k'], scope: 'editor', enabled: false },
  { id: 'file.save', title: 'Save', category: 'File', keys: ['Mod-s'], scope: 'app', enabled: true },
  { id: 'view.focusMode', title: 'Focus Mode', category: 'View', keys: ['Mod-Shift-f'], scope: 'app', enabled: true },
  { id: 'weird.thing', title: 'Thing', category: 'Tools', scope: 'app', enabled: true }
]

const menu = (): Item[] => buildMenu(commands, null) as unknown as Item[]
const submenu = (label: string): Item[] => menu().find((item) => item.label === label)?.submenu ?? []
const find = (label: string, item: string): Item | undefined =>
  submenu(label).find((entry) => entry.label === item)

describe('accelerator ownership (§4.3, trap #4)', () => {
  /**
   * An Electron accelerator is registered with the OS and fires before the
   * renderer sees the keystroke. If the Format menu claimed Mod-b, CodeMirror
   * would never observe it and bold would silently stop working.
   */
  it('shows an editor shortcut but does not register it', () => {
    const bold = find('Format', 'Bold')
    expect(bold?.accelerator).toBe('CmdOrCtrl+B')
    expect(bold?.registerAccelerator).toBe(false)
  })

  it('registers app shortcuts, which must work without editor focus', () => {
    expect(find('File', 'Save')?.registerAccelerator).toBe(true)
    expect(find('View', 'Focus Mode')?.registerAccelerator).toBe(true)
  })

  it('never registers an accelerator for an editor-scoped command', () => {
    const walk = (items: Item[]): Item[] =>
      items.flatMap((item) => [item, ...walk(item.submenu ?? [])])
    const byLabel = new Map(commands.map((c) => [c.title, c]))
    for (const item of walk(menu())) {
      const command = item.label ? byLabel.get(item.label) : undefined
      if (command?.scope === 'editor') expect(item.registerAccelerator).toBe(false)
    }
  })
})

describe('the menu is built from describe() and nothing else (I4)', () => {
  it('carries the enabled flag through', () => {
    expect(find('Format', 'Bold')?.enabled).toBe(true)
    expect(find('Format', 'Link')?.enabled).toBe(false)
  })

  it('gives an unknown category its own top-level menu', () => {
    expect(find('Tools', 'Thing')).toBeDefined()
  })

  it('leaves undo/cut/copy/paste as native roles rather than IPC round trips', () => {
    const roles = submenu('Edit').map((item) => item.role)
    expect(roles).toContain('undo')
    expect(roles).toContain('copy')
    expect(roles).toContain('paste')
  })

  it('omits an accelerator entirely for a command with no keys', () => {
    expect(find('Tools', 'Thing')?.accelerator).toBeUndefined()
  })
})
