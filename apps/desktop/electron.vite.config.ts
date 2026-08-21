import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const root = import.meta.dirname

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
    resolve: {
      alias: { '@shared': resolve(root, 'src/shared') },
      // Trap #1: exactly one copy of every CodeMirror package.
      dedupe: [
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/language',
        '@codemirror/commands',
        '@lezer/common',
        '@lezer/highlight'
      ]
    },
    build: {
      rollupOptions: { input: { index: resolve(root, 'src/renderer/index.html') } }
    }
  }
})
