/**
 * `pnpm icons` — regenerate `build/icons/` from `build/icon.png`.
 *
 * Linux installers need a *set* of sizes, not one big PNG. electron-builder
 * given a single file installs it to `hicolor/<that file's size>/apps/`, and
 * `/usr/share/icons/hicolor/index.theme` declares nothing above 512x512 — so a
 * 1024px source lands in a directory GTK's icon lookup never reads, and the
 * app shows the generic gear in the menu, the dock and the window.
 *
 * `icon.png` stays the one source: macOS wants the full 1024, Windows gets
 * `icon.ico`, and the runtime window icon is the same file through
 * `extraResources`. This only fans it out.
 *
 * The generated PNGs are committed, so building an installer needs no image
 * tooling. Run this after changing `icon.png`.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Every size below is one hicolor declares; 1024 deliberately is not. */
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512]

const buildDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'build')
const source = join(buildDir, 'icon.png')
const outDir = join(buildDir, 'icons')

const magick = (() => {
  for (const candidate of ['magick', 'convert']) {
    try {
      execFileSync(candidate, ['-version'], { stdio: 'ignore' })
      return candidate
    } catch {
      /* try the next one */
    }
  }
  return null
})()

if (!magick) {
  console.error(
    'ImageMagick is not installed, and this script is the only thing that needs it.\n' +
      '  Debian/Ubuntu:  sudo apt install imagemagick\n' +
      '  macOS:          brew install imagemagick\n\n' +
      'The generated icons are committed, so you only need this after editing build/icon.png.'
  )
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

for (const size of SIZES) {
  const out = join(outDir, `${size}x${size}.png`)
  // PNG32 keeps the alpha channel that a downscale would otherwise flatten on
  // some ImageMagick builds; -strip drops metadata that only bloats the deb.
  execFileSync(magick, [source, '-resize', `${size}x${size}`, '-strip', `PNG32:${out}`])
  console.log(`  ${size}x${size}.png`)
}

console.log(`\n${SIZES.length} icons written to build/icons/`)
