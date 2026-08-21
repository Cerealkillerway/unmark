---
'@md/core': minor
'@md/react': minor
---

First release.

`@md/core` is inline-WYSIWYG markdown editing for CodeMirror 6: the document is
the markdown string, and syntax renders and folds away as the caret moves.
Inline and block decorations, a command registry with tree-aware format
transforms, a dual-format clipboard, collapsing links with Mod-click, image
previews, and a theming contract that restyles the whole editor from custom
properties without a single `.cm-*` selector.

`@md/react` is the React binding: an uncontrolled `<MarkdownEditor />` with an
imperative handle.
