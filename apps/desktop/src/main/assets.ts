import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'

/**
 * A scheme for showing local images inside the editor.
 *
 * Neither of the obvious routes works: a browser will not load `file://`
 * subresources from an `http://localhost` page (which is what the dev server
 * serves), and relaxing the CSP to allow `https:` would let a document the
 * user merely *opened* phone home through a tracking pixel.
 *
 * So the renderer asks for `unmark-asset://local/<absolute path>` and this
 * hands back the file — a read-only, image-only door, and the only thing on
 * the far side of it is our own renderer.
 */
export const ASSET_SCHEME = 'unmark-asset'

/** Must run before `app.whenReady()`. */
export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: false }
    }
  ])
}

export function assetPathFrom(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  let path = decodeURIComponent(parsed.pathname)
  // `unmark-asset://local/C:/pics/a.png` — drop the slash the URL form adds.
  if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1)
  if (!path || path.includes('\0')) return null
  return path
}

export function handleAssetRequests(): void {
  void protocol.handle(ASSET_SCHEME, async (request) => {
    const path = assetPathFrom(request.url)
    if (!path || !existsSync(path)) return new Response(null, { status: 404 })
    return net.fetch(pathToFileURL(path).toString())
  })
}
