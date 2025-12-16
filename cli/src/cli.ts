#!/usr/bin/env node

import { SCOPE } from './constants.js'
import { createToolConfig } from './config.js'
import { generateMain, generateTarget, getCurrentTarget } from './generator.js'
import { getPackageVersion, getUnpublishedVersions } from './npm.js'
import { entries, type EntryContext, type Target } from 'binkit-registry'

const args = process.argv.slice(2)

function createContext(version: string, target: Target): EntryContext {
  return { version, ...target }
}

function showHelp() {
  console.log('BinKit - The Binary Toolkit')
  console.log('')
  console.log('USAGE')
  console.log('  binkit <command> [arguments]')
  console.log('')
  console.log('COMMANDS')
  console.log('  check                                   Check for unpublished versions')
  console.log('  main   <tool-name> <upstream-version>   Generate main package only')
  console.log('  target <tool-name> <upstream-version>   Generate target package and test')
  console.log('')
  console.log('OPTIONS')
  console.log('  -h, --help      Show this help message')
  console.log('')
  console.log('PREDEFINED TOOLS')
  for (const [name, entry] of Object.entries(entries)) {
    const versions = entry.versions.join(', ')
    console.log(`  ${name} (${versions})`)
  }
  console.log('')
  console.log('EXAMPLES')
  console.log('  binkit check')
  console.log('    Check which versions need to be published')
  console.log('')
  console.log('  binkit target android-platform-tools 35.0.2')
  console.log('    Generate target package and download binaries for current target')
  console.log('')
  console.log('  binkit main android-platform-tools 35.0.2')
  console.log('    Generate main package only (no binaries)')
}

// Get predefined tool configuration
async function getPredefinedConfig(name: string, upstreamVersion: string) {
  const entry = entries[name]
  if (!entry) {
    return null
  }

  if (!entry.versions.includes(upstreamVersion)) {
    return null
  }

  // Calculate package version from npm registry
  console.log(`  📦 Querying npm for ${SCOPE}/${name}...`)
  const packageVersion = await getPackageVersion(name, upstreamVersion)
  console.log(`  📦 Calculated package version: ${packageVersion}`)
  console.log('')

  // Build downloads map from getConfig
  const downloads: Record<string, { url: string }> = {}
  for (const target of entry.targets) {
    const ctx = createContext(upstreamVersion, target)
    const config = entry.getConfig(ctx)
    const targetId = `${target.platform}-${target.arch}`
    downloads[targetId] = { url: config.downloadUrl }
  }

  // Use first target context for binaries/verify
  const ctx = createContext(upstreamVersion, entry.targets[0])
  const config = entry.getConfig(ctx)

  return createToolConfig({
    name,
    version: packageVersion,
    upstreamVersion,
    targets: entry.targets,
    stripPrefix: config.stripPrefix,
    binaries: config.binaries,
    downloads,
    verify: config.verify,
  })
}

async function main() {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    showHelp()
    process.exit(args.length === 0 ? 1 : 0)
  }

  const [command, name, upstreamVersion] = args

  // Handle check command (no additional arguments)
  if (command === 'check') {
    console.log('Checking for unpublished versions...')
    console.log('')
    const unpublished = await getUnpublishedVersions(entries)

    if (unpublished.length === 0) {
      console.log('✓ All versions are published')
      // Output empty JSON for CI
      console.log('')
      console.log('UNPUBLISHED_JSON=[]')
    } else {
      console.log('Unpublished versions:')
      for (const { tool, upstreamVersion: version } of unpublished) {
        console.log(`  - ${tool}@${version}`)
      }
      // Output JSON for CI matrix
      console.log('')
      console.log(`UNPUBLISHED_JSON=${JSON.stringify(unpublished)}`)
    }
    return
  }

  if (!command || !name || !upstreamVersion) {
    showHelp()
    process.exit(1)
  }

  if (command !== 'main' && command !== 'target') {
    console.error(`Unknown command: ${command}`)
    console.error('Available commands: check, main, target')
    process.exit(1)
  }

  // Get tool configuration
  const entry = entries[name]
  if (!entry) {
    console.error(`Unknown tool: ${name}`)
    console.error('Available tools:', Object.keys(entries).join(', '))
    process.exit(1)
  }

  const config = await getPredefinedConfig(name, upstreamVersion)
  if (!config) {
    console.error(`Unknown upstream version: ${upstreamVersion}`)
    console.error('Available versions:', entry.versions.join(', '))
    process.exit(1)
  }

  console.log(`BinKit: ${command} ${name}@${config.version} (upstream: ${upstreamVersion})`)
  console.log('')

  if (command === 'main') {
    await generateMain(config)
  } else {
    console.log(`Current target: ${getCurrentTarget()}`)
    console.log('')
    await generateTarget(config)
  }

  console.log('')
  console.log('✓ Done!')
}

main().catch((error) => {
  console.error('Error:', error.message || error)
  process.exit(1)
})
