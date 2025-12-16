/**
 * Registry entry types
 */

/**
 * Verification commands to run after download
 * Each string is a full command, e.g. ['adb --version', 'fastboot --version']
 */
export type VerifyCommands = string[]

export interface RegistryEntry {
  /** Package version (semver format: {framework-major}.{binary-major}.{patch}) */
  version: string
  /** Original upstream binary version (e.g., "35.0.2" for Android Platform Tools) */
  upstreamVersion: string
  /** List of binary paths relative to zip root (e.g., "platform-tools/adb") */
  binaries: string[]
  /** Download URLs keyed by platformId */
  downloads: Record<string, string>
  /** Platform-specific library files to extract alongside binaries (e.g., Windows DLLs) */
  libs?: Record<string, string[]>
  /** Verification commands to run after download, e.g. ['adb --version'] */
  verify?: VerifyCommands
}
