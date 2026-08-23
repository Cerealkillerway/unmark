import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Where the window icon lives, which is not the same place twice.
 *
 * `build/icon.png` is electron-builder's `buildResources`: it is read to make
 * the installers and is *not* placed inside the packaged app. So the packaged
 * app finds it where `extraResources` puts it, next to the app's resources,
 * and a dev run finds it in the source tree — `__dirname` is `out/main` under
 * both electron-vite dev and build, so the relative walk is the same either
 * way.
 *
 * @returns undefined when the file is not there, so the caller can leave the
 * option off entirely rather than hand Electron a path that does not resolve.
 */
export function resolveIconPath(
  packaged: boolean,
  mainDir: string,
  resourcesPath: string
): string | undefined {
  const candidate = packaged
    ? join(resourcesPath, 'icon.png')
    : join(mainDir, '..', '..', 'build', 'icon.png')
  return existsSync(candidate) ? candidate : undefined
}
