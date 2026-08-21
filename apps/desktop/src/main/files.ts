import { statSync } from 'node:fs'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { type BrowserWindow, dialog } from 'electron'
import type { FolderListing, OpenedFile, SaveAsRequest, WriteRequest } from '../shared/ipc.js'

const FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
  { name: 'All Files', extensions: ['*'] }
]

const MARKDOWN = /\.(?:md|markdown|mdown|mkd|txt)$/i

/**
 * Files are read and written as UTF-8 and nothing else — no line-ending
 * normalization, no BOM stripping, no trailing-newline fixups. I1 says an
 * open followed by an unmodified save must be byte-identical, and that starts
 * here.
 */
export async function readDocument(path: string): Promise<string> {
  return readFile(path, 'utf8')
}

export async function writeDocument({ path, content }: WriteRequest): Promise<boolean> {
  await writeFile(path, content, 'utf8')
  return true
}

export async function openDialog(win: BrowserWindow | null): Promise<OpenedFile[]> {
  const result = win
    ? await dialog.showOpenDialog(win, {
        properties: ['openFile', 'multiSelections'],
        filters: FILTERS
      })
    : await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: FILTERS })
  if (result.canceled) return []
  return Promise.all(
    result.filePaths.map(async (path) => ({ path, content: await readDocument(path) }))
  )
}

export async function saveAsDialog(
  win: BrowserWindow | null,
  { content, suggestedName }: SaveAsRequest
): Promise<string | null> {
  const options = { defaultPath: suggestedName, filters: FILTERS }
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  await writeFile(result.filePath, content, 'utf8')
  return result.filePath
}

export async function folderDialog(win: BrowserWindow | null): Promise<string | null> {
  const options = { properties: ['openDirectory' as const] }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  return result.canceled ? null : (result.filePaths[0] ?? null)
}

/**
 * One directory, one level deep. Markdown files and subdirectories only —
 * enough for the sidebar to be useful, narrow enough that this is not a
 * general-purpose filesystem bridge.
 */
export async function listFolder(path: string): Promise<FolderListing> {
  const items = await readdir(path, { withFileTypes: true })
  const entries = items
    .filter((item) => !item.name.startsWith('.'))
    .filter((item) => item.isDirectory() || MARKDOWN.test(item.name))
    .map((item) => ({
      path: join(path, item.name),
      name: item.name,
      directory: item.isDirectory()
    }))
    .sort((a, b) =>
      a.directory === b.directory ? a.name.localeCompare(b.name) : a.directory ? -1 : 1
    )
  return { path, entries }
}

export const displayName = (path: string): string => basename(path)

/**
 * The files named on a command line — `unmark notes.md`, or a double-clicked
 * `.md` from the file manager.
 *
 * `skip` is how many leading entries are the runtime rather than arguments: a
 * packaged app is invoked as `unmark <args>`, but in development Electron is
 * invoked as `electron . <args>`, so the project path is an argument too.
 * Switches are dropped, and so is anything that is not a readable file — a
 * relaunch can carry flags we know nothing about.
 */
export function filesFromArgv(argv: readonly string[], skip: number): string[] {
  const out: string[] = []
  for (const arg of argv.slice(skip)) {
    if (arg.startsWith('-')) continue
    try {
      if (!statSync(arg).isFile()) continue
    } catch {
      continue
    }
    out.push(resolve(arg))
  }
  return out
}
