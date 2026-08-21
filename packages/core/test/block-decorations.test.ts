import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { describe, expect, it } from 'vitest'
import { buildDecorationRanges } from '../src/decorations/builder.js'
import { defaultRules, markdownSetup } from '../src/editor.js'
import {
  classesAt,
  decorate,
  hidden,
  lineClasses as lineClassesOn,
  rendered,
  renderState,
  stateFrom
} from './helpers.js'

describe('headings', () => {
  it('hides the hash and the space after it', () => {
    expect(rendered('# Heading‸')).toBe('Heading')
    expect(hidden('# Heading‸')).toEqual(['# '])
  })

  it('hides the closing hashes of a closed ATX heading', () => {
    expect(rendered('## Closed ##‸')).toBe('Closed')
  })

  it('applies a level class to the line and the content', () => {
    expect(lineClassesOn('### Three‸', 1)).toEqual(['cm-md-line-h3'])
    expect(classesAt('### Three‸', 4)).toEqual(['cm-md-h3'])
  })

  it('reveals the hash when the caret is in the heading', () => {
    expect(rendered('# Head‸ing')).toBe('# Heading')
  })

  it('keeps a setext underline visible, styled as syntax', () => {
    // Documented exception: collapsing it needs a replace across a line
    // break, which a ViewPlugin may not provide.
    expect(rendered('Title\n=====‸')).toBe('Title\n=====')
    expect(lineClassesOn('Title\n=====‸', 1)).toEqual(['cm-md-line-h1'])
  })
})

describe('blockquotes', () => {
  it('hides the quote marker and marks the line', () => {
    expect(rendered('> quoted‸')).toBe('quoted')
    expect(lineClassesOn('> quoted‸', 1)).toEqual(['cm-md-line-quote'])
  })

  it('hides the marker on every line of a multi-line quote', () => {
    expect(rendered('> one\n> two‸')).toBe('one\ntwo')
  })
})

describe('lists', () => {
  it('keeps list markers visible — hiding `1.` would destroy the numbering', () => {
    expect(rendered('1. first\n2. second‸')).toBe('1. first\n2. second')
    expect(rendered('- a\n- b‸')).toBe('- a\n- b')
  })

  it('marks list lines and styles the marker', () => {
    expect(lineClassesOn('- item‸', 1)).toEqual(['cm-md-line-list'])
    expect(classesAt('- item‸', 0)).toEqual(['cm-md-list-mark'])
  })

  it('styles task markers distinctly and keeps them visible', () => {
    expect(rendered('- [ ] todo‸')).toBe('- [ ] todo')
    expect(classesAt('- [x] done‸', 2)).toEqual(['cm-md-task-mark'])
  })
})

describe('thematic breaks', () => {
  it('collapses the dashes and marks the line', () => {
    expect(rendered('before\n\n---\n\nafter‸')).toBe('before\n\n\n\nafter')
    expect(lineClassesOn('before\n\n---\n\nafter‸', 3)).toEqual(['cm-md-line-hr'])
  })

  it('shows the dashes again when the caret is on the rule', () => {
    expect(rendered('before\n\n-‸--\n\nafter')).toBe('before\n\n---\n\nafter')
  })
})

describe('fenced code — §4.2 hard exception', () => {
  const fence = '```js\nconst a = 1\n```'

  it('never hides the fences or the language tag', () => {
    expect(rendered(fence + '‸')).toBe(fence)
    expect(hidden(fence + '‸')).toEqual([])
  })

  it('keeps them visible even with the caret far away', () => {
    expect(rendered('text\n\n' + fence + '\n\nmore‸')).toContain('```js')
  })

  it('marks every line of the block', () => {
    for (const n of [1, 2, 3]) {
      expect(lineClassesOn(fence + '‸', n)).toContain('cm-md-line-code')
    }
  })

  it('styles the info string', () => {
    expect(classesAt(fence + '‸', 3)).toContain('cm-md-code-info')
  })
})

describe('front matter — §4.2 hard exception', () => {
  const doc = '---\ntitle: Hello\n---\n\n# Body'

  it('parses as front matter rather than rule + setext heading', () => {
    const state = stateFrom(doc + '‸')
    ensureSyntaxTree(state, state.doc.length, 10_000)
    const names: string[] = []
    const tree = ensureSyntaxTree(state, state.doc.length, 10_000)!
    tree.iterate({ enter: (n) => void names.push(n.name) })
    expect(names).toContain('Frontmatter')
    expect(names).not.toContain('SetextHeading2')
  })

  it('never hides the delimiters', () => {
    expect(rendered(doc + '‸')).toBe('---\ntitle: Hello\n---\n\nBody')
  })

  it('marks the front matter lines', () => {
    expect(lineClassesOn(doc + '‸', 1)).toEqual(['cm-md-line-frontmatter'])
    expect(lineClassesOn(doc + '‸', 2)).toEqual(['cm-md-line-frontmatter'])
  })

  it('still treats a later `---` as a thematic break', () => {
    const withRule = '---\na: 1\n---\n\ntext\n\n---\n\nmore'
    expect(lineClassesOn(withRule + '‸', 7)).toEqual(['cm-md-line-hr'])
  })
})

describe('tables — out of scope for v1 (§4.2)', () => {
  const table = '| a | b |\n| - | - |\n| 1 | 2 |'

  it('hides nothing', () => {
    expect(rendered(table + '‸')).toBe(table)
  })

  it('styles the delimiters and the header', () => {
    expect(classesAt(table + '‸', 0)).toContain('cm-md-table-delim')
    expect(lineClassesOn(table + '‸', 1)).toContain('cm-md-line-table')
  })
})

describe('links', () => {
  it('keeps the URL visible in v1 but styles it', () => {
    const doc = '[label](https://example.com)'
    expect(rendered(doc + '‸')).toBe(doc)
    expect(classesAt(doc + '‸', doc.indexOf('https'))).toContain('cm-md-url')
  })
})

describe('the kitchen-sink fixture', () => {
  const text = readFileSync(
    join(import.meta.dirname, 'fixtures', 'kitchen-sink.md'),
    'utf8'
  )

  it('decorates without throwing and emits well-formed ranges', () => {
    const state = EditorState.create({
      doc: text,
      extensions: markdownSetup({ codeLanguages: [], theme: false })
    })
    ensureSyntaxTree(state, state.doc.length, 20_000)
    const ranges = buildDecorationRanges(
      state,
      [{ from: 0, to: state.doc.length }],
      defaultRules()
    )
    expect(ranges.length).toBeGreaterThan(30)
    for (const r of ranges) {
      expect(r.from).toBeGreaterThanOrEqual(0)
      expect(r.to).toBeLessThanOrEqual(state.doc.length)
      if (r.kind === 'line') expect(r.to).toBe(r.from)
      else expect(r.to).toBeGreaterThan(r.from)
    }
  })

  it('renders every block type', () => {
    const visible = renderState(stateFrom(text))
    expect(visible).toContain('Kitchen sink')
    expect(visible).not.toContain('# Kitchen sink')
    expect(visible).toContain('```js')
    expect(visible).toContain('- bullet one')
    expect(visible).toContain('| column | value |')
    expect(visible).toContain('A blockquote.')
    expect(visible).not.toContain('> A blockquote.')
  })
})

describe('decoration ordering with line decorations', () => {
  it('keeps line before replace before mark at a shared position', () => {
    const ranges = decorate('# Head‸ing\n\n> q\n\n- a')
    for (let i = 1; i < ranges.length; i++) {
      const prev = ranges[i - 1]!
      const cur = ranges[i]!
      expect(cur.from).toBeGreaterThanOrEqual(prev.from)
    }
  })
})
