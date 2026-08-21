import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts({ include: ['src'], insertTypesEntry: true })],
  build: {
    target: 'es2022',
    sourcemap: true,
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      external: (id) =>
        /^@codemirror\//.test(id) ||
        /^@lezer\//.test(id) ||
        id === 'react' ||
        id === 'react/jsx-runtime' ||
        id === '@md/core'
    }
  }
})
