/**
 * `pnpm sandbox:fix` — give Chromium's SUID sandbox helper the permissions it
 * needs, once.
 *
 * Chromium sandboxes a renderer on Linux one of two ways: unprivileged user
 * namespaces, or a small setuid helper. Ubuntu 23.10+ restricts the first
 * through AppArmor, and npm and pnpm unpack the second without its setuid bit,
 * so on a stock Ubuntu neither is available and Electron refuses to start:
 *
 *   FATAL: No usable sandbox!
 *
 * The helper is the narrower of the two remedies. It touches one file inside
 * node_modules; the alternatives are a system-wide sysctl or a new AppArmor
 * profile. Because it lives in node_modules, this has to be re-run after any
 * install that re-extracts Electron.
 */
import { spawnSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

if (process.platform !== 'linux') {
  console.log('Nothing to do: the SUID sandbox is Linux-only.')
  process.exit(0)
}

let helper
try {
  // `require('electron')` resolves to the binary path, not the module.
  helper = join(dirname(require('electron')), 'chrome-sandbox')
  statSync(helper)
} catch {
  console.error('Could not find chrome-sandbox. Run `pnpm install` first.')
  process.exit(1)
}

const isFixed = () => {
  const { uid, mode } = statSync(helper)
  return uid === 0 && (mode & 0o4000) !== 0
}

if (isFixed()) {
  console.log(`Already correct: ${helper}`)
  process.exit(0)
}

console.log(`Setting root ownership and mode 4755 on:\n  ${helper}\n`)
console.log('sudo will ask for your password.\n')

for (const [command, ...args] of [
  ['sudo', 'chown', 'root:root', helper],
  ['sudo', 'chmod', '4755', helper]
]) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error('\nFailed. Nothing was changed by the failing step.')
    process.exit(result.status ?? 1)
  }
}

if (!isFixed()) {
  console.error('\nThe commands succeeded but the permissions did not stick.')
  console.error('A filesystem mounted `nosuid` will do that — check `findmnt --target`.')
  process.exit(1)
}

console.log('\nDone. `pnpm dev` will now use the SUID sandbox.')
console.log('Re-run this after any pnpm install that re-extracts Electron.')
