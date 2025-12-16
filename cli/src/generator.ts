import fs from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'
import type { ToolConfig } from './config.js'
import { getTargetId } from './config.js'
import {
  generateMainPackageJson,
  generateMainIndexJs,
  generateMainIndexDts,
  generateMainTestJs,
  generateTargetPackageJson,
  generateTargetReadme,
} from './templates.js'
import { downloadAndExtractTarget } from './download.js'

/**
 * Get the current target identifier
 */
export function getCurrentTarget(): string {
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
  console.log(`Generating main package for ${config.name}...`)

  const { name } = config
  const packageDir = path.join(outputDir, name)

  // Clean and recreate package directory
  await cleanDir(packageDir)
  await ensureDir(packageDir)
  await ensureDir(path.join(packageDir, 'dist'))

  // Generate files
  await writeFile(path.join(packageDir, 'package.json'), generateMainPackageJson(config))
  await writeFile(path.join(packageDir, 'dist', 'index.js'), generateMainIndexJs(config))
  await writeFile(path.join(packageDir, 'dist', 'index.d.ts'), generateMainIndexDts(config))
  await writeFile(path.join(packageDir, 'dist', 'index.test.js'), generateMainTestJs(config))

  console.log(`✓ Generated main package: ${name}`)
}

/**
 * Generate target package, download binaries, and run tests
 * Used by CI on each target runner
 */
export async function generateTarget(
  config: ToolConfig,
  outputDir = './packages'
): Promise<void> {
  const currentTarget = getCurrentTarget()
  const target = config.targets.find((t) => getTargetId(t) === currentTarget)

  if (!target) {
    console.log(`⚠ Target ${currentTarget} is not configured for ${config.name}`)
    return
  }

  if (!target.download?.url) {
    console.log(`⚠ No download URL configured for ${currentTarget}`)
    return
  }

  console.log(`Generating target package for ${config.name} (${currentTarget})...`)

  // Generate main package (needed for workspace and tests)
  const mainPackageDir = path.join(outputDir, config.name)
  await cleanDir(mainPackageDir)
  await ensureDir(mainPackageDir)
  await ensureDir(path.join(mainPackageDir, 'dist'))
  await writeFile(path.join(mainPackageDir, 'package.json'), generateMainPackageJson(config))
  await writeFile(path.join(mainPackageDir, 'dist', 'index.js'), generateMainIndexJs(config))
  await writeFile(path.join(mainPackageDir, 'dist', 'index.d.ts'), generateMainIndexDts(config))
  await writeFile(path.join(mainPackageDir, 'dist', 'index.test.js'), generateMainTestJs(config))
  console.log(`  ✓ Generated main package: ${config.name}`)

  // Generate target package
  const targetPackageName = `${config.name}-${currentTarget}`
  const targetPackageDir = path.join(outputDir, targetPackageName)

  await cleanDir(targetPackageDir)
  await ensureDir(targetPackageDir)
  await ensureDir(path.join(targetPackageDir, 'vendor'))

  await writeFile(
    path.join(targetPackageDir, 'package.json'),
    generateTargetPackageJson(config, target)
  )
  await writeFile(path.join(targetPackageDir, 'README.md'), generateTargetReadme(config, target))
  console.log(`  ✓ Generated target package: ${targetPackageName}`)

  // Download and extract binaries
  await downloadAndExtractTarget(config, target, targetPackageDir, config.verify)

  // Install workspace dependencies
  console.log('  📦 Installing workspace dependencies...')
  execSync('pnpm install --force', { cwd: outputDir, stdio: 'inherit' })

  console.log(`✓ Successfully generated target package for ${currentTarget}`)
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
