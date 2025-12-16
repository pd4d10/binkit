import type { RegistryEntry } from '../types.js'

export const androidPlatformTools: RegistryEntry = {
  version: '0.0.4', // For testing purposes only
  upstreamVersion: '35.0.2',
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
    'win32-x64': 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip',
  },
  verify: [
    'adb --version',
    'fastboot --version',
  ],
}
