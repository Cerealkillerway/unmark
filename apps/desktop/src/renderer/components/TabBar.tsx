import type { DocMeta } from '../state/store.js'

export interface TabBarProps {
  docs: readonly DocMeta[]
  activeId: string | null
  paletteHint: string
  focusMode: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onPalette: () => void
  onFocus: () => void
}

export function TabBar({
  docs,
  activeId,
  paletteHint,
  focusMode,
  onSelect,
  onClose,
  onPalette,
  onFocus
}: TabBarProps): React.ReactElement {
  return (
    <div className="tabbar">
      <div className="tabs" role="tablist">
        {docs.map((doc) => (
          <div
            key={doc.id}
            role="tab"
            tabIndex={0}
            aria-selected={doc.id === activeId}
            className={`tab${doc.id === activeId ? ' is-active' : ''}`}
            onClick={() => onSelect(doc.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onSelect(doc.id)
            }}
            title={doc.path ?? doc.name}
          >
            <span className="tab-name">{doc.name}</span>
            {doc.dirty ? <span className="tab-dot" aria-label="Unsaved changes" /> : null}
            <button
              type="button"
              className="tab-close"
              aria-label={`Close ${doc.name}`}
              onClick={(event) => {
                event.stopPropagation()
                onClose(doc.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="tabbar-actions">
        <button type="button" className="chip" onClick={onPalette}>
          {paletteHint}
        </button>
        <button
          type="button"
          className={`chip${focusMode ? ' is-active' : ''}`}
          onClick={onFocus}
          aria-pressed={focusMode}
        >
          Focus
        </button>
      </div>
    </div>
  )
}
