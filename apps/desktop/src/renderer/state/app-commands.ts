import type { CommandDef } from '@md/core'
import type { DocumentStore } from './store.js'
import type { ThemeName } from './theme.js'

/**
 * What an app-scope command is allowed to reach. `@md/core` defines the
 * `AppBridge` seam and nothing more; this is the shell's half of it.
 */
export interface Shell {
  readonly store: DocumentStore
  newDocument(): void
  openFiles(): Promise<void>
  openFolder(): Promise<void>
  openPath(path: string): Promise<void>
  save(): Promise<void>
  saveAs(): Promise<void>
  closeActive(): void
  step(delta: number): void
  togglePalette(): void
  togglePanel(panel: 'sidebar' | 'outline'): void
  toggleFocusMode(): void
  setTheme(theme: ThemeName): void
  theme(): ThemeName
}

const shellOf = (app: { shell?: unknown }): Shell => app.shell as Shell

/**
 * File and view actions.
 *
 * All `scope: 'app'` — §4.3: these accelerators are registered with the OS and
 * handled by the menu, because they must work whether or not the editor has
 * focus. Format commands are `scope: 'editor'` and deliberately let their keys
 * fall through to CodeMirror instead.
 */
export function appCommands(): CommandDef[] {
  const run = (fn: (shell: Shell) => unknown) => (ctx: { app: { shell?: unknown } }): boolean => {
    void fn(shellOf(ctx.app))
    return true
  }
  const hasDoc = (ctx: { app: { shell?: unknown } }): boolean =>
    shellOf(ctx.app).store.active !== null

  return [
    {
      id: 'file.new',
      title: 'New',
      category: 'File',
      keys: ['Mod-n'],
      scope: 'app',
      run: run((shell) => shell.newDocument())
    },
    {
      id: 'file.open',
      title: 'Open…',
      category: 'File',
      keys: ['Mod-o'],
      scope: 'app',
      run: run((shell) => shell.openFiles())
    },
    {
      id: 'file.openFolder',
      title: 'Open Folder…',
      category: 'File',
      keys: ['Mod-Shift-o'],
      scope: 'app',
      run: run((shell) => shell.openFolder())
    },
    {
      id: 'file.save',
      title: 'Save',
      category: 'File',
      keys: ['Mod-s'],
      scope: 'app',
      when: hasDoc,
      run: run((shell) => shell.save())
    },
    {
      id: 'file.saveAs',
      title: 'Save As…',
      category: 'File',
      keys: ['Mod-Shift-s'],
      scope: 'app',
      when: hasDoc,
      run: run((shell) => shell.saveAs())
    },
    {
      id: 'file.closeTab',
      title: 'Close Tab',
      category: 'File',
      keys: ['Mod-w'],
      scope: 'app',
      when: hasDoc,
      run: run((shell) => shell.closeActive())
    },
    {
      id: 'file.nextTab',
      title: 'Next Tab',
      category: 'File',
      keys: ['Mod-Alt-ArrowRight'],
      scope: 'app',
      when: hasDoc,
      run: run((shell) => shell.step(1))
    },
    {
      id: 'file.previousTab',
      title: 'Previous Tab',
      category: 'File',
      keys: ['Mod-Alt-ArrowLeft'],
      scope: 'app',
      when: hasDoc,
      run: run((shell) => shell.step(-1))
    },
    {
      id: 'view.commandPalette',
      title: 'Command Palette…',
      category: 'View',
      keys: ['Mod-Shift-p'],
      scope: 'app',
      run: run((shell) => shell.togglePalette())
    },
    {
      id: 'view.toggleSidebar',
      title: 'Toggle Files',
      category: 'View',
      keys: ['Mod-Shift-e'],
      scope: 'app',
      run: run((shell) => shell.togglePanel('sidebar'))
    },
    {
      id: 'view.toggleOutline',
      title: 'Toggle Outline',
      category: 'View',
      keys: ['Mod-Shift-d'],
      scope: 'app',
      run: run((shell) => shell.togglePanel('outline'))
    },
    {
      id: 'view.focusMode',
      title: 'Focus Mode',
      category: 'View',
      keys: ['Mod-Shift-f'],
      scope: 'app',
      run: run((shell) => shell.toggleFocusMode())
    },
    {
      id: 'view.toggleTheme',
      title: 'Toggle Theme',
      category: 'View',
      keys: ['Mod-Shift-t'],
      scope: 'app',
      run: run((shell) => shell.setTheme(shell.theme() === 'dark' ? 'light' : 'dark'))
    }
  ]
}
