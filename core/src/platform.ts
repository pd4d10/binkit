/**
 * Platform identifier in the format: <os>-<arch>
 * Examples: darwin-x64, darwin-arm64, linux-x64, win32-x64
 */
export type PlatformId = string

/**
 * Supported operating systems
 */
export type OS = 'darwin' | 'linux' | 'win32'

/**
 * Supported CPU architectures
 */
export type Arch = 'x64' | 'arm64' | 'ia32' | 'arm'

/**
 * Get the current platform identifier
 * @returns PlatformId in format <os>-<arch>
 */
export function getCurrentPlatform(): PlatformId {
  const platform = process.platform as OS
  const arch = process.arch as Arch
  return `${platform}-${arch}`
}

/**
 * Parse a platform identifier into its components
 * @param platformId - Platform identifier string
 * @returns Object containing os and arch
 */
export function parsePlatform(platformId: PlatformId): { os: OS; arch: Arch } {
  const [os, arch] = platformId.split('-') as [OS, Arch]
  return { os, arch }
}

/**
 * Check if the current platform matches the given platform identifier
 * @param platformId - Platform identifier to check
 * @returns true if current platform matches
 */
export function isPlatform(platformId: PlatformId): boolean {
  return getCurrentPlatform() === platformId
}

/**
 * Get library path environment variable name for the current platform
 * @returns Environment variable name for library path
 */
export function getLibraryPathEnvVar(): string {
  const platform = process.platform
  switch (platform) {
    case 'darwin':
      return 'DYLD_LIBRARY_PATH'
    case 'win32':
      return 'PATH'
    default:
      return 'LD_LIBRARY_PATH'
  }
}
