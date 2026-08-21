/**
 * The IPC surface, §4.8.
 *
 * Deliberately narrow. Every channel is listed here with its payload, and the
 * preload bridge exposes exactly these and nothing else — no generic
 * `invoke(channel, ...args)` escape hatch. Widening this table is a decision,
 * not a convenience.
 */

export interface OpenedFile {
  readonly path: string
  readonly content: string
}

export interface WriteRequest {
  readonly path: string
  readonly content: string
}

export interface SaveAsRequest {
  readonly content: string
  readonly suggestedName: string
}

export interface FolderEntry {
  readonly path: string
  readonly name: string
  readonly directory: boolean
}

export interface FolderListing {
  readonly path: string
  readonly entries: readonly FolderEntry[]
}

/** The serializable half of a CommandDef — §4.3's `describe()` projection. */
export interface MenuCommand {
  readonly id: string
  readonly title: string
  readonly category?: string
  readonly keys?: readonly string[]
  readonly scope: 'editor' | 'app'
  readonly enabled: boolean
}

export const IPC = {
  /** R→M */
  fileOpenDialog: 'file:openDialog',
  fileRead: 'file:read',
  fileWrite: 'file:write',
  fileSaveAsDialog: 'file:saveAsDialog',
  fileWatch: 'file:watch',
  fileUnwatch: 'file:unwatch',
  commandsDescribe: 'commands:describe',
  /**
   * Added deliberately for the folder sidebar, which §4.8's original table did
   * not cover. Two channels, both read-only, both scoped to one directory —
   * not a general filesystem bridge.
   */
  folderOpenDialog: 'folder:openDialog',
  folderList: 'folder:list',
  /**
   * Also deliberate: `unmark notes.md` and double-clicking a `.md` file both
   * arrive as argv in the main process, which has no way to hand them over
   * otherwise. The renderer drains the queue once it is mounted.
   */
  filePendingOpens: 'file:pendingOpens',

  /** M→R */
  fileChangedOnDisk: 'file:changedOnDisk',
  /** A path arriving after startup — a second launch, or macOS `open-file`. */
  fileOpenRequested: 'file:openRequested',
  commandRun: 'command:run'
} as const
