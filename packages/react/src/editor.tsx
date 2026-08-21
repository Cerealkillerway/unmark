import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { Extension } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { createEditor, serializeDocument, type MarkdownSetupOptions } from '@md/core'

export interface MarkdownEditorHandle {
  /** The live view, or null before mount and after unmount. */
  readonly view: EditorView | null
  /** The document as it would be written to disk, line endings included. */
  getValue(): string
  /** Replace the document through a transaction — never by rebuilding (I3). */
  setValue(doc: string): void
  focus(): void
}

export interface MarkdownEditorProps extends MarkdownSetupOptions {
  /**
   * The initial document. Read **once**, at mount.
   *
   * I3: this component is uncontrolled. There is no `value` prop, and changing
   * `defaultValue` later does nothing — a controlled editor would rebuild the
   * view on every keystroke and destroy the caret, the undo history and the
   * IME composition state. Push later changes through the handle's `setValue`
   * or `view.dispatch()`.
   */
  defaultValue?: string
  /** Called after every document change, with the serialized document. */
  onChange?: (doc: string, view: EditorView) => void
  /** Extensions appended after the core bundle. Read once, at mount. */
  extensions?: Extension[]
  className?: string
  autoFocus?: boolean
}

/**
 * The React binding for `@md/core`.
 *
 * The view is created in an effect with an empty dependency list and destroyed
 * on unmount. Nothing a parent re-render can change will re-create it.
 */
export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(props, ref) {
    const host = useRef<HTMLDivElement>(null)
    const view = useRef<EditorView | null>(null)

    // Props are read through a ref so the effect below never needs them as
    // dependencies. `onChange` in particular is usually a fresh closure on
    // every render; depending on it would rebuild the editor constantly.
    const latest = useRef(props)
    latest.current = props

    useEffect(() => {
      const parent = host.current
      if (!parent) return

      // className and onChange are pulled out here so `setup` is exactly the
      // MarkdownSetupOptions the core factory understands.
      const {
        defaultValue = '',
        extensions = [],
        autoFocus,
        className,
        onChange,
        ...setup
      } = latest.current

      const instance = createEditor({
        ...setup,
        parent,
        doc: defaultValue,
        extensions,
        onChange: (doc, v) => latest.current.onChange?.(doc, v)
      })
      view.current = instance
      if (autoFocus) instance.focus()

      return () => {
        instance.destroy()
        view.current = null
      }
      // Intentionally empty (I3). See the note on `defaultValue`: nothing a
      // parent re-render can change belongs in here.
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        get view() {
          return view.current
        },
        getValue: () => (view.current ? serializeDocument(view.current.state) : ''),
        setValue: (doc: string) => {
          const v = view.current
          if (!v) return
          // I6: never touch the document mid-composition.
          if (v.composing) return
          v.dispatch({
            changes: { from: 0, to: v.state.doc.length, insert: doc },
            userEvent: 'set'
          })
        },
        focus: () => view.current?.focus()
      }),
      []
    )

    return <div ref={host} className={props.className} />
  }
)
