import { EditorSelection, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdownToHtml } from './html.js'

/**
 * Dual-format clipboard (§4.6).
 *
 * Copy writes both flavours: `text/plain` is the markdown exactly as it sits
 * in the document (I1 — there is nothing else it could be), and `text/html`
 * is the rendered form, so pasting into an email keeps the formatting.
 *
 * Paste reads `text/html` only when it did not come from us. Our own HTML is
 * marked with a sentinel attribute so an internal copy-paste takes the plain
 * text path and round-trips byte for byte, instead of going markdown → HTML →
 * markdown and coming back subtly different.
 */

export const CLIPBOARD_SENTINEL = 'data-unmark'

export interface ClipboardOptions {
  /**
   * Converts foreign HTML to markdown. Optional: `@md/core` may not carry a
   * converter (I2 — Turndown is not a `@codemirror/*` or `@lezer/*` package),
   * so the shell supplies one. Without it, an HTML paste falls through to the
   * plain-text flavour, which is always present.
   */
  htmlToMarkdown?: (html: string) => string
}

/** Cheap and sufficient: the sentinel cannot occur by accident in foreign HTML. */
export const isOwnHtml = (html: string): boolean => html.includes(CLIPBOARD_SENTINEL)

export function wrapWithSentinel(html: string, block: boolean): string {
  const tag = block ? 'div' : 'span'
  return `<${tag} ${CLIPBOARD_SENTINEL}="1">${html}</${tag}>`
}

/** The selected markdown, ranges joined by blank lines as CodeMirror does. */
function selectedText(view: EditorView): string {
  const { state } = view
  return state.selection.ranges
    .filter((range) => !range.empty)
    .map((range) => state.sliceDoc(range.from, range.to))
    .join(state.lineBreak)
}

function writeClipboard(view: EditorView, event: ClipboardEvent): boolean {
  const text = selectedText(view)
  if (!text || !event.clipboardData) return false
  const { html, block } = markdownToHtml(text)
  event.clipboardData.setData('text/plain', text)
  event.clipboardData.setData('text/html', wrapWithSentinel(html, block))
  event.preventDefault()
  return true
}

export function markdownClipboard(options: ClipboardOptions = {}): Extension {
  return EditorView.domEventHandlers({
    copy(event, view) {
      // An empty selection is CodeMirror's linewise copy. Leave it alone
      // rather than reimplementing that behaviour badly.
      if (view.state.selection.ranges.every((range) => range.empty)) return false
      return writeClipboard(view, event)
    },

    cut(event, view) {
      if (view.state.selection.ranges.every((range) => range.empty)) return false
      if (!writeClipboard(view, event)) return false
      view.dispatch(
        view.state.changeByRange((range) => ({
          changes: { from: range.from, to: range.to },
          range: EditorSelection.cursor(range.from)
        })),
        { userEvent: 'delete.cut' }
      )
      return true
    },

    paste(event, view) {
      // I6: never rewrite the document mid-composition.
      if (view.composing) return false
      const data = event.clipboardData
      if (!data) return false

      const html = data.getData('text/html')
      // No HTML, our own HTML, or no converter — the plain text flavour is
      // already the markdown we want. Let CodeMirror insert it verbatim.
      if (!html || isOwnHtml(html) || !options.htmlToMarkdown) return false

      const markdown = options.htmlToMarkdown(html)
      if (!markdown) return false

      event.preventDefault()
      view.dispatch(
        view.state.replaceSelection(markdown),
        { scrollIntoView: true, userEvent: 'input.paste' }
      )
      return true
    }
  })
}

export { markdownToHtml } from './html.js'
export type { MarkdownHtmlResult } from './html.js'
