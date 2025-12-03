/**
 * Tool download configurations
 */

/**
 * Verification commands to run after download
 * Each string is a full command, e.g. ['adb --version', 'fastboot --version']
 */
export type VerifyCommands = string[]

export interface ToolDownloadConfig {
  version: string
  /** List of binary paths relative to zip root (e.g., "platform-tools/adb") */
  binaries: string[]
  /** Download URLs keyed by platformId */
  downloads: Record<string, string>
  /** Verification commands to run after download, e.g. ['adb --version'] */
  verify?: VerifyCommands
}

/**
 * Registry of all tool configurations, keyed by toolName
 */
export const toolConfigs: Record<string, ToolDownloadConfig> = {
  'android-platform-tools': {
    version: '0.1.0',
    binaries: [
      'platform-tools/adb',
      'platform-tools/fastboot',
      'platform-tools/etc1tool',
      'platform-tools/hprof-conv',
      'platform-tools/make_f2fs',
      'platform-tools/make_f2fs_casefold',
      'platform-tools/mke2fs',
      'platform-tools/sqlite3',
    ],
    downloads: {
      'darwin-x64': 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip',
      'darwin-arm64': 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip',
      'linux-x64': 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip',
      'linux-arm64': 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip',
      'win32-x64': 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip',
    },
    verify: [
      'adb --version',
      'fastboot --version',
      'sqlite3 --version',
      'mke2fs -V',
      'make_f2fs -V',
      'make_f2fs_casefold -V',
    ],
  },
}
