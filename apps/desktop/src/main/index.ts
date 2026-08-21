import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { IPC, type MenuCommand, type SaveAsRequest, type WriteRequest } from '../shared/ipc.js'
import {
  folderDialog,
  listFolder,
  openDialog,
  readDocument,
  saveAsDialog,
  writeDocument
} from './files.js'
import { buildMenu } from './menu.js'
import { DocumentWatcher } from './watcher.js'

const watchers = new Map<number, DocumentWatcher>()

function watcherFor(win: BrowserWindow): DocumentWatcher {
  const existing = watchers.get(win.id)
  if (existing) return existing
  const watcher = new DocumentWatcher(win.webContents)
  watchers.set(win.id, watcher)
  win.once('closed', () => {
    watcher.dispose()
    watchers.delete(win.id)
  })
  return watcher
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 720,
    minHeight: 460,
    show: false,
    backgroundColor: '#14171B',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))

  return win
}

/** Every handler in §4.8's table, and nothing else. */
function registerIpc(): void {
  const senderWindow = (event: Electron.IpcMainInvokeEvent): BrowserWindow | null =>
    BrowserWindow.fromWebContents(event.sender)

  ipcMain.handle(IPC.fileOpenDialog, (event) => openDialog(senderWindow(event)))
  ipcMain.handle(IPC.fileRead, (_event, path: string) => readDocument(path))
  ipcMain.handle(IPC.fileWrite, (_event, request: WriteRequest) => writeDocument(request))
  ipcMain.handle(IPC.fileSaveAsDialog, (event, request: SaveAsRequest) =>
    saveAsDialog(senderWindow(event), request)
  )

  ipcMain.handle(IPC.fileWatch, (event, path: string) => {
    const win = senderWindow(event)
    if (win) watcherFor(win).watch(path)
  })
  ipcMain.handle(IPC.fileUnwatch, (event, path: string) => {
    const win = senderWindow(event)
    if (win) watcherFor(win).unwatch(path)
  })

  ipcMain.handle(IPC.folderOpenDialog, (event) => folderDialog(senderWindow(event)))
  ipcMain.handle(IPC.folderList, (_event, path: string) => listFolder(path))

  // The renderer owns the registry — it is the side that can hold a `run`
  // closure over an EditorView — so it pushes the serializable projection here
  // whenever the enabled set changes, and main rebuilds the menu from it.
  ipcMain.handle(IPC.commandsDescribe, (event, commands: MenuCommand[]) => {
    Menu.setApplicationMenu(buildMenu(commands, senderWindow(event)))
  })
}

void app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
