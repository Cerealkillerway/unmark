import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc.js'
import type {
  FolderListing,
  MenuCommand,
  OpenedFile,
  SaveAsRequest,
  WriteRequest
} from '../shared/ipc.js'

/**
 * The whole bridge, §4.8.
 *
 * One named method per channel. There is no `invoke(channel, ...args)` here on
 * purpose: a generic escape hatch turns a reviewed, enumerable surface into an
 * unreviewable one, and every future caller would reach for it.
 */
const api = {
  platform: process.platform,

  openDialog: (): Promise<OpenedFile[]> => ipcRenderer.invoke(IPC.fileOpenDialog),
  read: (path: string): Promise<string> => ipcRenderer.invoke(IPC.fileRead, path),
  write: (request: WriteRequest): Promise<boolean> => ipcRenderer.invoke(IPC.fileWrite, request),
  saveAsDialog: (request: SaveAsRequest): Promise<string | null> =>
    ipcRenderer.invoke(IPC.fileSaveAsDialog, request),

  watch: (path: string): Promise<void> => ipcRenderer.invoke(IPC.fileWatch, path),
  unwatch: (path: string): Promise<void> => ipcRenderer.invoke(IPC.fileUnwatch, path),

  /** Files named on the command line before this window existed. Drains the queue. */
  pendingOpens: (): Promise<string[]> => ipcRenderer.invoke(IPC.filePendingOpens),

  openFolderDialog: (): Promise<string | null> => ipcRenderer.invoke(IPC.folderOpenDialog),
  listFolder: (path: string): Promise<FolderListing> => ipcRenderer.invoke(IPC.folderList, path),

  describeCommands: (commands: MenuCommand[]): Promise<void> =>
    ipcRenderer.invoke(IPC.commandsDescribe, commands),

  /** @returns an unsubscribe function. */
  onFileChanged: (handler: (path: string) => void): (() => void) => {
    const listener = (_event: unknown, path: string): void => handler(path)
    ipcRenderer.on(IPC.fileChangedOnDisk, listener)
    return () => ipcRenderer.off(IPC.fileChangedOnDisk, listener)
  },

  /** @returns an unsubscribe function. */
  onOpenRequested: (handler: (paths: string[]) => void): (() => void) => {
    const listener = (_event: unknown, paths: string[]): void => handler(paths)
    ipcRenderer.on(IPC.fileOpenRequested, listener)
    return () => ipcRenderer.off(IPC.fileOpenRequested, listener)
  },

  /** @returns an unsubscribe function. */
  onCommand: (handler: (id: string) => void): (() => void) => {
    const listener = (_event: unknown, id: string): void => handler(id)
    ipcRenderer.on(IPC.commandRun, listener)
    return () => ipcRenderer.off(IPC.commandRun, listener)
  }
}

export type DesktopApi = typeof api

contextBridge.exposeInMainWorld('api', api)
