import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { type EditorView, ViewPlugin } from '@codemirror/view'
import { languages } from '@codemirror/language-data'
import { MarkdownEditor, type MarkdownEditorHandle } from '@md/react'
import {
  defaultCommands,
  toAccelerator,
  type CommandContext,
  type CommandDescriptor
} from '@md/core'
import type { MenuCommand } from '@shared/ipc.js'
import { CommandPalette } from './components/CommandPalette.js'
import { ConflictBar } from './components/ConflictBar.js'
import { Outline } from './components/Outline.js'
import { Sidebar } from './components/Sidebar.js'
import { StatusBar } from './components/StatusBar.js'
import { TabBar } from './components/TabBar.js'
import { TitleBar } from './components/TitleBar.js'
import { appCommands, type Shell } from './state/app-commands.js'
import { editorSignal } from './state/signals.js'
import { DocumentStore } from './state/store.js'
import { loadTheme, saveTheme, type ThemeName } from './state/theme.js'

const PALETTE_HINT = toAccelerator('Mod-Shift-p') ?? '⌘⇧P'

export function App(): React.ReactElement {
  const store = useMemo(() => new DocumentStore(), [])
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)

  const [theme, setThemeState] = useState<ThemeName>(loadTheme)
  const [panels, setPanels] = useState({ sidebar: true, outline: true })
  const [focusMode, setFocusMode] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [activeView, setActiveView] = useState<EditorView | null>(null)

  const handles = useRef(new Map<string, MarkdownEditorHandle>())
  const views = useRef(new Map<string, EditorView>())
  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = snapshot.activeId
  const shellRef = useRef<Shell | null>(null)

  /**
   * Views announce themselves from inside CodeMirror rather than through the
   * React ref, which fires during commit — before `createEditor` has run, so
   * `handle.view` would still be null at that point.
   */
  const publishView = useCallback((id: string, view: EditorView | null) => {
    if (view) views.current.set(id, view)
    else views.current.delete(id)
    const current = activeIdRef.current
    setActiveView(current ? (views.current.get(current) ?? null) : null)
  }, [])

  const registrar = useCallback(
    (id: string) =>
      ViewPlugin.define((view) => {
        publishView(id, view)
        return {
          update: () => editorSignal.bump(),
          destroy: () => publishView(id, null)
        }
      }),
    [publishView]
  )

  const contentOf = useCallback(
    (id: string): string => handles.current.get(id)?.getValue() ?? store.content(id),
    [store]
  )

  // ---------------------------------------------------------------- actions

  const openPath = useCallback(
    async (path: string) => {
      const existing = store.byPath(path)
      if (existing) {
        store.activate(existing.id)
        return
      }
      const content = await window.api.read(path)
      store.open(path, content)
    },
    [store]
  )

  const save = useCallback(async () => {
    const doc = store.active
    if (!doc) return
    const content = contentOf(doc.id)
    if (!doc.path) {
      const path = await window.api.saveAsDialog({
        content,
        suggestedName: `${doc.name}.md`
      })
      if (path) store.markSaved(doc.id, path)
      return
    }
    await window.api.write({ path: doc.path, content })
    store.markSaved(doc.id)
  }, [contentOf, store])

  const shell: Shell = useMemo(
    () => ({
      store,
      newDocument: () => store.create(),
      openFiles: async () => {
        const files = await window.api.openDialog()
        for (const file of files) store.open(file.path, file.content)
      },
      openFolder: async () => {
        const folder = await window.api.openFolderDialog()
        if (folder) store.setFolder(folder)
      },
      openPath: (path) => openPath(path),
      save,
      saveAs: async () => {
        const doc = store.active
        if (!doc) return
        const path = await window.api.saveAsDialog({
          content: contentOf(doc.id),
          suggestedName: doc.path ?? `${doc.name}.md`
        })
        if (path) store.markSaved(doc.id, path)
      },
      closeActive: () => {
        const doc = store.active
        if (doc) store.close(doc.id)
      },
      step: (delta) => store.step(delta),
      togglePalette: () => setPaletteOpen((value) => !value),
      togglePanel: (panel) => setPanels((value) => ({ ...value, [panel]: !value[panel] })),
      toggleFocusMode: () => setFocusMode((value) => !value),
      setTheme: (next) => setThemeState(next),
      theme: () => shellRef.current?.theme() ?? theme
    }),
    [contentOf, openPath, save, store, theme]
  )

  // `theme()` must report the *current* value, not the one captured when the
  // shell object was built.
  const themeRef = useRef(theme)
  themeRef.current = theme
  shellRef.current = { ...shell, theme: () => themeRef.current }

  // -------------------------------------------------------------- registry

  const registry = useMemo(() => {
    const created = defaultCommands()
    created.register(...appCommands())
    return created
  }, [])

  const context = useMemo(
    (): CommandContext => ({ view: activeView, app: { shell: shellRef.current } }),
    [activeView]
  )
  const contextRef = useRef(context)
  contextRef.current = context

  const descriptors: CommandDescriptor[] = useMemo(
    () => registry.describe(context),
    // The enabled set depends on the active document and the focused view.
    [registry, context, snapshot]
  )

  // The menu is rebuilt from exactly what the palette shows (I4).
  useEffect(() => {
    void window.api.describeCommands(descriptors as MenuCommand[])
  }, [descriptors])

  useEffect(
    () => window.api.onCommand((id) => registry.run(id, contextRef.current)),
    [registry]
  )

  // ---------------------------------------------------------------- effects

  // A hook for driving the real app from a debugger in development. Stripped
  // from production builds, so it is not part of the shipped surface.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    Object.assign(window, { __unmark: { store, registry, handles: handles.current } })
  }, [registry, store])

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme
    saveTheme(theme)
  }, [theme])

  useEffect(() => {
    // Read through the store, not the captured snapshot: StrictMode runs this
    // effect twice against the same render and a stale count creates a second
    // empty document.
    if (store.count === 0) store.create()
  }, [snapshot.docs.length, store])

  useEffect(() => {
    const id = snapshot.activeId
    setActiveView(id ? (views.current.get(id) ?? null) : null)
  }, [snapshot.activeId, snapshot.docs])

  // One watcher claim per open path, released when the tab closes.
  const watched = useRef(new Set<string>())
  useEffect(() => {
    const wanted = new Set(
      snapshot.docs.map((doc) => doc.path).filter((path): path is string => Boolean(path))
    )
    for (const path of wanted) {
      if (!watched.current.has(path)) {
        watched.current.add(path)
        void window.api.watch(path)
      }
    }
    for (const path of [...watched.current]) {
      if (!wanted.has(path)) {
        watched.current.delete(path)
        void window.api.unwatch(path)
      }
    }
  }, [snapshot.docs])

  useEffect(
    () =>
      window.api.onFileChanged((path) => {
        const doc = store.byPath(path)
        if (!doc) return
        // Our own save comes back through the watcher too. Compare against the
        // bytes we last agreed with rather than guessing from timing.
        void window.api
          .read(path)
          .then((content) => {
            if (content !== store.savedContent(doc.id)) store.setConflict(doc.id, true)
          })
          .catch(() => store.setConflict(doc.id, true))
      }),
    [store]
  )

  // ------------------------------------------------------------------ view

  const active = snapshot.activeId ? store.find(snapshot.activeId) : null
  const conflicted = snapshot.docs.find((doc) => doc.conflict) ?? null
  const showPanels = !focusMode

  return (
    <div className={`app${focusMode ? ' is-focus' : ''}`} data-theme={theme}>
      <TitleBar folder={snapshot.folder} theme={theme} onTheme={setThemeState} />

      <TabBar
        docs={snapshot.docs}
        activeId={snapshot.activeId}
        paletteHint={PALETTE_HINT}
        focusMode={focusMode}
        onSelect={(id) => store.activate(id)}
        onClose={(id) => store.close(id)}
        onPalette={() => setPaletteOpen(true)}
        onFocus={() => setFocusMode((value) => !value)}
      />

      <div className="body">
        {showPanels && panels.sidebar ? (
          <Sidebar
            folder={snapshot.folder}
            activePath={active?.path ?? null}
            recent={snapshot.docs.map((doc) => ({ id: doc.id, name: doc.name, path: doc.path }))}
            onOpenPath={(path) => void openPath(path)}
            onOpenFolder={() => void shell.openFolder()}
            onSelectDoc={(id) => store.activate(id)}
          />
        ) : null}

        <main className="stage">
          {conflicted ? (
            <ConflictBar
              name={conflicted.name}
              dirty={conflicted.dirty}
              onReload={() => {
                const path = conflicted.path
                if (!path) return
                void window.api.read(path).then((content) => {
                  store.reload(conflicted.id, content)
                  handles.current.get(conflicted.id)?.setValue(content)
                })
              }}
              onKeepMine={() => store.setConflict(conflicted.id, false)}
            />
          ) : null}

          {snapshot.docs.map((doc) => (
            <div
              key={doc.id}
              className="editor-slot"
              hidden={doc.id !== snapshot.activeId}
              // `hidden` alone loses to the flex display rule.
              style={{ display: doc.id === snapshot.activeId ? 'flex' : 'none' }}
            >
              <MarkdownEditor
                ref={(handle) => {
                  if (handle) handles.current.set(doc.id, handle)
                  else handles.current.delete(doc.id)
                }}
                defaultValue={store.content(doc.id)}
                commands={registry}
                app={{ shell: shellRef.current }}
                codeLanguages={languages}
                onChange={(text) => store.setContent(doc.id, text)}
                extensions={[registrar(doc.id)]}
              />
            </div>
          ))}
        </main>

        {showPanels && panels.outline ? <Outline view={activeView} /> : null}
      </div>

      <StatusBar doc={active} view={activeView} />

      <CommandPalette
        open={paletteOpen}
        commands={descriptors}
        onOpenChange={setPaletteOpen}
        onRun={(id) => registry.run(id, contextRef.current)}
      />
    </div>
  )
}
