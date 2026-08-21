import { describe, expect, it } from 'vitest'
import { toAccelerator, toKeyBinding } from '../src/commands/accelerator.js'
import { formatCommands } from '../src/commands/format.js'

describe('toAccelerator', () => {
  it('translates the §4.3 example', () => {
    expect(toAccelerator('Mod-Shift-k')).toBe('CmdOrCtrl+Shift+K')
  })

  it('uppercases single-character keys and keeps named ones', () => {
    expect(toAccelerator('Mod-b')).toBe('CmdOrCtrl+B')
    expect(toAccelerator('Mod-1')).toBe('CmdOrCtrl+1')
    expect(toAccelerator('Ctrl-Alt-Enter')).toBe('Control+Alt+Return')
    expect(toAccelerator('Shift-ArrowUp')).toBe('Shift+Up')
    expect(toAccelerator('F5')).toBe('F5')
  })

  it('keeps an explicit Meta distinct from Mod', () => {
    expect(toAccelerator('Meta-s')).toBe('Command+S')
    expect(toAccelerator('Mod-s')).toBe('CmdOrCtrl+S')
  })

  it('does not split a trailing separator — `Mod--` is Mod plus minus', () => {
    expect(toAccelerator('Mod--')).toBe('CmdOrCtrl+-')
  })

  it('returns undefined for a modifier with no key, rather than a bad accelerator', () => {
    expect(toAccelerator('')).toBeUndefined()
    expect(toAccelerator('Mod-')).toBeUndefined()
  })
})

describe('toKeyBinding', () => {
  it('is the inverse of toAccelerator', () => {
    expect(toKeyBinding('CmdOrCtrl+Shift+K')).toBe('Mod-Shift-k')
    expect(toKeyBinding('CmdOrCtrl+B')).toBe('Mod-b')
    expect(toKeyBinding('Control+Alt+Return')).toBe('Ctrl-Alt-Enter')
    expect(toKeyBinding('Shift+Up')).toBe('Shift-ArrowUp')
  })

  it('round-trips every key the format commands declare', () => {
    for (const def of formatCommands) {
      for (const key of def.keys ?? []) {
        const accelerator = toAccelerator(key)
        expect(accelerator, key).toBeDefined()
        expect(toKeyBinding(accelerator!), key).toBe(key)
      }
    }
  })
})
