import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveIconPath } from '../src/main/icon.js'

const appRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')

describe('the window icon', () => {
  it('finds the real file from a dev run', () => {
    // `__dirname` is out/main under electron-vite, in dev and in build alike.
    const resolved = resolveIconPath(false, join(appRoot, 'out', 'main'), '/unused')
    expect(resolved).toBe(join(appRoot, 'build', 'icon.png'))
    expect(existsSync(resolved!)).toBe(true)
  })

  it('looks beside the app resources once packaged', () => {
    expect(resolveIconPath(true, '/app/out/main', appRoot)).toBeUndefined()
    // electron-builder's `extraResources` puts it here; simulate that layout.
    expect(resolveIconPath(true, '/app/out/main', join(appRoot, 'build'))).toBe(
      join(appRoot, 'build', 'icon.png')
    )
  })

  it('returns undefined rather than a path that does not resolve', () => {
    expect(resolveIconPath(false, '/nowhere/out/main', '/nowhere')).toBeUndefined()
  })
})
