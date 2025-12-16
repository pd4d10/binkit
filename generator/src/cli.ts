#!/usr/bin/env node

import { createToolConfig } from './config.js'
import { generateMain, generatePlatform, getCurrentPlatform } from './generator.js'
import { entries } from 'binkit-registry'

const args = process.argv.slice(2)

function showHelp() {
  console.log('BinKit - The Binary Toolkit')
  console.log('')
  console.log('USAGE')
  console.log('  binkit <command> <tool-name> <version>')
  console.log('')
  console.log('COMMANDS')
  console.log('  main        Generate main package only (for publishing)')
  console.log('  platform    Generate platform package, download binaries, and test')
  console.log('')
  console.log('ARGUMENTS')
  console.log('  <tool-name>     Name of the tool (e.g., android-platform-tools)')
  console.log('  <version>       Package version (e.g., 1.35.0)')
  console.log('')
  console.log('OPTIONS')
  console.log('  -h, --help      Show this help message')
  console.log('')
  console.log('PREDEFINED TOOLS')
  for (const toolName of Object.keys(entries)) {
    console.log(`  ${toolName}`)
  }
  console.log('')
  console.log('EXAMPLES')
  console.log('  binkit platform android-platform-tools 1.35.0')
  console.log('    Generate platform package and download binaries for current platform')
  console.log('')
  console.log('  binkit main android-platform-tools 1.35.0')
  console.log('    Generate main package only (no binaries)')
}

// Get predefined tool configuration
function getPredefinedConfig(toolName: string, version: string) {
  const config = entries[toolName]
  if (!config) {
    return null
  }

  const downloads: Record<string, { url: string }> = {}
  for (const [platformId, url] of Object.entries(config.downloads)) {
    downloads[platformId] = { url }
  }

  return createToolConfig({
    toolName,
    version,
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

  const [command, toolName, version] = args

  if (!command || !toolName || !version) {
    showHelp()
    process.exit(1)
  }

  if (command !== 'main' && command !== 'platform') {
    console.error(`Unknown command: ${command}`)
    console.error('Available commands: main, platform')
    process.exit(1)
  }

  // Get tool configuration
  const config = getPredefinedConfig(toolName, version)
  if (!config) {
    console.error(`Unknown tool: ${toolName}`)
    console.error('Available tools:', Object.keys(entries).join(', '))
    process.exit(1)
  }

  console.log(`BinKit: ${command} ${toolName}@${version}`)
  console.log('')

  if (command === 'main') {
    await generateMain(config)
  } else {
    console.log(`Current platform: ${getCurrentPlatform()}`)
    console.log('')
    await generatePlatform(config)
  }

  console.log('')
  console.log('✓ Done!')
}

main().catch((error) => {
  console.error('Error:', error.message || error)
  process.exit(1)
})
