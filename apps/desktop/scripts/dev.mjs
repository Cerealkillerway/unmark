/**
 * `pnpm dev` — electron-vite, with two environment papercuts handled so the
 * documented happy path actually works.
 */
import { spawn } from 'node:child_process'
import { statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/**
 * Anything after `pnpm dev --` is forwarded to Electron by electron-vite.
 * pnpm passes the `--` through as a literal argument, so drop it — electron-vite
 * expects exactly one.
 */
const forwarded = process.argv.slice(2)
while (forwarded[0] === '--') forwarded.shift()

const dim = (text) => `\x1b[2m${text}\x1b[0m`
const bold = (text) => `\x1b[1m${text}\x1b[0m`

function sandboxHelper() {
  try {
    // `require('electron')` resolves to the binary path, not the module.
    return join(dirname(require('electron')), 'chrome-sandbox')
  } catch {
    return null
  }
}

function isSetuidRoot(path) {
  try {
    const { uid, mode } = statSync(path)
    return uid === 0 && (mode & 0o4000) !== 0
  } catch {
    return false
  }
}

/**
 * Chromium sandboxes a renderer on Linux one of two ways: unprivileged user
 * namespaces, or a small setuid helper binary. It prefers the helper when one
 * exists — and aborts if that helper is not root-owned with mode 4755, which is
 * exactly how npm and pnpm unpack it.
 *
 * `--disable-setuid-sandbox` makes it use namespaces instead. That is NOT
 * `--no-sandbox`: the renderer keeps seccomp-bpf and its own user namespace.
 *
 * Whether namespaces are actually available cannot be probed reliably from
 * here. `unshare --user` succeeds even on Ubuntu 23.10+, where AppArmor blocks
 * userns for ordinary binaries, because `unshare` itself ships with a profile
 * that permits it — so the obvious check reports "fine" on precisely the
 * systems where it is not. Rather than guess, try the namespace route and
 * explain properly if Chromium says it has nothing usable.
 */
const helper = process.platform === 'linux' ? sandboxHelper() : null
const needsNamespaces = helper !== null && !isSetuidRoot(helper)

if (needsNamespaces) {
  forwarded.unshift('--disable-setuid-sandbox')
  console.log(dim('[dev] chrome-sandbox is not setuid-root; trying the user-namespace sandbox.'))
  console.log(dim('      If this system blocks user namespaces, run: pnpm sandbox:fix'))
}

/**
 * The window icon, which on Wayland does not come from the window at all.
 *
 * `new BrowserWindow({ icon })` is an X11 and Windows mechanism. A Wayland
 * compositor takes no icon from the client: GNOME matches the surface's
 * `app_id` to a `.desktop` file and uses that file's `Icon=`. Electron derives
 * `app_id` from the executable name, and in development the executable is
 * `node_modules/.bin/electron` — so the window claims to be `electron`, no
 * `electron.desktop` exists, and GNOME falls back to the generic gear.
 *
 * `--class` sets the name Chromium reports, so the dev window resolves to the
 * installed `unmark.desktop` exactly like the packaged app. It needs unmark to
 * be installed; without that there is nothing to match and the gear is
 * correct. Harmless on X11, where it sets WM_CLASS to the same string.
 */
if (process.platform === 'linux' && !forwarded.some((arg) => arg.startsWith('--class'))) {
  forwarded.push('--class=unmark')
}

const env = { ...process.env }
/**
 * A terminal running inside another Electron process — VS Code's integrated
 * terminal, or a coding agent — exports these. Electron would boot as a plain
 * Node runtime with no `app` object and die on `app.whenReady()`. They are
 * never right for the app we are about to launch.
 */
for (const leaked of ['ELECTRON_RUN_AS_NODE', 'ELECTRON_NO_ATTACH_CONSOLE']) {
  if (env[leaked]) {
    delete env[leaked]
    console.log(dim(`[dev] cleared inherited ${leaked}.`))
  }
}

const args = ['dev']
if (forwarded.length > 0) args.push('--', ...forwarded)

const child = spawn('electron-vite', args, {
  stdio: ['inherit', 'inherit', 'pipe'],
  env,
  shell: process.platform === 'win32'
})

/**
 * Chromium's own message tells you to "live dangerously" with --no-sandbox.
 * Say what actually fixes it instead, while the error is still on screen.
 */
let sawUnusableSandbox = false
child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk)
  if (String(chunk).includes('No usable sandbox')) sawUnusableSandbox = true
})

child.on('exit', (code, signal) => {
  if (sawUnusableSandbox && helper) {
    console.error(
      '\n' +
        bold('This system blocks unprivileged user namespaces (Ubuntu 23.10+ does,') +
        '\n' +
        bold('through AppArmor), so Chromium has no sandbox available.') +
        '\n\n' +
        '  ' +
        bold('pnpm sandbox:fix') +
        '\n\n' +
        '    Gives the SUID helper the permissions it needs. One sudo prompt,\n' +
        '    one file, and it works whatever AppArmor thinks of namespaces.\n' +
        '    Re-run it after any install that re-extracts Electron.\n\n' +
        dim('  Not --no-sandbox. Chromium suggests it above; it turns the renderer\n') +
        dim('  sandbox off entirely, in an app that opens files other people wrote.\n')
    )
  }
  process.exit(signal ? 1 : (code ?? 0))
})
