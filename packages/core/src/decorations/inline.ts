import type { RuleTable } from './types.js'

/**
 * Inline nodes (§4.1 / Phase 1).
 *
 * Every one of these is a container whose first and last children are marker
 * nodes: `StrongEmphasis > EmphasisMark, …, EmphasisMark`. The content class
 * styles what sits between them; the markers are collapsed unless revealed.
 */
export const inlineRules: RuleTable = {
  StrongEmphasis: { content: 'cm-md-strong' },
  Emphasis: { content: 'cm-md-em' },
  InlineCode: { content: 'cm-md-code' },
  Strikethrough: { content: 'cm-md-strike' }
}
