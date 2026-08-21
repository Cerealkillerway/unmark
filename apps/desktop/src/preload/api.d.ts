import type { DesktopApi } from './index.js'

declare global {
  interface Window {
    readonly api: DesktopApi
  }
}

export {}
