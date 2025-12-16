import type { RegistryEntry } from '../types.js'

export const androidPlatformTools: RegistryEntry = {
  versions: ['35.0.0'],
  targets: [
    { platform: 'darwin', arch: 'x64' },
    { platform: 'darwin', arch: 'arm64' },
    { platform: 'linux', arch: 'x64' },
    { platform: 'win32', arch: 'x64' },
  ],

  getConfig: ({ version, platform }) => {
    const osName = platform === 'win32' ? 'windows' : platform === 'linux' ? 'linux' : 'darwin'

    return {
      downloadUrl: `https://dl.google.com/android/repository/platform-tools_r${version}-${osName}.zip`,
      stripPrefix: 'platform-tools',
      binaries: [
        'adb',
        'fastboot',
        'etc1tool',
        'hprof-conv',
        'make_f2fs',
        'make_f2fs_casefold',
        'mke2fs',
        'sqlite3',
      ],
      verify: [
        'adb --version',
        'fastboot --version',
      ],
    }
  },
}
