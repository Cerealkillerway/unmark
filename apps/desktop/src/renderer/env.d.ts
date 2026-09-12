/// <reference types="vite/client" />

/**
 * The app version, substituted at build time from `package.json` (see
 * `electron.vite.config.ts`). A constant rather than something fetched, so the
 * title bar never renders a frame without it.
 */
declare const __APP_VERSION__: string
