import type { RegistryEntry } from '../types.js'

/**
 * FFmpeg registry entry
 *
 * Official download sources (from https://www.ffmpeg.org/download.html):
 *
 * - Windows: https://www.gyan.dev/ffmpeg/builds/ (official recommended)
 *   URL: https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-{version}-essentials_build.zip
 *
 * - macOS: https://evermeet.cx/ffmpeg/ (official recommended, x64 only)
 *   URL: https://evermeet.cx/ffmpeg/ffmpeg-{version}.zip
 *
 * Note: Linux is not included because official sources (johnvansickle.com, BtbN)
 * do not provide versioned 8.x releases.
 *
 * Note: macOS ARM (Apple Silicon) is NOT officially supported.
 * Users can run the x64 binary via Rosetta 2.
 */
export const ffmpeg: RegistryEntry = {
  versions: ['8.0.0'],
  targets: [
    { platform: 'win32', arch: 'x64' },
    { platform: 'darwin', arch: 'x64' },
  ],

  getConfig: ({ version, platform }) => {
    if (platform === 'win32') {
      // gyan.dev Windows builds (official recommended)
      return {
        downloadUrl: `https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-${version}-essentials_build.zip`,
        stripPrefix: `ffmpeg-${version}-essentials_build`,
        binaries: ['bin/ffmpeg.exe', 'bin/ffprobe.exe'],
        verify: ['ffmpeg -version'],
      }
    }

    if (platform === 'darwin') {
      // evermeet.cx macOS builds (official recommended, x64 only)
      return {
        downloadUrl: `https://evermeet.cx/ffmpeg/ffmpeg-${version}.zip`,
        binaries: ['ffmpeg'],
        verify: ['ffmpeg -version'],
      }
    }

    throw new Error(`Unsupported platform: ${platform}`)
  },
}
