/**
 * `pnpm dev` — electron-vite, with two papercuts handled so the documented
 * happy path actually works on Linux and inside embedded terminals.
 */
import { spawn, spawnSync } from 'node:child_process'
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

/** `require('electron')` resolves to the binary path, not the module. */
function sandboxHelper() {
  try {
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

/** Can this session create an unprivileged user namespace? */
function userNamespacesWork() {
  const probe = spawnSync('unshare', ['--user', 'true'], { stdio: 'ignore' })
  return probe.status === 0
}

/**
 * Chromium sandboxes renderers on Linux one of two ways: the SUID helper
 * binary, or unprivileged user namespaces. It prefers the helper when one
 * exists — and aborts outright if that helper is not root-owned with mode
 * 4755, which is exactly how npm and pnpm unpack it:
 *
 *   FATAL: The SUID sandbox helper binary was found, but is not configured
 *   correctly. Rather than run without sandboxing I'm aborting now.
 *
 * When namespaces are available, `--disable-setuid-sandbox` skips the helper
 * and uses them instead. That is NOT `--no-sandbox`: the renderer keeps
 * seccomp-bpf and its own user namespace. When they are not available there is
 * no way around it from here, so say what to run rather than pretend.
 */
if (process.platform === 'linux') {
  const helper = sandboxHelper()
  if (helper && !isSetuidRoot(helper)) {
    if (userNamespacesWork()) {
      forwarded.unshift('--disable-setuid-sandbox')
      console.log(
        dim('[dev] chrome-sandbox is not setuid-root; using the user-namespace sandbox.')
      )
      console.log(dim('      The renderer stays sandboxed (seccomp-bpf + its own userns).'))
    } else {
      console.log(
        bold('[dev] Electron will abort: chrome-sandbox is not setuid-root and this') +
          '\n' +
          bold('      system does not allow unprivileged user namespaces.') +
          '\n\n' +
          '      Fix it once (redo after every Electron reinstall):\n\n' +
          `        sudo chown root:root '${helper}'\n` +
          `        sudo chmod 4755 '${helper}'\n\n` +
          dim('      Do not reach for --no-sandbox: it turns the renderer sandbox off\n') +
          dim('      entirely, which is the thing this app relies on.\n')
      )
    }
  }
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
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32'
})
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)))
