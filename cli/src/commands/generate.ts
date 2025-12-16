/**
 * Generate commands - creates main and target packages
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { exec, spawn, execSync } from 'node:child_process'
import { promisify } from 'node:util'
import { entries, type EntryConfig } from 'binkit-registry'
import { SCOPE, FRAMEWORK_MAJOR_VERSION } from '../constants.js'
import {
  type ToolConfig,
  generateMainPackageJson,
  generateMainIndexJs,
  generateMainIndexDts,
  generateMainTestJs,
  generateTargetPackageJson,
  generateTargetReadme,
} from '../templates.js'

const execAsync = promisify(exec)

// ============================================================================
// Public API
// ============================================================================

export function getCurrentTarget(): string {
  return `${process.platform}-${process.arch}`
}

/**
 * Generate main package only (for CI publish-main job)
 */
export async function runGenerateMain(name: string, upstreamVersion: string): Promise<void> {
  const config = await resolveToolConfig(name, upstreamVersion)

  console.log(`BinKit: main ${name}@${config.packageVersion} (upstream: ${upstreamVersion})`)
  console.log('')

  await writeMainPackage(config)

  console.log('')
  console.log('✓ Done!')
}

/**
 * Generate target package with binaries (for CI build job on each platform)
 */
export async function runGenerateTarget(name: string, upstreamVersion: string): Promise<void> {
  const config = await resolveToolConfig(name, upstreamVersion)
  const currentTarget = getCurrentTarget()
  const target = config.entry.targets.find((t) => `${t.platform}-${t.arch}` === currentTarget)

  if (!target) {
    console.log(`⚠ Target ${currentTarget} is not configured for ${name}`)
    return
  }

  console.log(`BinKit: target ${name}@${config.packageVersion} (upstream: ${upstreamVersion})`)
  console.log('')
  console.log(`Current target: ${currentTarget}`)
  console.log('')

  // Generate main package first (needed for workspace and tests)
  await writeMainPackage(config)

  // Generate target package
  const targetPackageDir = path.join('./packages', `${name}-${currentTarget}`)

  await fs.rm(targetPackageDir, { recursive: true, force: true })
  await fs.mkdir(path.join(targetPackageDir, 'vendor'), { recursive: true })

  await fs.writeFile(path.join(targetPackageDir, 'package.json'), generateTargetPackageJson(config, target))
  await fs.writeFile(path.join(targetPackageDir, 'README.md'), generateTargetReadme(config, target))
  console.log(`  ✓ Generated target package: ${name}-${currentTarget}`)

  // Download and extract binaries
  const targetConfig = config.entry.getConfig({ version: upstreamVersion, ...target })
  await downloadAndExtract(targetPackageDir, targetConfig, name)

  // Install workspace dependencies
  console.log('  📦 Installing workspace dependencies...')
  execSync('pnpm install --force', { cwd: './packages', stdio: 'inherit' })

  console.log('')
  console.log('✓ Done!')
}

// ============================================================================
// Shared Helpers
// ============================================================================

async function resolveToolConfig(name: string, upstreamVersion: string): Promise<ToolConfig> {
  const entry = entries[name]
  if (!entry) {
    throw new Error(`Unknown tool: ${name}. Available: ${Object.keys(entries).join(', ')}`)
  }

  if (!entry.versions.includes(upstreamVersion)) {
    throw new Error(`Unknown version: ${upstreamVersion}. Available: ${entry.versions.join(', ')}`)
  }

  // Calculate package version from npm registry
  console.log(`  📦 Querying npm for ${SCOPE}/${name}...`)
  const packageVersion = await calculatePackageVersion(name, upstreamVersion)
  console.log(`  📦 Calculated package version: ${packageVersion}`)
  console.log('')

  // Get entry config from first target (binaries/verify are same across targets)
  const entryConfig = entry.getConfig({ version: upstreamVersion, ...entry.targets[0] })

  return { name, upstreamVersion, packageVersion, entry, entryConfig }
}

/**
 * Write main package files to disk
 */
async function writeMainPackage(config: ToolConfig): Promise<void> {
  const { name } = config
  const packageDir = path.join('./packages', name)

  await fs.rm(packageDir, { recursive: true, force: true })
  await fs.mkdir(path.join(packageDir, 'dist'), { recursive: true })

  await fs.writeFile(path.join(packageDir, 'package.json'), generateMainPackageJson(config))
  await fs.writeFile(path.join(packageDir, 'dist', 'index.js'), generateMainIndexJs(config))
  await fs.writeFile(path.join(packageDir, 'dist', 'index.d.ts'), generateMainIndexDts(config))
  await fs.writeFile(path.join(packageDir, 'dist', 'index.test.js'), generateMainTestJs(config))

  console.log(`  ✓ Generated main package: ${name}`)
}

// ============================================================================
// NPM Version Calculation
// ============================================================================

async function calculatePackageVersion(name: string, upstreamVersion: string): Promise<string> {
  const url = `https://registry.npmjs.org/${SCOPE}/${name}`
  let publishedVersions: string[] = []

  try {
    const response = await fetch(url)
    if (response.ok) {
      const data = (await response.json()) as { versions: Record<string, unknown> }
      publishedVersions = Object.keys(data.versions)
    }
  } catch {
    // Network error - assume no versions published
  }

  // Version format: {FRAMEWORK_MAJOR}.{upstream-major}.{patch}
  const upstreamMajor = upstreamVersion.split('.')[0]
  const prefix = `${FRAMEWORK_MAJOR_VERSION}.${upstreamMajor}.`
  const matchingVersions = publishedVersions.filter((v) => v.startsWith(prefix))

  if (matchingVersions.length === 0) {
    return `${FRAMEWORK_MAJOR_VERSION}.${upstreamMajor}.0`
  }

  const patches = matchingVersions.map((v) => parseInt(v.slice(prefix.length), 10))
  return `${FRAMEWORK_MAJOR_VERSION}.${upstreamMajor}.${Math.max(...patches) + 1}`
}

// ============================================================================
// Download & Extract
// ============================================================================

async function downloadAndExtract(
  packageDir: string,
  config: EntryConfig,
  toolName: string
): Promise<void> {
  const vendorDir = path.join(packageDir, 'vendor')
  const zipPath = path.join(packageDir, 'download.zip')

  // Download
  console.log(`  ↓ Downloading from ${config.downloadUrl}...`)
  const response = await fetch(config.downloadUrl)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
  }
  await pipeline(response.body, createWriteStream(zipPath))
  console.log(`  ✓ Downloaded`)

  // Extract
  console.log(`  📦 Extracting...`)
  if (process.platform === 'win32') {
    await execAsync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${vendorDir}' -Force"`)
  } else {
    await execAsync(`unzip -o -q "${zipPath}" -d "${vendorDir}"`)
  }

  // Strip prefix if needed (move files from prefix dir to vendor root)
  if (config.stripPrefix) {
    const prefixDir = path.join(vendorDir, config.stripPrefix)
    for (const entry of await fs.readdir(prefixDir)) {
      await fs.rename(path.join(prefixDir, entry), path.join(vendorDir, entry))
    }
    await fs.rmdir(prefixDir)
  }

  // Make binaries executable
  const binaries = config.binaries ?? [toolName]
  const exeExt = process.platform === 'win32' ? '.exe' : ''
  for (const binary of binaries) {
    const fullPath = path.join(vendorDir, binary + exeExt)
    const pathWithoutExt = path.join(vendorDir, binary)
    try {
      const targetPath = await fs.access(fullPath).then(() => fullPath).catch(() => pathWithoutExt)
      await fs.chmod(targetPath, 0o755)
    } catch {
      // Binary might not exist on this platform
    }
  }

  // Cleanup zip
  await fs.rm(zipPath, { force: true })
  console.log(`  ✓ Extracted`)

  // Verify binaries if specified
  if (config.verify && config.verify.length > 0) {
    console.log(`  🔍 Verifying binaries...`)
    for (const cmd of config.verify) {
      const [binaryPath, ...args] = cmd.split(' ')
      const binaryName = path.basename(binaryPath)
      const fullPath = path.join(vendorDir, binaryPath + exeExt)
      const targetPath = await fs.access(fullPath).then(() => fullPath).catch(() => path.join(vendorDir, binaryPath))

      const { code, output } = await runCommand(targetPath, args)
      const firstLine = output.trim().split('\n')[0]

      if (code === 0) {
        console.log(`    ✓ ${binaryName}: ${firstLine}`)
      } else {
        throw new Error(`Verification failed for ${binaryName} (exit code ${code}): ${firstLine}`)
      }
    }
  }
}

function runCommand(binaryPath: string, args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(binaryPath, args)
    let output = ''
    child.stdout.on('data', (data) => { output += data.toString() })
    child.stderr.on('data', (data) => { output += data.toString() })
    child.on('close', (code) => { resolve({ code: code ?? 1, output }) })
  })
}
