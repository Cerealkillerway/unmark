/**
 * Translation between CodeMirror key notation (`Mod-Shift-k`) and Electron
 * accelerator notation (`CmdOrCtrl+Shift+K`).
 *
 * This lives in core, not in the desktop app, so that a command's `keys` and
 * the accelerator shown next to its menu item can never drift apart — they
 * are derived from one string.
 */

/** CodeMirror key name → Electron key name. Only where they disagree. */
const TO_ELECTRON: Readonly<Record<string, string>> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Enter: 'Return',
  Escape: 'Esc',
  ' ': 'Space'
}

const TO_CODEMIRROR: Readonly<Record<string, string>> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  return: 'Enter',
  enter: 'Enter',
  esc: 'Escape',
  escape: 'Escape',
  space: 'Space',
  plus: '+',
  backspace: 'Backspace',
  delete: 'Delete',
  tab: 'Tab',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown'
}

const CM_MODIFIERS: Readonly<Record<string, string>> = {
  mod: 'Mod',
  cmd: 'Meta',
  command: 'Meta',
  meta: 'Meta',
  super: 'Meta',
  cmdorctrl: 'Mod',
  commandorcontrol: 'Mod',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift'
}

interface Parsed {
  mod: boolean
  meta: boolean
  ctrl: boolean
  alt: boolean
  shift: boolean
  key: string
}

function empty(): Parsed {
  return { mod: false, meta: false, ctrl: false, alt: false, shift: false, key: '' }
}

function applyModifier(out: Parsed, name: string): void {
  switch (CM_MODIFIERS[name.toLowerCase()]) {
    case 'Mod':
      out.mod = true
      break
    case 'Meta':
      out.meta = true
      break
    case 'Ctrl':
      out.ctrl = true
      break
    case 'Alt':
      out.alt = true
      break
    case 'Shift':
      out.shift = true
      break
  }
}

/** Split on the separator, but never on a trailing one — `Mod--` is Mod + `-`. */
function split(binding: string, separator: '-' | '+'): string[] {
  const parts = binding.split(separator === '-' ? /-(?!$)/ : /\+(?!$)/)
  return parts.length > 0 ? parts : [binding]
}

function parse(binding: string, separator: '-' | '+'): Parsed {
  const parts = split(binding, separator)
  const out = empty()
  for (let i = 0; i < parts.length - 1; i++) applyModifier(out, parts[i]!)
  const key = parts[parts.length - 1] ?? ''
  // `Mod`, `Mod-`, `Ctrl+` — all modifiers, no key. Not a binding.
  const bare = key.endsWith(separator) ? key.slice(0, -1) : key
  if (bare && CM_MODIFIERS[bare.toLowerCase()]) {
    applyModifier(out, bare)
    return out
  }
  out.key = key
  return out
}

function electronKey(key: string): string {
  const mapped = TO_ELECTRON[key]
  if (mapped) return mapped
  if (key.length === 1) return key.toUpperCase()
  return key
}

function codemirrorKey(key: string): string {
  const mapped = TO_CODEMIRROR[key.toLowerCase()]
  if (mapped) return mapped
  if (key.length === 1) return key.toLowerCase()
  if (/^F\d{1,2}$/i.test(key)) return key.toUpperCase()
  return key
}

/**
 * `Mod-Shift-k` → `CmdOrCtrl+Shift+K`.
 *
 * @returns undefined for a binding with no key, so callers can drop it rather
 * than hand Electron an accelerator it will throw on.
 */
export function toAccelerator(binding: string): string | undefined {
  const p = parse(binding, '-')
  if (!p.key) return undefined
  const parts: string[] = []
  if (p.mod) parts.push('CmdOrCtrl')
  if (p.meta) parts.push('Command')
  if (p.ctrl) parts.push('Control')
  if (p.alt) parts.push('Alt')
  if (p.shift) parts.push('Shift')
  parts.push(electronKey(p.key))
  return parts.join('+')
}

/** `CmdOrCtrl+Shift+K` → `Mod-Shift-k`. */
export function toKeyBinding(accelerator: string): string | undefined {
  const p = parse(accelerator, '+')
  if (!p.key) return undefined
  const parts: string[] = []
  if (p.mod) parts.push('Mod')
  if (p.meta) parts.push('Meta')
  if (p.ctrl) parts.push('Ctrl')
  if (p.alt) parts.push('Alt')
  if (p.shift) parts.push('Shift')
  parts.push(codemirrorKey(p.key))
  return parts.join('-')
}
