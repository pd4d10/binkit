import fs from 'node:fs/promises'
import path from 'node:path'
import type { ToolConfig, PlatformConfig } from './config.js'
import {
  generateMainPackageJson,
  generateMainIndexJs,
  generateMainIndexDts,
  generatePlatformPackageJson,
} from './templates.js'
import { downloadAndExtractPlatform } from './download.js'

export interface GenerateOptions {
  /** Root directory where packages should be generated (default: './packages') */
  outputDir?: string
  /** Whether to overwrite existing files (default: false) */
  force?: boolean
  /** Whether to download binaries (default: false) */
  download?: boolean
  /** Only download for the current platform (default: false) */
  currentPlatformOnly?: boolean
}

/**
 * Get the current platform identifier
 */
function getCurrentPlatform(): string {
  return `${process.platform}-${process.arch}`
}

/**
 * Generate all packages for a tool
 */
export async function generateToolPackages(
  config: ToolConfig,
  options: GenerateOptions = {}
): Promise<void> {
  const { outputDir = './packages', force = false, download = false, currentPlatformOnly = false } = options

  console.log(`Generating packages for ${config.toolName}...`)

  // Ensure output directory and workspace files exist
  await ensureDir(outputDir)
  await generateWorkspaceFiles(outputDir, force)

  // Generate main package
  await generateMainPackage(config, outputDir, force)

  const currentPlatform = getCurrentPlatform()

  // Generate platform packages
  for (const platform of config.platforms) {
    // Skip platforms that don't match current if currentPlatformOnly is true
    if (currentPlatformOnly && platform.platformId !== currentPlatform) {
      continue
    }

    await generatePlatformPackage(config, platform, outputDir, force)

    // Download binaries if requested and download URL is configured
    if (download && platform.download?.url) {
      const packageDir = path.join(outputDir, `${config.toolName}-${platform.platformId}`)
      await downloadAndExtractPlatform(config, platform, packageDir, config.verify)
    }
  }

  console.log(`✓ Successfully generated packages for ${config.toolName}`)
}

/**
 * Generate pnpm-workspace.yaml and package.json in the output directory
 */
async function generateWorkspaceFiles(
  outputDir: string,
  force: boolean
): Promise<void> {
  // Generate pnpm-workspace.yaml
  await writeFile(
    path.join(outputDir, 'pnpm-workspace.yaml'),
    'packages:\n  - "*"\n',
    force
  )

  // Generate minimal package.json
  const pkg = {
    name: 'binkit-packages',
    version: '0.1.0',
    private: true,
    scripts: {
      publish: 'pnpm -r publish --access public',
    },
  }
  await writeFile(
    path.join(outputDir, 'package.json'),
    JSON.stringify(pkg, null, 2),
    force
  )
}

/**
 * Generate the main tool package
 */
async function generateMainPackage(
  config: ToolConfig,
  outputDir: string,
  force: boolean
): Promise<void> {
  const { toolName } = config
  const packageDir = path.join(outputDir, toolName)

  // Create directory structure
  await ensureDir(packageDir)
  await ensureDir(path.join(packageDir, 'dist'))

  // Generate files
  await writeFile(
    path.join(packageDir, 'package.json'),
    generateMainPackageJson(config),
    force
  )

  // Write pre-compiled JavaScript and type definitions
  await writeFile(
    path.join(packageDir, 'dist', 'index.js'),
    generateMainIndexJs(config),
    force
  )

  await writeFile(
    path.join(packageDir, 'dist', 'index.d.ts'),
    generateMainIndexDts(config),
    force
  )

  console.log(`  ✓ Generated main package: ${toolName}`)
}

/**
 * Generate a platform-specific package
 * Platform packages are just binary containers - no JS code needed
 */
async function generatePlatformPackage(
  config: ToolConfig,
  platform: PlatformConfig,
  outputDir: string,
  force: boolean
): Promise<void> {
  const { toolName } = config
  const platformSuffix = platform.platformId
  const packageName = `${toolName}-${platformSuffix}`
  const packageDir = path.join(outputDir, packageName)

  // Create directory structure (bin and lib for binaries)
  await ensureDir(packageDir)
  await ensureDir(path.join(packageDir, 'bin'))
  await ensureDir(path.join(packageDir, 'lib'))

  // Generate package.json only
  await writeFile(
    path.join(packageDir, 'package.json'),
    generatePlatformPackageJson(config, platform),
    force
  )

  console.log(`  ✓ Generated platform package: ${packageName}`)
}

/**
 * Ensure a directory exists
 */
async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

/**
 * Write a file
 */
async function writeFile(
  filePath: string,
  content: string,
  force: boolean
): Promise<void> {
  const exists = await fs
    .access(filePath)
    .then(() => true)
    .catch(() => false)

  if (exists && !force) {
    console.log(`  ⚠ Skipping existing file: ${filePath}`)
    return
  }

  await fs.writeFile(filePath, content, 'utf-8')
}
