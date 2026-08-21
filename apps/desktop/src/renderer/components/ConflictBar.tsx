export interface ConflictBarProps {
  name: string
  dirty: boolean
  onReload: () => void
  onKeepMine: () => void
}

/**
 * The external-change prompt. It never resolves the conflict on its own: if
 * the buffer is dirty, discarding the user's edits silently would be the worst
 * possible default.
 */
export function ConflictBar({
  name,
  dirty,
  onReload,
  onKeepMine
}: ConflictBarProps): React.ReactElement {
  return (
    <div className="conflict" role="alert">
      <span>
        <strong>{name}</strong> changed on disk
        {dirty ? ' — you also have unsaved edits' : ''}.
      </span>
      <div className="conflict-actions">
        <button type="button" onClick={onReload}>
          Reload from disk
        </button>
        <button type="button" onClick={onKeepMine}>
          Keep mine
        </button>
      </div>
    </div>
  )
}
