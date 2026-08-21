/**
 * Just enough Electron for the pure parts of the main process.
 *
 * `Menu.buildFromTemplate` returns the template verbatim so tests can assert
 * on what would have been built — including `registerAccelerator`, which is
 * the whole point of §4.3's ownership rule and is invisible from a real Menu.
 */
export const app = { name: 'unmark' }

export const Menu = {
  buildFromTemplate: (template: unknown[]): unknown[] => template,
  setApplicationMenu: (): void => {}
}

export const dialog = {
  showOpenDialog: async (): Promise<{ canceled: boolean; filePaths: string[] }> => ({
    canceled: true,
    filePaths: []
  }),
  showSaveDialog: async (): Promise<{ canceled: boolean; filePath?: string }> => ({
    canceled: true
  })
}

export const BrowserWindow = class {}
export const ipcMain = { handle: (): void => {} }
export const shell = { openExternal: async (): Promise<void> => {} }
