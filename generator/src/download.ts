import fs from 'node:fs/promises'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type { PlatformConfig, ToolConfig } from './config.js'
import type { VerifyCommands } from '@binkit/registry'

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
 * Run a command and return the exit code and output
 */
function runCommand(binaryPath: string, args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(binaryPath, args)
    let output = ''

    child.stdout.on('data', (data) => {
      output += data.toString()
    })
    child.stderr.on('data', (data) => {
      output += data.toString()
    })

    child.on('close', (code) => {
      resolve({ code: code ?? 1, output })
    })
  })
}

/**
 * Verify binaries by running commands
 */
export async function verifyBinaries(
  binDir: string,
  commands: VerifyCommands
): Promise<void> {
  console.log(`  🔍 Verifying binaries...`)

  for (const command of commands) {
    const [binaryName, ...args] = command.split(' ')
    const binaryPath = path.join(binDir, binaryName)

    // Check if binary exists
    const exists = await fs.access(binaryPath).then(() => true).catch(() => false)
    if (!exists) {
      throw new Error(`Binary not found: ${binaryPath}`)
    }

    const { code, output } = await runCommand(binaryPath, args)
    const firstLine = output.trim().split('\n')[0]

    if (code === 0) {
      console.log(`    ✓ ${binaryName}: ${firstLine}`)
    } else {
      throw new Error(`Verification failed for ${binaryName} (exit code ${code}): ${firstLine}`)
    }
  }
}

/**
 * Download and extract binaries for a platform
 */
export async function downloadAndExtractPlatform(
  config: ToolConfig,
  platform: PlatformConfig,
  packageDir: string,
  verify?: VerifyCommands
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

  // Verify binaries if commands are provided
  if (verify && verify.length > 0) {
    await verifyBinaries(binDir, verify)
  }
}
