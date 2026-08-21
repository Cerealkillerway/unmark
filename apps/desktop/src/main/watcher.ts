import { watch, type FSWatcher } from 'chokidar'
import type { WebContents } from 'electron'
import { IPC } from '../shared/ipc.js'

/**
 * Watches the files the renderer has open and reports changes made by other
 * programs.
 *
 * Reference-counted per path, because two tabs can hold the same file. A
 * watcher is torn down only when the last claim on it goes away.
 */
export class DocumentWatcher {
  readonly #watchers = new Map<string, { watcher: FSWatcher; claims: number }>()
  readonly #sender: WebContents

  constructor(sender: WebContents) {
    this.#sender = sender
  }

  watch(path: string): void {
    const existing = this.#watchers.get(path)
    if (existing) {
      existing.claims++
      return
    }

    const watcher = watch(path, {
      // The renderer's own save must not come back as an external change; the
      // renderer filters on content, but a settle window avoids the round trip
      // for the common case.
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
      ignoreInitial: true
    })
    const notify = (): void => {
      if (!this.#sender.isDestroyed()) this.#sender.send(IPC.fileChangedOnDisk, path)
    }
    watcher.on('change', notify)
    watcher.on('unlink', notify)
    this.#watchers.set(path, { watcher, claims: 1 })
  }

  unwatch(path: string): void {
    const existing = this.#watchers.get(path)
    if (!existing) return
    existing.claims--
    if (existing.claims > 0) return
    this.#watchers.delete(path)
    void existing.watcher.close()
  }

  dispose(): void {
    for (const { watcher } of this.#watchers.values()) void watcher.close()
    this.#watchers.clear()
  }
}
