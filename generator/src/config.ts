import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Read package.json to get author and license
const pkgPath = path.join(__dirname, '..', '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

export const AUTHOR: string = pkg.author;
export const LICENSE: string = pkg.license;

import type { VerifyCommands } from '@binkit/registry'

type PlatformId = string

/**
 * Binary name for tools with multiple binaries
 * Export name will be auto-generated using camelCase
 */
export type BinaryName = string

/**
 * Download configuration for a platform
 */
export interface PlatformDownload {
  /** Download URL */
  url: string
}

export type { VerifyCommands }

/**
 * Configuration for a specific platform package
 */
export interface PlatformConfig {
  /** Platform identifier (e.g., "linux-x64", "darwin-arm64") */
  platformId: PlatformId
  /** NPM package name (e.g., "@binkit/ffmpeg-linux-x64") */
  npmPackageName: string
  /** Download configuration for this platform */
  download?: PlatformDownload
}

/**
 * Configuration for a BinKit tool package
 */
export interface ToolConfig {
  /** Tool name (e.g., "ffmpeg", "adb") */
  toolName: string
  /** NPM scope (default: "@binkit") */
  scope: string
  /** Package version */
  version: string
  /** List of supported platforms */
  platforms: PlatformConfig[]
  /** List of binary names (for tools with multiple binaries like android-platform-tools) */
  binaries?: BinaryName[]
  /** Verification commands to run after download, e.g. ['adb --version'] */
  verify?: VerifyCommands
}

export interface CreateToolConfigOptions {
  /** Tool name */
  toolName: string
  /** Package version (default: 0.1.0) */
  version?: string
  /** List of binary names for tools with multiple binaries */
  binaries?: BinaryName[]
  /** Download URLs per platform (keyed by platformId) */
  downloads?: Record<string, PlatformDownload>
  /** Verification commands to run after download, e.g. ['adb --version'] */
  verify?: VerifyCommands
}

/**
 * Create a default tool configuration
 * @param options - Tool configuration options
 * @returns ToolConfig with common platforms
 */
export function createToolConfig(options: CreateToolConfigOptions): ToolConfig {
  const { toolName, version = '0.1.0', binaries, downloads, verify } = options
  const scope = '@binkit'

  const platformIds = ['darwin-x64', 'darwin-arm64', 'linux-x64', 'linux-arm64', 'win32-x64']

  const platforms: PlatformConfig[] = platformIds.map((platformId) => ({
    platformId,
    npmPackageName: `${scope}/${toolName}-${platformId}`,
    download: downloads?.[platformId],
  }))

  return {
    toolName,
    scope,
    version,
    platforms,
    binaries,
    verify,
  }
}
