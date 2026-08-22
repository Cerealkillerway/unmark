import { imagePreviewsInstalled, toggleImagePreview } from '../decorations/images.js'
import type { CommandContext, CommandDef } from './types.js'

/**
 * View commands — things that change how the document is displayed rather
 * than what it says. None of them touch the text, so none of them guard on
 * `readOnly` the way the format commands do.
 *
 * `scope: 'editor'` matters for the desktop shell: §4.3 has it register the
 * accelerator with the OS only for `app`-scoped commands, so this key still
 * reaches the CM6 keymap while the menu item shows the shortcut beside it.
 */

const hasImagePreviews = (ctx: CommandContext): boolean =>
  ctx.view !== null && imagePreviewsInstalled(ctx.view.state)

export const viewCommands: CommandDef[] = [
  {
    id: 'view.imagePreview',
    // Named into the family it belongs to. The shell's other view toggles are
    // "Toggle Files", "Toggle Outline" and "Toggle Theme", and the palette
    // matches on the label, so anything else here is invisible to the one word
    // someone is most likely to type.
    title: 'Toggle Image Preview',
    category: 'View',
    keys: ['Mod-Shift-m'],
    scope: 'editor',
    // Disabled rather than absent when the host never configured images: the
    // menu should say the mode exists and is unavailable, not hide it.
    when: hasImagePreviews,
    run: (ctx) => (ctx.view ? toggleImagePreview(ctx.view) : false)
  }
]
