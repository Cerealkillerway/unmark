import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  replaceAll,
  replaceNext,
  search,
  searchPanelOpen,
  selectMatches,
  setSearchQuery,
  SearchQuery
} from '@codemirror/search'
import { StateField, type EditorState, type Extension } from '@codemirror/state'
import { runScopeHandlers, type EditorView, type Panel, type ViewUpdate } from '@codemirror/view'
import type { CommandContext, CommandDef } from './commands/types.js'

/**
 * Find, over the document you are editing.
 *
 * The matching itself is `@codemirror/search` — a package this library already
 * declared as a peer dependency and never used. Reimplementing query state,
 * match iteration, regex handling and the wrapping search would be a worse
 * version of something already written and tested.
 *
 * What this module adds is the three things that package cannot know about:
 *
 *  - **The keys come from the registry, not from `searchKeymap`.** That keymap
 *    is a second place shortcuts would be declared, and I4 exists because a
 *    shortcut that lives only in a keymap drifts from the menu that claims to
 *    show it. The bindings below are `CommandDef`s like every other action, so
 *    the menu bar, the palette and the keyboard are one list.
 *  - **A match count.** The stock panel says nothing about how many matches
 *    there are or which one you are on, which is the first question anyone has
 *    after typing. `SearchQuery.getCursor` is public and honours every flag on
 *    the query, so the tally is exact rather than a second implementation of
 *    the matching rules.
 *  - **A match inside a rendered table is reachable.** Selecting one puts the
 *    selection inside a row that is currently drawn as a widget, and the
 *    reveal rule turns that row back into markdown in the same transaction —
 *    so the match is on screen as text by the time it is scrolled to. That
 *    falls out of the rule rather than needing a special case, but it is the
 *    thing to check first if search ever appears to jump somewhere blank.
 *
 * The panel is ours, through `search`'s own `createPanel` option, which is
 * what lets the count sit inside the field and what keeps the styling on
 * classes this package owns rather than on another package's internals.
 */

export interface SearchOptions {
  /**
   * Put the panel at the top of the editor. Default here, against
   * CodeMirror's own default of the bottom: a find bar at the top is where
   * every editor and browser puts it, and the bottom of this editor is 40vh
   * of deliberate empty space.
   */
  top?: boolean
  /** Start with case sensitivity on. */
  caseSensitive?: boolean
  /** Start with regular-expression matching on. */
  regexp?: boolean
  /** Start with whole-word matching on. */
  wholeWord?: boolean
  /**
   * Stop counting matches after this many. Counting is a scan of the whole
   * document on every keystroke, which is nothing on a document someone is
   * writing by hand and unbounded on a generated one; past the cap the panel
   * says `200+` rather than pretending to a number nobody needs.
   */
  countLimit?: number
}

/* ------------------------------------------------------------------ *
 * Counting
 * ------------------------------------------------------------------ */

export interface MatchTally {
  /** Matches found, never more than the limit. */
  readonly total: number
  /** 1-based index of the match the selection is exactly on, else 0. */
  readonly current: number
  /** True when counting stopped at the limit and `total` is a floor. */
  readonly capped: boolean
}

/**
 * How many matches there are, and which one the selection is on.
 *
 * `query.getCursor` is the same cursor the search commands themselves step
 * through, so case sensitivity, whole-word, regexp and any `test` filter are
 * all honoured without this knowing they exist.
 */
export function matchTally(
  state: EditorState,
  query: SearchQuery,
  limit = 500
): MatchTally {
  if (!query.valid) return { total: 0, current: 0, capped: false }

  const { from, to } = state.selection.main
  const cursor = query.getCursor(state)
  let total = 0
  let current = 0

  for (let next = cursor.next(); !next.done; next = cursor.next()) {
    total++
    // Exactly on it, not merely overlapping: this is the number that should
    // advance when you press Enter, and a caret resting inside a match has
    // not arrived at it yet.
    if (next.value.from === from && next.value.to === to) current = total
    if (total >= limit) return { total, current, capped: true }
  }
  return { total, current, capped: false }
}

/** What the counter reads, given a tally. */
export function tallyLabel(query: SearchQuery, tally: MatchTally): string {
  if (!query.valid) return ''
  if (tally.total === 0) return 'No results'
  return `${tally.current}/${tally.total}${tally.capped ? '+' : ''}`
}

/* ------------------------------------------------------------------ *
 * The panel
 * ------------------------------------------------------------------ */

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs: Record<string, string> = {}
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
  return node
}

/**
 * The find bar.
 *
 * Every behaviour here is an exported command — `findNext`, `replaceAll`,
 * `closeSearchPanel` — so this owns the markup and nothing else. That is the
 * whole point of `createPanel`: the query, the cursor and the history stay
 * where they are maintained.
 */
class FindPanel implements Panel {
  readonly dom: HTMLElement
  readonly top: boolean

  private readonly searchField: HTMLInputElement
  private readonly replaceField: HTMLInputElement
  private readonly caseField: HTMLInputElement
  private readonly reField: HTMLInputElement
  private readonly wordField: HTMLInputElement
  private readonly counter: HTMLElement
  private query: SearchQuery

  constructor(
    private readonly view: EditorView,
    private readonly limit: number,
    top: boolean
  ) {
    this.top = top
    this.query = getSearchQuery(view.state)
    this.commit = this.commit.bind(this)

    this.searchField = el('input', 'cm-md-find-input', {
      // CodeMirror focuses whatever carries this when the panel opens.
      'main-field': 'true',
      placeholder: 'Find',
      'aria-label': 'Find',
      type: 'text'
    })
    this.searchField.value = this.query.search
    this.searchField.addEventListener('input', this.commit)

    this.counter = el('span', 'cm-md-find-count', { 'aria-live': 'polite' })

    const box = el('div', 'cm-md-find-box')
    box.append(this.searchField, this.counter)

    this.replaceField = el('input', 'cm-md-find-input', {
      placeholder: 'Replace',
      'aria-label': 'Replace',
      type: 'text'
    })
    this.replaceField.value = this.query.replace
    this.replaceField.addEventListener('input', this.commit)

    this.caseField = this.toggle('Match case', this.query.caseSensitive)
    this.reField = this.toggle('Regexp', this.query.regexp)
    this.wordField = this.toggle('Whole word', this.query.wholeWord)

    const find = el('div', 'cm-md-find-row')
    find.append(
      box,
      this.button('next', 'Next', () => findNext(view), true),
      this.button('prev', 'Previous', () => findPrevious(view)),
      this.button('all', 'Select all', () => selectMatches(view)),
      this.caseField.parentElement!,
      this.reField.parentElement!,
      this.wordField.parentElement!
    )

    this.dom = el('div', 'cm-md-find')
    this.dom.addEventListener('keydown', (event) => this.keydown(event))
    this.dom.append(find)

    // A read-only editor has nothing to replace with.
    if (!view.state.readOnly) {
      const replace = el('div', 'cm-md-find-row')
      replace.append(
        this.replaceField,
        this.button('replace', 'Replace', () => replaceNext(view)),
        this.button('replaceAll', 'Replace all', () => replaceAll(view))
      )
      this.dom.append(replace)
    }

    const close = el('button', 'cm-md-find-close', {
      type: 'button',
      name: 'close',
      'aria-label': 'Close find'
    })
    close.textContent = '×'
    close.addEventListener('click', () => {
      closeSearchPanel(view)
      view.focus()
    })
    this.dom.append(close)

    this.render()
  }

  private button(
    name: string,
    label: string,
    onclick: () => void,
    primary = false
  ): HTMLButtonElement {
    const node = el(
      'button',
      primary ? 'cm-md-find-button cm-md-find-primary' : 'cm-md-find-button',
      { type: 'button', name }
    )
    node.textContent = label
    node.addEventListener('click', onclick)
    return node
  }

  private toggle(label: string, checked: boolean): HTMLInputElement {
    const input = el('input', 'cm-md-find-check', { type: 'checkbox' })
    input.checked = checked
    input.addEventListener('change', this.commit)
    const wrap = el('label', 'cm-md-find-toggle')
    wrap.append(input, document.createTextNode(label))
    return input
  }

  private commit(): void {
    const query = new SearchQuery({
      search: this.searchField.value,
      caseSensitive: this.caseField.checked,
      regexp: this.reField.checked,
      wholeWord: this.wordField.checked,
      replace: this.replaceField.value
    })
    if (query.eq(this.query)) return
    this.query = query
    this.view.dispatch({ effects: setSearchQuery.of(query) })
  }

  private keydown(event: KeyboardEvent): void {
    // The editor's own scoped bindings first, so a shortcut aimed at the
    // panel still reaches it while a field has focus.
    if (runScopeHandlers(this.view, event, 'search-panel')) {
      event.preventDefault()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSearchPanel(this.view)
      this.view.focus()
      return
    }
    if (event.key !== 'Enter') return
    if (event.target === this.searchField) {
      event.preventDefault()
      ;(event.shiftKey ? findPrevious : findNext)(this.view)
    } else if (event.target === this.replaceField) {
      event.preventDefault()
      replaceNext(this.view)
    }
  }

  private render(): void {
    this.counter.textContent = tallyLabel(
      this.query,
      matchTally(this.view.state, this.query, this.limit)
    )
  }

  update(update: ViewUpdate): void {
    // The query can change from outside the panel — `selectNextOccurrence`
    // sets one — so the fields follow the state rather than only driving it.
    const query = getSearchQuery(update.state)
    if (!query.eq(this.query)) {
      this.query = query
      this.searchField.value = query.search
      this.replaceField.value = query.replace
      this.caseField.checked = query.caseSensitive
      this.reField.checked = query.regexp
      this.wordField.checked = query.wholeWord
    }
    // The count depends on the text, and which one is current on where the
    // selection is, so both have to be watched.
    if (update.docChanged || update.selectionSet || !query.eq(getSearchQuery(update.startState))) {
      this.render()
    }
  }
}

/* ------------------------------------------------------------------ *
 * The extension
 * ------------------------------------------------------------------ */

/**
 * Marks the extension as configured, so a command can tell "installed and
 * closed" from "not installed at all".
 *
 * `openSearchPanel` would otherwise quietly append its own configuration on
 * first use, which works but skips the options and the panel chosen here — a
 * stock find bar that appears exactly once, and ours ever after.
 */
const searchInstalled = StateField.define<boolean>({
  create: () => true,
  update: (value) => value
})

/** False when `markdownSearch()` is not in the configuration. */
export function searchInstalledIn(state: EditorState): boolean {
  return state.field(searchInstalled, false) === true
}

/** True while the find panel is showing. */
export function findPanelOpen(state: EditorState): boolean {
  return searchPanelOpen(state)
}

export function markdownSearch(options: SearchOptions = {}): Extension {
  const {
    top = true,
    caseSensitive = false,
    regexp = false,
    wholeWord = false,
    countLimit = 500
  } = options
  return [
    searchInstalled,
    search({
      top,
      caseSensitive,
      regexp,
      wholeWord,
      createPanel: (view) => new FindPanel(view, countLimit, top)
    })
  ]
}

/* ------------------------------------------------------------------ *
 * Commands
 * ------------------------------------------------------------------ */

const installed = (ctx: CommandContext): boolean =>
  ctx.view !== null && searchInstalledIn(ctx.view.state)

/**
 * Find commands.
 *
 * All `scope: 'editor'`: §4.3 registers the accelerator with the OS only for
 * `app`-scoped commands, so these keys still reach the CM6 keymap while the
 * menu shows the shortcut beside the label. Registering `CmdOrCtrl+F` with the
 * OS instead would mean CodeMirror never sees it — trap #4.
 */
export const searchCommands: CommandDef[] = [
  {
    id: 'edit.find',
    title: 'Find',
    category: 'Edit',
    keys: ['Mod-f'],
    scope: 'editor',
    when: installed,
    run: (ctx) => (ctx.view ? openSearchPanel(ctx.view) : false)
  },
  {
    id: 'edit.findNext',
    title: 'Find Next',
    category: 'Edit',
    keys: ['Mod-g'],
    scope: 'editor',
    when: installed,
    run: (ctx) => (ctx.view ? findNext(ctx.view) : false)
  },
  {
    id: 'edit.findPrevious',
    title: 'Find Previous',
    category: 'Edit',
    keys: ['Mod-Shift-g'],
    scope: 'editor',
    when: installed,
    run: (ctx) => (ctx.view ? findPrevious(ctx.view) : false)
  },
  {
    id: 'edit.selectAllMatches',
    title: 'Select All Matches',
    category: 'Edit',
    keys: ['Mod-Shift-l'],
    scope: 'editor',
    when: installed,
    run: (ctx) => (ctx.view ? selectMatches(ctx.view) : false)
  },
  {
    id: 'edit.closeFind',
    title: 'Close Find',
    category: 'Edit',
    keys: ['Escape'],
    scope: 'editor',
    // Only while the panel is up. Otherwise this would swallow every Escape in
    // the editor, and Escape is how you leave a multi-cursor selection.
    when: (ctx) => installed(ctx) && ctx.view !== null && findPanelOpen(ctx.view.state),
    run: (ctx) => (ctx.view ? closeSearchPanel(ctx.view) : false)
  }
]
