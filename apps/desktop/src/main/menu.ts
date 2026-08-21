import { Menu, app, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { toAccelerator } from '@md/core/accelerator'
import { IPC, type MenuCommand } from '../shared/ipc.js'

/**
 * The menu bar, built entirely from the renderer's `registry.describe()` (I4).
 * Main never knows what a command *does* — only its id, its label and who owns
 * its key.
 */

const CATEGORY_ORDER = ['File', 'Edit', 'Format', 'View', 'Help']

/**
 * §4.3, accelerator ownership.
 *
 * An Electron accelerator is registered with the OS and fires before the
 * renderer sees the keystroke. Registering `CmdOrCtrl+B` here would mean
 * CodeMirror never observes it and `Mod-b` silently stops working — trap #4.
 *
 * So an `editor`-scoped command gets `registerAccelerator: false`: the
 * shortcut still *displays* beside the label and the item is still clickable,
 * but the key itself falls through to the CM6 keymap. Only `app`-scoped
 * commands actually claim the key.
 */
function itemFor(command: MenuCommand, send: (id: string) => void): MenuItemConstructorOptions {
  const key = command.keys?.[0]
  const accelerator = key ? toAccelerator(key) : undefined
  return {
    label: command.title,
    enabled: command.enabled,
    ...(accelerator ? { accelerator, registerAccelerator: command.scope === 'app' } : {}),
    click: () => send(command.id)
  }
}

function group(
  commands: readonly MenuCommand[],
  category: string,
  send: (id: string) => void
): MenuItemConstructorOptions[] {
  return commands.filter((c) => c.category === category).map((c) => itemFor(c, send))
}

export function buildMenu(commands: readonly MenuCommand[], win: BrowserWindow | null): Menu {
  const send = (id: string): void => {
    if (win && !win.isDestroyed()) win.webContents.send(IPC.commandRun, id)
  }

  const template: MenuItemConstructorOptions[] = []

  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  template.push({
    label: 'File',
    submenu: [
      ...group(commands, 'File', send),
      // No `role: close` on macOS: its Cmd-W would be registered at OS level
      // and steal the key from `file.closeTab`. Quit lives in the app menu
      // there; everywhere else it belongs here.
      ...(process.platform === 'darwin'
        ? []
        : [{ type: 'separator' as const }, { role: 'quit' as const }])
    ]
  })

  template.push({
    label: 'Edit',
    submenu: [
      // Roles, not commands: undo/redo/cut/copy/paste are the OS's job and
      // routing them through IPC would break the native clipboard.
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'pasteAndMatchStyle' },
      { role: 'selectAll' },
      ...(group(commands, 'Edit', send).length
        ? [{ type: 'separator' as const }, ...group(commands, 'Edit', send)]
        : [])
    ]
  })

  template.push({ label: 'Format', submenu: group(commands, 'Format', send) })

  template.push({
    label: 'View',
    submenu: [
      ...group(commands, 'View', send),
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
      { role: 'toggleDevTools' }
    ]
  })

  const other = [...new Set(commands.map((c) => c.category))]
    .filter((category): category is string => typeof category === 'string')
    .filter((category) => !CATEGORY_ORDER.includes(category))
  for (const category of other) {
    template.push({ label: category, submenu: group(commands, category, send) })
  }

  return Menu.buildFromTemplate(template)
}
