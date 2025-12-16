import fs from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'
import type { ToolConfig, PlatformConfig } from './config.js'
import {
  generateMainPackageJson,
  generateMainIndexJs,
  generateMainIndexDts,
  generateMainTestJs,
  generatePlatformPackageJson,
  generatePlatformReadme,
} from './templates.js'
import { downloadAndExtractPlatform } from './download.js'

/**
 * Get the current platform identifier
 */
export function getCurrentPlatform(): string {
  return `${process.platform}-${process.arch}`
}

/**
 * Generate the main tool package only
 * Used by CI to publish main package separately
 */
export async function generateMain(
  config: ToolConfig,
  outputDir = './packages'
): Promise<void> {
  console.log(`Generating main package for ${config.toolName}...`)

  const { toolName } = config
  const packageDir = path.join(outputDir, toolName)

  // Clean and recreate package directory
  await cleanDir(packageDir)
  await ensureDir(packageDir)
  await ensureDir(path.join(packageDir, 'dist'))

  // Generate files
  await writeFile(path.join(packageDir, 'package.json'), generateMainPackageJson(config))
  await writeFile(path.join(packageDir, 'dist', 'index.js'), generateMainIndexJs(config))
  await writeFile(path.join(packageDir, 'dist', 'index.d.ts'), generateMainIndexDts(config))
  await writeFile(path.join(packageDir, 'dist', 'index.test.js'), generateMainTestJs(config))

  console.log(`✓ Generated main package: ${toolName}`)
}

/**
 * Generate platform package, download binaries, and run tests
 * Used by CI on each platform runner
 */
export async function generatePlatform(
  config: ToolConfig,
  outputDir = './packages'
): Promise<void> {
  const currentPlatform = getCurrentPlatform()
  const platform = config.platforms.find((p) => p.platformId === currentPlatform)

  if (!platform) {
    console.log(`⚠ Platform ${currentPlatform} is not configured for ${config.toolName}`)
    return
  }

  if (!platform.download?.url) {
    console.log(`⚠ No download URL configured for ${currentPlatform}`)
    return
  }

  console.log(`Generating platform package for ${config.toolName} (${currentPlatform})...`)

  // Generate main package (needed for workspace and tests)
  const mainPackageDir = path.join(outputDir, config.toolName)
  await cleanDir(mainPackageDir)
  await ensureDir(mainPackageDir)
  await ensureDir(path.join(mainPackageDir, 'dist'))
  await writeFile(path.join(mainPackageDir, 'package.json'), generateMainPackageJson(config))
  await writeFile(path.join(mainPackageDir, 'dist', 'index.js'), generateMainIndexJs(config))
  await writeFile(path.join(mainPackageDir, 'dist', 'index.d.ts'), generateMainIndexDts(config))
  await writeFile(path.join(mainPackageDir, 'dist', 'index.test.js'), generateMainTestJs(config))
  console.log(`  ✓ Generated main package: ${config.toolName}`)

  // Generate platform package
  const platformPackageName = `${config.toolName}-${currentPlatform}`
  const platformPackageDir = path.join(outputDir, platformPackageName)

  await cleanDir(platformPackageDir)
  await ensureDir(platformPackageDir)
  await ensureDir(path.join(platformPackageDir, 'vendor'))

  await writeFile(
    path.join(platformPackageDir, 'package.json'),
    generatePlatformPackageJson(config, platform)
  )
  await writeFile(path.join(platformPackageDir, 'README.md'), generatePlatformReadme(config, platform))
  console.log(`  ✓ Generated platform package: ${platformPackageName}`)

  // Download and extract binaries
  await downloadAndExtractPlatform(config, platform, platformPackageDir, config.verify)

  // Install workspace dependencies
  console.log('  📦 Installing workspace dependencies...')
  execSync('pnpm install --force', { cwd: outputDir, stdio: 'inherit' })

  console.log(`✓ Successfully generated platform package for ${currentPlatform}`)
}

/**
 * Ensure a directory exists
 */
async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

/**
 * Clean a directory (remove if exists)
 */
async function cleanDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // Directory doesn't exist, ignore
  }
}

/**
 * Write a file
 */
async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8')
}
