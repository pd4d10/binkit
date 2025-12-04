import type { PlatformId } from './types.js'

/**
 * Get the current platform identifier
 * @returns PlatformId in format <os>-<arch>
 */
export function getCurrentPlatform(): PlatformId {
  return `${process.platform}-${process.arch}`
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

