import type { Target, VerifyCommands } from 'binkit-registry'
import { SCOPE } from './constants.js'
import { getTargetId } from 'binkit-registry'

/**
 * Binary name for tools with multiple binaries
 * Export name will be auto-generated using camelCase
 */
export type BinaryName = string

/**
 * Download configuration for a target
 */
export interface TargetDownload {
  /** Download URL */
  url: string
}

export type { VerifyCommands }

/**
 * Configuration for a specific target package
 */
export interface TargetConfig {
  /** Platform (e.g., "darwin", "linux", "win32") */
  platform: NodeJS.Platform
  /** Architecture (e.g., "x64", "arm64") */
  arch: NodeJS.Architecture
  /** NPM package name (e.g., "@binkit/ffmpeg-linux-x64") */
  npmPackageName: string
  /** Download configuration for this target */
  download?: TargetDownload
}

export { getTargetId }

/**
 * Configuration for a BinKit tool package
 */
export interface ToolConfig {
  /** Tool name (e.g., "ffmpeg", "adb") */
  name: string
  /** Package version */
  version: string
  /** Upstream version (e.g., "35.0.2") */
  upstreamVersion: string
  /** List of supported targets */
  targets: TargetConfig[]
  /** Path prefix to strip when extracting */
  stripPrefix?: string
  /** List of binary names (relative to vendor dir after stripping) */
  binaries?: BinaryName[]
  /** Verification commands to run after download */
  verify?: VerifyCommands
}

export interface CreateToolConfigOptions {
  /** Tool name */
  name: string
  /** Package version (default: 0.1.0) */
  version?: string
  /** Upstream version (e.g., "35.0.2") */
  upstreamVersion: string
  /** List of supported targets from registry */
  targets: Target[]
  /** Path prefix to strip when extracting */
  stripPrefix?: string
  /** List of binary names (relative to vendor dir after stripping) */
  binaries?: BinaryName[]
  /** Download URLs per target (keyed by targetId) */
  downloads?: Record<string, TargetDownload>
  /** Verification commands to run after download */
  verify?: VerifyCommands
}

/**
 * Create a tool configuration
 */
export function createToolConfig(options: CreateToolConfigOptions): ToolConfig {
  const { name, version = '0.1.0', upstreamVersion, targets: targetDefs, stripPrefix, binaries, downloads, verify } = options

  const targets: TargetConfig[] = targetDefs.map((target) => {
    const targetId = getTargetId(target)
    return {
      platform: target.platform,
      arch: target.arch,
      npmPackageName: `${SCOPE}/${name}-${targetId}`,
      download: downloads?.[targetId],
    }
  })

  return {
    name,
    version,
    upstreamVersion,
    targets,
    stripPrefix,
    binaries,
    verify,
  }
}
