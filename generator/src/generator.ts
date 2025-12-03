import fs from 'node:fs/promises'
import path from 'node:path'
import type { ToolConfig, PlatformConfig } from './config.js'
import {
  generateMainPackageJson,
  generateMainIndexJs,
  generateMainIndexDts,
  generatePlatformPackageJson,
  generatePlatformIndexJs,
  generatePlatformIndexDts,
} from './templates.js'

export interface GenerateOptions {
  /** Root directory where packages should be generated (default: './packages') */
  outputDir?: string
  /** Whether to overwrite existing files (default: false) */
  force?: boolean
}

/**
 * Generate all packages for a tool
 */
export async function generateToolPackages(
  config: ToolConfig,
  options: GenerateOptions = {}
): Promise<void> {
  const { outputDir = './packages', force = false } = options

  console.log(`Generating packages for ${config.toolName}...`)

  // Ensure output directory and workspace files exist
  await ensureDir(outputDir)
  await generateWorkspaceFiles(outputDir, force)

  // Generate main package
  await generateMainPackage(config, outputDir, force)

  // Generate platform packages
  for (const platform of config.platforms) {
    await generatePlatformPackage(config, platform, outputDir, force)
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

  // Create directory structure
  await ensureDir(packageDir)
  await ensureDir(path.join(packageDir, 'dist'))
  await ensureDir(path.join(packageDir, 'bin'))
  await ensureDir(path.join(packageDir, 'lib'))

  // Generate files
  await writeFile(
    path.join(packageDir, 'package.json'),
    generatePlatformPackageJson(config, platform),
    force
  )

  // Write pre-compiled JavaScript and type definitions
  await writeFile(
    path.join(packageDir, 'dist', 'index.js'),
    generatePlatformIndexJs(config, platform),
    force
  )

  await writeFile(
    path.join(packageDir, 'dist', 'index.d.ts'),
    generatePlatformIndexDts(config, platform),
    force
  )

  // Create placeholder binary
  const extension = platform.platformId.startsWith('win32') ? '.exe' : ''
  const binaryPath = path.join(packageDir, 'bin', `${toolName}${extension}`)
  await writeFile(
    binaryPath,
    '#!/bin/sh\necho "This is a placeholder binary for ' +
      toolName +
      ' on ' +
      platform.platformId +
      '"\n',
    force
  )

  // Make binary executable on Unix-like systems
  if (!platform.platformId.startsWith('win32')) {
    await fs.chmod(binaryPath, 0o755)
  }

  // Create a placeholder README in lib directory
  await writeFile(
    path.join(packageDir, 'lib', 'README.md'),
    `# Shared Libraries\n\nThis directory contains shared libraries (.so, .dylib, or .dll files) for ${toolName}.\n`,
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
