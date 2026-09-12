import type { ThemeName } from '../state/theme.js'

const Logo = (): React.ReactElement => (
  <svg className="logo" viewBox="0 0 100 100" aria-hidden="true">
    <rect width="100" height="100" rx="22" fill="var(--logo-bg)" />
    <rect x="30" y="30" width="16" height="16" rx="4" fill="var(--accent)" />
    <rect x="54" y="30" width="16" height="16" rx="4" fill="var(--marker)" />
    <rect x="30" y="54" width="16" height="16" rx="4" fill="var(--marker)" />
  </svg>
)

export interface TitleBarProps {
  folder: string | null
  theme: ThemeName
  onTheme: (theme: ThemeName) => void
}

export function TitleBar({ folder, theme, onTheme }: TitleBarProps): React.ReactElement {
  return (
    <header className="titlebar">
      <div className="brand">
        <Logo />
        <span className="wordmark">
          <span className="wordmark-un">un</span>mark
        </span>
        {/* Baked in at build time from package.json, which version-updater
            owns — the same number the installer reports. */}
        <span className="version" title={`unmark ${__APP_VERSION__}`}>
          {__APP_VERSION__}
        </span>
      </div>
      {folder ? <span className="folder-path">{folder}</span> : null}
      <div className="theme-switch" role="group" aria-label="Theme">
        {(['light', 'dark'] as const).map((name) => (
          <button
            key={name}
            type="button"
            className={theme === name ? 'is-active' : ''}
            aria-pressed={theme === name}
            onClick={() => onTheme(name)}
          >
            {name === 'light' ? 'Light' : 'Dark'}
          </button>
        ))}
      </div>
    </header>
  )
}
