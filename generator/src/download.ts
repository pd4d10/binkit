import fs from 'node:fs/promises'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type { PlatformConfig, ToolConfig } from './config.js'
import type { VerifyCommands } from 'binkit-registry'

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
 * Get the executable extension for the current platform
 */
function getExeExtension(): string {
  return process.platform === 'win32' ? '.exe' : ''
}

/**
 * Extract zip contents to vendor directory and make binaries executable
 * @param zipPath - Path to the zip file
 * @param vendorDir - Destination vendor directory
 * @param binaryPaths - List of binary paths to make executable (relative to vendor dir)
 */
export async function extractToVendor(
  zipPath: string,
  vendorDir: string,
  binaryPaths: string[]
): Promise<void> {
  console.log(`  📦 Extracting to ${vendorDir}...`)

  try {
    // Use platform-appropriate unzip command
    if (process.platform === 'win32') {
      // Use PowerShell's Expand-Archive on Windows
      await execAsync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${vendorDir}' -Force"`)
    } else {
      // Use unzip on macOS/Linux
      await execAsync(`unzip -o -q "${zipPath}" -d "${vendorDir}"`)
    }

    // Make binaries executable
    const exeExt = getExeExtension()
    for (const binaryPath of binaryPaths) {
      const fullPath = path.join(vendorDir, binaryPath + exeExt)
      const pathWithoutExt = path.join(vendorDir, binaryPath)

      // Try with extension first, then without
      const targetPath = await fs.access(fullPath).then(() => fullPath).catch(() => pathWithoutExt)

      try {
        await fs.chmod(targetPath, 0o755)
      } catch {
        // Binary might not exist on this platform, ignore
      }
    }

    console.log(`  ✓ Extracted to ${vendorDir}`)
  } finally {
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
 * @param vendorDir - The vendor directory containing extracted files
 * @param commands - Commands to run (e.g., ['platform-tools/adb --version'])
 */
export async function verifyBinaries(
  vendorDir: string,
  commands: VerifyCommands
): Promise<void> {
  console.log(`  🔍 Verifying binaries...`)

  const exeExt = getExeExtension()

  for (const command of commands) {
    const [binaryPath, ...args] = command.split(' ')
    const binaryName = path.basename(binaryPath)
    const fullPath = path.join(vendorDir, binaryPath + exeExt)
    const pathWithoutExt = path.join(vendorDir, binaryPath)

    // Try with extension first, then without
    let targetPath: string | null = null
    if (await fs.access(fullPath).then(() => true).catch(() => false)) {
      targetPath = fullPath
    } else if (await fs.access(pathWithoutExt).then(() => true).catch(() => false)) {
      targetPath = pathWithoutExt
    }

    if (!targetPath) {
      throw new Error(`Binary not found: ${binaryPath}`)
    }

    const { code, output } = await runCommand(targetPath, args)
    const firstLine = output.trim().split('\n')[0]

    if (code === 0) {
      console.log(`    ✓ ${binaryName}: ${firstLine}`)
    } else {
      throw new Error(`Verification failed for ${binaryName} (exit code ${code}): ${firstLine}`)
    }
  }
}

/**
 * Download and extract files for a platform
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

  const vendorDir = path.join(packageDir, 'vendor')
  await fs.mkdir(vendorDir, { recursive: true })

  const zipPath = path.join(packageDir, 'download.zip')

  // Download the zip file
  await downloadFile(platform.download.url, zipPath)

  // Get binary paths from config
  const binaryPaths = config.binaries ?? [config.toolName]

  // Extract all files to vendor directory
  await extractToVendor(zipPath, vendorDir, binaryPaths)

  // Verify binaries if commands are provided
  if (verify && verify.length > 0) {
    await verifyBinaries(vendorDir, verify)
  }
}
