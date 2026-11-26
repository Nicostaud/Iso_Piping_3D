/**
 * Platform layer: the only place where web and desktop builds differ.
 *
 * Contract (CLAUDE.md §7):
 *   platform.isDesktop                        boolean
 *   platform.saveFile({ name, mime, data })   data: string | Blob | Uint8Array → Promise<boolean>
 *   platform.openProject()                    → Promise<{ name, path?, text } | null>
 *   platform.saveProject({ text, path?, saveAs? }) → Promise<{ path?, name } | null>   (phase 2)
 *   platform.onBeforeClose(handler)           (phase 2/3)
 *
 * Phase 1 ships the web implementation only; the Tauri implementation comes in phase 3.
 */
import { webPlatform } from './web.js';

export const platform = webPlatform;
