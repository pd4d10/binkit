import fs from 'node:fs/promises'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { PlatformConfig, ToolConfig } from './config.js'

const execAsync = promisify(exec)

/**
 * Download a file from a URL
 */
export async function downloadFile(url: string, destPath: string): Promise<void> {
  console.log(`  ↓ Downloading from ${url}...`)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  const fileStream = createWriteStream(destPath)
  // @ts-ignore Node.js stream compatibility
  await pipeline(response.body, fileStream)

  console.log(`  ✓ Downloaded to ${destPath}`)
}

/**
 * Extract specific binaries from a zip file
 * @param zipPath - Path to the zip file
 * @param destDir - Destination directory for binaries
 * @param binaryPaths - List of binary paths relative to zip root (e.g., "platform-tools/adb")
 */
export async function extractBinaries(
  zipPath: string,
  destDir: string,
  binaryPaths: string[]
): Promise<void> {
  console.log(`  📦 Extracting binaries from ${zipPath}...`)

  // Create temp directory for extraction
  const tempDir = path.join(destDir, '.temp-extract')
  await fs.mkdir(tempDir, { recursive: true })

  try {
    // Use unzip command (available on macOS/Linux, requires installation on Windows)
    await execAsync(`unzip -o -q "${zipPath}" -d "${tempDir}"`)

    // Copy specified binaries to destDir
    for (const binaryPath of binaryPaths) {
      const srcPath = path.join(tempDir, binaryPath)
      const filename = path.basename(binaryPath)
      const destPath = path.join(destDir, filename)

      // Check if source exists
      const exists = await fs.access(srcPath).then(() => true).catch(() => false)
      if (!exists) {
        console.log(`  ⚠ Binary not found: ${binaryPath}`)
        continue
      }

      // Copy file
      await fs.copyFile(srcPath, destPath)
      // Make binary executable
      await fs.chmod(destPath, 0o755)
    }

    console.log(`  ✓ Extracted ${binaryPaths.length} binaries to ${destDir}`)
  } finally {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true })
    // Cleanup zip file
    await fs.rm(zipPath, { force: true })
  }
}

/**
 * Download and extract binaries for a platform
 */
export async function downloadAndExtractPlatform(
  config: ToolConfig,
  platform: PlatformConfig,
  packageDir: string
): Promise<void> {
  if (!platform.download?.url) {
    console.log(`  ⚠ No download URL for ${platform.platformId}, skipping download`)
    return
  }

  const binDir = path.join(packageDir, 'bin')
  await fs.mkdir(binDir, { recursive: true })

  const zipPath = path.join(packageDir, 'download.zip')

  // Download the zip file
  await downloadFile(platform.download.url, zipPath)

  // Get binary paths from config
  const binaryPaths = config.binaries ?? [config.toolName]

  // Extract binaries to bin directory
  await extractBinaries(zipPath, binDir, binaryPaths)
}
