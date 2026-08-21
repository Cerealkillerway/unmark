import type { CommandDescriptor } from '@md/core'

/** How a command reads in the palette and what the query is matched against. */
export const commandLabel = (command: CommandDescriptor): string =>
  command.category ? `${command.category}: ${command.title}` : command.title

/**
 * Subsequence match, so `fmb` finds `Format: Bold`. Ranked by how tightly the
 * query sits in the label — fewer skipped characters wins.
 *
 * @returns 0 for no match, otherwise a score in (0, 1].
 */
export function score(query: string, haystack: string): number {
  if (!query) return 1
  const target = haystack.toLowerCase()
  let index = -1
  let gaps = 0
  for (const ch of query.toLowerCase()) {
    const next = target.indexOf(ch, index + 1)
    if (next < 0) return 0
    gaps += next - index - 1
    index = next
  }
  return 1 / (1 + gaps)
}

/** The palette's visible list for a query. An empty query shows everything. */
export function filterCommands(
  commands: readonly CommandDescriptor[],
  query: string
): CommandDescriptor[] {
  return commands
    .map((command) => ({ command, rank: score(query, commandLabel(command)) }))
    .filter((entry) => entry.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .map((entry) => entry.command)
}
