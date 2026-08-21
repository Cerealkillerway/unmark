# Contributing

## Getting set up

**Requirements:** Node 20 or newer and pnpm 11 — `corepack enable` picks up the
version pinned in `packageManager`.

```bash
pnpm install
pnpm sandbox:fix   # Linux only, once — see below
pnpm dev           # builds the packages, then runs the desktop app
pnpm test
```

`pnpm dev` starts electron-vite: the renderer gets a Vite dev server with hot
reload, and the Electron window opens against it. Renderer edits appear
immediately; `src/main` and `src/preload` edits restart Electron.

Keep `pnpm dev:libs` running in a second terminal while you work under
`packages/` — the app resolves `@md/core` to its **built** output, so library
edits are invisible to a running dev server without it.

`pnpm dev` goes through `apps/desktop/scripts/dev.mjs`, which handles two
environment papercuts before handing off to electron-vite:

* **The sandbox.** npm and pnpm unpack `chrome-sandbox` without its setuid
  bit, and Ubuntu 23.10+ blocks unprivileged user namespaces through AppArmor,
  so on a stock Ubuntu Chromium has neither mechanism available and refuses to
  start. The script tries the namespace route, and if Chromium reports "No
  usable sandbox" it points at `pnpm sandbox:fix`, which sets root ownership
  and mode 4755 on the helper. It never passes `--no-sandbox`, which would turn
  the renderer sandbox off entirely.

  Do not try to probe for namespace support: `unshare --user true` succeeds
  even where userns is blocked, because `unshare` has an AppArmor profile that
  permits it. The check reports "fine" on exactly the systems that are not.
* **`ELECTRON_RUN_AS_NODE`.** A terminal inside another Electron process leaks
  it, and Electron then boots as plain Node with no `app` object. The script
  strips it from the child environment.

`pnpm dev:raw` skips all of that if you want electron-vite unmediated.

## The six rules

These are architectural invariants, not style preferences. **If a change
requires breaking one, stop and open an issue rather than working around it** —
the workaround is almost always worse than the feature.

**I1 — The document is the markdown string.** `EditorState.doc` holds the raw
markdown, byte for byte as it exists on disk. No intermediate model, no
serialisation step; rendering happens through decorations and nothing else.
Open and save with no edit must be byte-identical, line endings and BOM
included. `test/byte-identity.test.ts` guards this and runs on every commit.

**I2 — `@md/core` has no framework, no Node, no Electron, no Tailwind.** Its
only dependencies are `@codemirror/*` and `@lezer/*`. This is enforced by an
ESLint rule, not by convention. When core needs something outside that
namespace — a HTML-to-markdown converter, a way to resolve an image path — it
takes an *option* and the shell supplies the implementation.

**I3 — The editor component is uncontrolled.** The `EditorView` is created once
and destroyed on unmount. It is never re-created on a prop change, and there is
no `value` prop. External changes arrive through `view.dispatch()`.

**I4 — Every user-invocable action is a registered command.** Keys, menus,
palette and buttons all read one registry. No exceptions — a shortcut that
exists only in a keymap will drift from the menu that claims to show it.

**I5 — Styling is CSS custom properties and CodeMirror themes.** No Tailwind
anywhere. Consumers never write a `.cm-*` selector; if theming something
requires one, the contract in `packages/core/src/theme/core.css` has a hole and
that is the bug to fix.

**I6 — Never mutate the DOM during IME composition.** Check `view.composing`
first. Getting this wrong drops or duplicates characters for anyone typing CJK,
and it is invisible in testing unless you look for it.

## Before you debug something that "should work"

Nine failure modes account for most of the surprises here:

1. **Two copies of `@codemirror/state`.** Cryptic runtime errors about state
   instances. Every `@codemirror/*` package is a peer dependency for this
   reason; the desktop app also dedupes them in its Vite config.
2. **A controlled editor.** The caret jumps to the end while typing. See I3.
3. **A missing `Prec.high`.** A binding silently does the default action
   instead, because the base keymap sits at equal precedence and wins.
4. **A menu accelerator stealing the key.** The shortcut works from the menu
   but not from the keyboard. Editor-scoped commands must set
   `registerAccelerator: false`.
5. **`RangeSetBuilder` add out of order.** An exception on some documents only.
   Sort before building.
6. **IME composition.** See I6.
7. **String-matching `toggleWrap`.** Produces `****text****`. Use the tree.
8. **Whole-document tree walks.** Typing lag in large files. Iterate
   `view.visibleRanges`.
9. **Hidden fence markers.** Users cannot change a code block's language.
   Fences, front matter and setext underlines are deliberate exceptions to the
   reveal rule.

## Tests

- **Byte identity** is the important one. Every fixture in
  `packages/core/test/fixtures/` is loaded, read back, and compared as bytes.
- **Decorations** are tested as the pure function
  `(doc, selection) → decoration ranges`, separately from any view. jsdom has no
  layout, so view-level tests are kept to a minimum and state-level assertions
  are preferred.
- **Transforms** are tested against nested markers, adjacent markers, empty
  selections, multi-cursor, and idempotency.
- Test helpers mark the caret with `‸` and selections with `«»`. Not `|`, `[`
  or `]` — those are real markdown syntax and silently corrupt fixtures
  containing tables, links or task items.

## Commits

Each change should leave the tree with tests, typecheck, lint and build all
passing:

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build:all
```

Write the commit message for whoever hits the same problem in a year: what
changed, and why the obvious alternative was wrong.

## Releasing

`@md/core` and `@md/react` are versioned with changesets.

```bash
pnpm changeset          # describe the change and pick the bump
pnpm version-packages   # apply it
pnpm release            # build and publish
```

Desktop installers:

```bash
pnpm --filter unmark-desktop dist          # the current platform
pnpm --filter unmark-desktop dist:linux    # or mac / win
```
