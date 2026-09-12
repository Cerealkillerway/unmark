import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const root = import.meta.dirname

/**
 * The version the title bar shows, baked in at build time.
 *
 * Read from this package's own `package.json`, which `version-updater` owns —
 * so the number beside the wordmark is the same one the installer, the `.deb`
 * and `app.getVersion()` report, and there is no way for it to drift. Going
 * through IPC instead would mean the same constant arriving a frame late.
 */
const version = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf8')
) as { version: string }

/**
 * main + preload are emitted as CommonJS (.cjs):
 *  - Electron's `electron` module has no reliable ESM named exports in main.
 *  - A preload script running with `sandbox: true` MUST be CommonJS.
 * The renderer is bundled by Vite and stays ESM.
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(root, 'src/main/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs', chunkFileNames: '[name].cjs' }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(root, 'src/preload/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs', chunkFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    root: resolve(root, 'src/renderer'),
    plugins: [react()],
    define: { __APP_VERSION__: JSON.stringify(version.version) },
    resolve: {
      alias: { '@shared': resolve(root, 'src/shared') },
      // Trap #1: exactly one copy of every CodeMirror package.
      dedupe: [
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/language',
        '@codemirror/commands',
        '@codemirror/search',
        '@lezer/common',
        '@lezer/highlight'
      ]
    },
    build: {
      rollupOptions: { input: { index: resolve(root, 'src/renderer/index.html') } }
    }
  }
})
