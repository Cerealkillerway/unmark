<div align="center">

<img src="docs/logo.svg" width="72" height="72" alt="">

# unmark

**A markdown editor with no modes.**

Typing the final `*` of `**test**` makes the word bold and the asterisks
disappear. Move the caret back in and they come home. There is no source view,
no preview pane, and no button that switches between them.

</div>

---

## What this is

Two things, from one repository:

| | |
|---|---|
| **`@md/core`** | A framework-agnostic CodeMirror 6 library. Drop it into any web app. |
| **unmark** | An Electron desktop editor built on it. |

**The document is the markdown string.** Not a rich-text model that serialises
to markdown — the actual text, byte for byte as it sits on disk. Rendering is
decorations layered over it. Open a file, save it untouched, and the bytes are
identical: no line-ending normalisation, no BOM stripping, no trailing-newline
fixups. There is a test for exactly that, and it runs on every commit.

### Links and images

A link renders as its label; `](https://…)` folds away with everything else.
**Mod-click** opens it, and holding Mod underlines links so you can see what is
clickable before you commit to it. Move the caret in and the URL comes back for
editing, like any other syntax.

Images render in place when the app gives `@md/core` a way to resolve their
`src` — the library cannot know where your document lives. The desktop app
serves local files through a read-only `unmark-asset:` scheme, and **does not
fetch remote images**: a tracking pixel in a document you merely opened would
report your IP to whoever wrote it, and this app has no telemetry of its own to
make that a fair trade. Remote images stay as their alt text.

Editable inline tables are not implemented. They are their own project, not a
corner of this one.

### Not on the list

No vault, graph view, backlinks or wiki-links. No plugin ecosystem. No cloud
sync, no accounts, no telemetry. No mobile, no collaborative editing.

---

## Using `@md/core`

```bash
npm install @md/core
```

Every `@codemirror/*` and `@lezer/*` package is a **peer dependency**. Two
copies of `@codemirror/state` in one bundle breaks CodeMirror at runtime, so
the library refuses to bring its own.

```ts
import { createEditor } from '@md/core'
import '@md/core/style.css'

const view = createEditor({
  parent: document.querySelector('#editor')!,
  doc: '# Hello\n\nType **bold** and watch the asterisks fold away.',
  onChange: (markdown) => save(markdown)
})
```

`createEditor` returns a plain `EditorView`. You own it: change the document
with `view.dispatch()`, read it with `serializeDocument(view.state)` — which,
unlike `doc.toString()`, gives you back the line endings the file arrived with.

### React

```bash
npm install @md/react
```

```tsx
import { MarkdownEditor, type MarkdownEditorHandle } from '@md/react'

function Editor() {
  const editor = useRef<MarkdownEditorHandle>(null)
  return <MarkdownEditor ref={editor} defaultValue={initial} onChange={save} />
}
```

There is no `value` prop, deliberately. The component is uncontrolled: the view
is created once and destroyed on unmount, and no parent re-render can rebuild
it. A controlled editor rebuilds on every keystroke and takes the caret, the
undo history and any in-flight IME composition with it.

---

## Theming

**The whole editor restyles from one block of custom properties. You never
write a `.cm-*` selector.** That is the contract, and it is what makes the
library usable outside this app.

```css
/* A third-party app theming the editor. This is the entire integration. */
.my-app {
  /* Typography */
  --md-font-body: 'Literata', Georgia, serif;
  --md-font-mono: 'Berkeley Mono', monospace;
  --md-font-size: 18px;
  --md-line-height: 1.7;

  /* Surfaces and ink */
  --md-color-bg: #fffdf7;
  --md-color-text: #2b2723;
  --md-color-muted: #8a8177;
  --md-color-border: #e8e0d4;
  --md-color-accent: #b45309;
  --md-color-selection: #fde9c8;

  /* The characters that fold away */
  --md-color-marker: #ccc2b4;

  /* Blocks */
  --md-color-heading: #1a1613;
  --md-color-code-bg: #f6f1e7;
  --md-color-quote-border: #e8e0d4;

  /* Scale and measure */
  --md-h1-size: 1.9em;
  --md-h2-size: 1.4em;
  --md-h3-size: 1.15em;
  --md-content-width: 680px;
  --md-content-padding: 48px 32px 40vh;
}
```

Redefine them again under a `[data-theme='dark']` wrapper and you have a dark
theme. `@md/core` ships light defaults on `:root` plus a dark palette under
`prefers-color-scheme`, so it looks right before you touch anything.

The full list — including `--md-heading-weight`, `--md-heading-line-height`,
`--md-mono-size`, `--md-color-code`, `--md-color-link`, `--md-color-cursor`,
`--md-color-rule` and the `--md-hl-*` tokens for fenced-code highlighting —
lives in [`packages/core/src/theme/core.css`](packages/core/src/theme/core.css),
which is the contract itself.

---

## Development

```bash
pnpm install
pnpm dev          # build the packages, then run the desktop app
pnpm dev:libs     # rebuild packages on change — run alongside `pnpm dev`
pnpm test         # everything
pnpm typecheck
pnpm lint
```

> The app resolves `@md/core` to its **built** output, so a change under
> `packages/` is invisible to a running dev server until it is rebuilt. Keep
> `pnpm dev:libs` running in a second terminal while you work on the library.

> **Running the desktop app from inside another Electron process** (an editor's
> integrated terminal, for instance) inherits `ELECTRON_RUN_AS_NODE=1`, and
> Electron will start as plain Node and fail with `Cannot read properties of
> undefined (reading 'whenReady')`. Launch it as:
>
> ```bash
> env -u ELECTRON_RUN_AS_NODE -u ELECTRON_NO_ATTACH_CONSOLE pnpm dev
> ```

### Layout

```
packages/core     @md/core — the editor library. @codemirror/* and @lezer/* only.
packages/react    @md/react — the React binding.
apps/desktop      the Electron app: main, preload bridge, renderer.
```

---

## License

MIT
