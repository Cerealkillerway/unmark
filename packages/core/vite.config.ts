import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

/**
 * Library build. Everything under @codemirror/* and @lezer/* is external — see
 * invariant I2 and trap #1: a second copy of @codemirror/state in a consumer's
 * bundle breaks CodeMirror at runtime.
 */
export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      insertTypesEntry: true
    })
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        // A zero-dependency entry point: the Electron main process needs the
        // accelerator mapping and must not pull CodeMirror in to get it.
        accelerator: resolve(import.meta.dirname, 'src/commands/accelerator.ts')
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`
    },
    rollupOptions: {
      external: (id) => /^@codemirror\//.test(id) || /^@lezer\//.test(id),
      output: {
        assetFileNames: (info) =>
          info.names?.[0]?.endsWith('.css') ? 'style.css' : '[name][extname]'
      }
    }
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts']
  }
})
