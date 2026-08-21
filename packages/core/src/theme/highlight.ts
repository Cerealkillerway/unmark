import { HighlightStyle } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/**
 * Highlighting for code *inside* fenced blocks (§4.5). Because
 * `markdown({ codeLanguages })` parses fenced content with the nested
 * language's own Lezer parser, those tokens arrive as real syntax nodes and
 * are coloured here — no Prism, no highlight.js, no HTML strings.
 *
 * All colours resolve through the custom-property contract, so a consumer
 * retheming the editor retheme the code blocks with it.
 */
export const markdownHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--md-hl-keyword, oklch(0.52 0.15 300))' },
  { tag: [t.controlKeyword, t.moduleKeyword], color: 'var(--md-hl-keyword, oklch(0.52 0.15 300))' },
  {
    tag: [t.name, t.deleted, t.character, t.macroName],
    color: 'var(--md-hl-name, var(--md-color-code))'
  },
  { tag: [t.propertyName], color: 'var(--md-hl-property, oklch(0.5 0.12 250))' },
  {
    tag: [t.function(t.variableName), t.labelName],
    color: 'var(--md-hl-function, oklch(0.52 0.13 255))'
  },
  {
    tag: [t.color, t.constant(t.name), t.standard(t.name)],
    color: 'var(--md-hl-constant, oklch(0.55 0.14 40))'
  },
  { tag: [t.definition(t.name), t.separator], color: 'var(--md-hl-name, var(--md-color-code))' },
  {
    tag: [t.typeName, t.className, t.namespace, t.changed, t.annotation, t.self],
    color: 'var(--md-hl-type, oklch(0.55 0.11 200))'
  },
  {
    tag: [t.number, t.bool, t.null, t.atom],
    color: 'var(--md-hl-number, oklch(0.55 0.14 40))'
  },
  {
    tag: [t.operator, t.operatorKeyword, t.escape, t.regexp, t.special(t.string)],
    color: 'var(--md-hl-operator, oklch(0.5 0.1 30))'
  },
  { tag: [t.meta, t.comment], color: 'var(--md-hl-comment, var(--md-color-muted))', fontStyle: 'italic' },
  { tag: [t.string, t.processingInstruction, t.inserted], color: 'var(--md-hl-string, oklch(0.5 0.11 150))' },
  { tag: t.invalid, color: 'var(--md-hl-invalid, oklch(0.55 0.2 25))' },
  { tag: t.link, color: 'var(--md-color-link)' },
  { tag: t.strong, fontWeight: '600' },
  { tag: t.emphasis, fontStyle: 'italic' }
])
