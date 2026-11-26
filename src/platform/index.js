/**
 * Platform layer: the only place where web and desktop builds differ.
 *
 * Contract (CLAUDE.md §7):
 *   platform.isDesktop                        boolean
 *   platform.saveFile({ name, mime, data })   data: string | Blob | Uint8Array
 *                                             → Promise<boolean|null>  (null: cancelled by the user)
 *   platform.openProject()                    → Promise<{ name, path?, text } | null>
 *   platform.saveProject({ text, name, path?, saveAs? })
 *                                             → Promise<{ path?, name } | null>  (throws on write error)
 *   platform.onBeforeClose(handler)           handler() → true to ask for confirmation
 *
 * `path` is opaque: a file handle id on the web, a file system path on desktop.
 * The web implementation ships now; the Tauri implementation comes in phase 3.
 */
import { webPlatform } from './web.js';

export const platform = webPlatform;
