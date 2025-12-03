import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Read package.json to get author and license
const pkgPath = path.join(__dirname, '..', '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

export const AUTHOR: string = pkg.author;
export const LICENSE: string = pkg.license;

type PlatformId = string

/**
 * Configuration for a specific platform package
 */
export interface PlatformConfig {
  /** Platform identifier (e.g., "linux-x64", "darwin-arm64") */
  platformId: PlatformId
  /** NPM package name (e.g., "@binkit/ffmpeg-linux-x64") */
  npmPackageName: string
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
}

/**
 * Create a default tool configuration
 * @param toolName - Name of the tool
 * @param version - Version string
 * @returns ToolConfig with common platforms
 */
export function createToolConfig(
  toolName: string,
  version: string = '0.1.0'
): ToolConfig {
  const scope = '@binkit'
  const platforms: PlatformConfig[] = [
    {
      platformId: 'darwin-x64',
      npmPackageName: `${scope}/${toolName}-darwin-x64`,
    },
    {
      platformId: 'darwin-arm64',
      npmPackageName: `${scope}/${toolName}-darwin-arm64`,
    },
    {
      platformId: 'linux-x64',
      npmPackageName: `${scope}/${toolName}-linux-x64`,
    },
    {
      platformId: 'linux-arm64',
      npmPackageName: `${scope}/${toolName}-linux-arm64`,
    },
    {
      platformId: 'win32-x64',
      npmPackageName: `${scope}/${toolName}-win32-x64`,
    },
  ]

  return {
    toolName,
    scope,
    version,
    platforms,
  }
}
