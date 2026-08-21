export type ThemeName = 'light' | 'dark'

const KEY = 'unmark.theme'

export function loadTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Private mode, blocked storage — fall through to the system preference.
  }
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function saveTheme(theme: ThemeName): void {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Not worth failing a theme toggle over.
  }
}
