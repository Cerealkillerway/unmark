import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const root = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(root, 'src/shared'),
      // The main-process modules import `electron` at load time. Tests supply
      // a stub so the parts that are ours — the menu template, the file I/O —
      // can be exercised without a running Electron.
      electron: resolve(root, 'test/electron-stub.ts')
    }
  },
  test: {
    name: 'unmark-desktop',
    environment: 'node',
    include: ['test/**/*.test.ts']
  }
})
