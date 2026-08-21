/**
 * Turning a markdown image `src` into something the page may load.
 *
 * Local files go through the `unmark-asset:` scheme (see `main/assets.ts`).
 * Remote images are deliberately *not* fetched: a tracking pixel in a document
 * you merely opened would report your IP to whoever wrote it, and this app has
 * no telemetry of its own to make that a fair trade. They stay as their alt
 * text until someone asks for a setting.
 */

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i

const directoryOf = (path: string): string => {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return cut < 0 ? '' : path.slice(0, cut)
}

/** Resolve `src` against the directory holding the document. */
export function resolveRelative(documentPath: string, src: string): string {
  if (src.startsWith('/') || /^[A-Za-z]:[\\/]/.test(src)) return src

  const separator = documentPath.includes('\\') ? '\\' : '/'
  const parts = directoryOf(documentPath).split(/[\\/]/)
  for (const segment of src.split(/[\\/]/)) {
    if (segment === '.' || segment === '') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return parts.join(separator)
}

export function assetUrl(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  return `unmark-asset://local${normalized.startsWith('/') ? '' : '/'}${encodeURI(normalized)}`
}

/** @returns null when the image should stay as text. */
export function resolveImageSrc(documentPath: string | null, src: string): string | null {
  if (src.startsWith('data:')) return src
  if (ABSOLUTE_URL.test(src)) return null
  if (!documentPath) return null
  return assetUrl(resolveRelative(documentPath, src))
}
