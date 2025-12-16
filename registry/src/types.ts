/**
 * Registry entry types
 */

/**
 * Verification commands to run after download
 * Each string is a full command, e.g. ['adb --version', 'fastboot --version']
 */
export type VerifyCommands = string[]

/**
 * Target platform definition
 */
export interface Target {
  platform: NodeJS.Platform
  arch: NodeJS.Architecture
}

/**
 * Get target identifier string from platform and arch
 */
export function getTargetId(target: Target): string
export function getTargetId(platform: NodeJS.Platform, arch: NodeJS.Architecture): string
export function getTargetId(
  platformOrTarget: NodeJS.Platform | Target,
  arch?: NodeJS.Architecture
): string {
  if (typeof platformOrTarget === 'object') {
    return `${platformOrTarget.platform}-${platformOrTarget.arch}`
  }
  return `${platformOrTarget}-${arch}`
}

/**
 * Context passed to registry entry functions.
 * Use an object for easy future extension without breaking changes.
 */
export interface EntryContext {
  /** Upstream version (e.g., "35.0.2") */
  version: string
  /** Platform (e.g., "darwin", "linux", "win32") */
  platform: NodeJS.Platform
  /** Architecture (e.g., "x64", "arm64") */
  arch: NodeJS.Architecture
}

/**
 * Configuration returned by getConfig function
 */
export interface EntryConfig {
  /** Download URL for this target */
  downloadUrl: string
  /** Path prefix to strip when extracting (e.g., "platform-tools") */
  stripPrefix?: string
  /** Binary names (relative to vendor dir after stripping) */
  binaries: string[]
  /** Verification commands */
  verify?: VerifyCommands
}

export interface RegistryEntry {
  /** List of supported upstream versions */
  versions: string[]
  /** List of supported targets */
  targets: Target[]
  /** Get configuration for a specific version and target */
  getConfig: (ctx: EntryContext) => EntryConfig
}
