import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'
import { toAccelerator, type CommandDescriptor } from '@md/core'
import { filterCommands } from '../state/palette.js'

export interface CommandPaletteProps {
  open: boolean
  commands: readonly CommandDescriptor[]
  onOpenChange: (open: boolean) => void
  onRun: (id: string) => void
}

export function CommandPalette({
  open,
  commands,
  onOpenChange,
  onRun
}: CommandPaletteProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
  }, [open])

  const matches = useMemo(() => filterCommands(commands, query), [commands, query])

  const clamped = Math.min(cursor, Math.max(0, matches.length - 1))

  const choose = (command: CommandDescriptor | undefined): void => {
    if (!command || !command.enabled) return
    onOpenChange(false)
    onRun(command.id)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="palette-backdrop" />
        <Dialog.Popup className="palette" initialFocus={input} aria-label="Command palette">
          <input
            ref={input}
            className="palette-input"
            value={query}
            placeholder="Run a command…"
            spellCheck={false}
            onChange={(event) => {
              setQuery(event.target.value)
              setCursor(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setCursor((value) => Math.min(value + 1, matches.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setCursor((value) => Math.max(value - 1, 0))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                choose(matches[clamped])
              }
            }}
          />
          <div className="palette-list" role="listbox">
            {matches.length === 0 ? <p className="palette-empty">No matching command.</p> : null}
            {matches.map((command, index) => (
              <button
                key={command.id}
                type="button"
                role="option"
                aria-selected={index === clamped}
                disabled={!command.enabled}
                className={`palette-item${index === clamped ? ' is-cursor' : ''}`}
                onMouseMove={() => setCursor(index)}
                onClick={() => choose(command)}
              >
                <span className="palette-label">
                  {command.category ? (
                    <span className="palette-category">{command.category}</span>
                  ) : null}
                  {command.title}
                </span>
                {command.keys?.[0] ? (
                  <kbd className="palette-key">{toAccelerator(command.keys[0])}</kbd>
                ) : null}
              </button>
            ))}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
