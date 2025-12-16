/**
 * BinKit Registry
 *
 * Central registry of all entries for download and packaging.
 */

export type { RegistryEntry, EntryContext, EntryConfig, Target, VerifyCommands } from './types.js'
export { getTargetId } from './types.js'

import type { RegistryEntry } from './types.js'
import { androidPlatformTools } from './entries/android-platform-tools.js'

/**
 * Registry entries, keyed by name
 */
export const entries: Record<string, RegistryEntry> = {
  'android-platform-tools': androidPlatformTools,
}
