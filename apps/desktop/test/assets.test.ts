import { describe, expect, it } from 'vitest'
import { assetPathFrom } from '../src/main/assets.js'
import { assetUrl, resolveImageSrc, resolveRelative } from '../src/renderer/state/assets.js'

describe('resolveRelative', () => {
  const doc = '/home/me/notes/post.md'

  it('resolves a sibling', () => {
    expect(resolveRelative(doc, 'pic.png')).toBe('/home/me/notes/pic.png')
    expect(resolveRelative(doc, './pic.png')).toBe('/home/me/notes/pic.png')
  })

  it('walks up', () => {
    expect(resolveRelative(doc, '../assets/pic.png')).toBe('/home/me/assets/pic.png')
    expect(resolveRelative(doc, '../../pic.png')).toBe('/home/pic.png')
  })

  it('leaves an absolute path alone', () => {
    expect(resolveRelative(doc, '/srv/pic.png')).toBe('/srv/pic.png')
    expect(resolveRelative('C:\\notes\\post.md', 'C:\\pics\\a.png')).toBe('C:\\pics\\a.png')
  })

  it('keeps Windows separators', () => {
    expect(resolveRelative('C:\\notes\\post.md', 'pics\\a.png')).toBe('C:\\notes\\pics\\a.png')
  })
})

describe('resolveImageSrc', () => {
  const doc = '/home/me/notes/post.md'

  it('routes a local file through the asset scheme', () => {
    expect(resolveImageSrc(doc, 'pic.png')).toBe('unmark-asset://local/home/me/notes/pic.png')
  })

  it('passes a data URI straight through', () => {
    expect(resolveImageSrc(doc, 'data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA')
  })

  /**
   * A tracking pixel in a document you merely opened would report your IP to
   * whoever wrote it. Remote images stay as text.
   */
  it('declines remote images', () => {
    expect(resolveImageSrc(doc, 'https://tracker.test/p.gif')).toBeNull()
    expect(resolveImageSrc(doc, 'http://tracker.test/p.gif')).toBeNull()
  })

  it('declines when the document has never been saved, so there is no base', () => {
    expect(resolveImageSrc(null, 'pic.png')).toBeNull()
  })

  it('escapes a path with spaces into a usable URL', () => {
    expect(resolveImageSrc('/home/me/my notes/post.md', 'a pic.png')).toBe(
      'unmark-asset://local/home/me/my%20notes/a%20pic.png'
    )
  })
})

describe('the asset scheme round-trips a path', () => {
  for (const path of [
    '/home/me/pic.png',
    '/home/me/my notes/a pic.png',
    '/home/me/café/naïve.png',
    'C:/pics/a.png'
  ]) {
    it(`survives ${path}`, () => {
      expect(assetPathFrom(assetUrl(path))).toBe(path)
    })
  }

  it('refuses a url it cannot parse or that hides a NUL', () => {
    expect(assetPathFrom('not a url')).toBeNull()
    expect(assetPathFrom('unmark-asset://local/a%00b')).toBeNull()
  })
})
