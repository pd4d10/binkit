#!/usr/bin/env node

import { createToolConfig } from './config.js'
import { generateToolPackages } from './generator.js'
import { toolConfigs } from './tools/index.js'

const args = process.argv.slice(2)

// Parse flags
function parseArgs(args: string[]): {
  toolName?: string
  version?: string
  download: boolean
  currentPlatformOnly: boolean
  help: boolean
} {
  const result = {
    toolName: undefined as string | undefined,
    version: undefined as string | undefined,
    download: false,
    currentPlatformOnly: false,
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') {
      result.help = true
    } else if (arg === '--download' || arg === '-d') {
      result.download = true
    } else if (arg === '--current-platform') {
      result.currentPlatformOnly = true
    } else if (!arg.startsWith('-')) {
      if (!result.toolName) {
        result.toolName = arg
      } else if (!result.version) {
        result.version = arg
      }
    }
  }

  return result
}

function showHelp() {
  console.log('BinKit - The Binary Toolkit')
  console.log('')
  console.log('USAGE')
  console.log('  binkit <tool-name> [version] [options]')
  console.log('')
  console.log('DESCRIPTION')
  console.log('  Generate packages for a new binary tool with platform-specific builds.')
  console.log('  Generated packages will be placed in the ./packages directory.')
  console.log('')
  console.log('ARGUMENTS')
  console.log('  <tool-name>     Name of the tool (e.g., ffmpeg, android-platform-tools)')
  console.log('  [version]       Package version (default: 0.1.0)')
  console.log('')
  console.log('OPTIONS')
  console.log('  -d, --download          Download binaries from configured URLs')
  console.log('  --current-platform      Only generate/download for current platform')
  console.log('  -h, --help              Show this help message')
  console.log('')
  console.log('PREDEFINED TOOLS')
  for (const toolName of Object.keys(toolConfigs)) {
    console.log(`  ${toolName}`)
  }
  console.log('')
  console.log('EXAMPLES')
  console.log('  binkit ffmpeg 0.1.0')
  console.log('    Generate @binkit/ffmpeg packages with version 0.1.0')
  console.log('')
  console.log('  binkit android-platform-tools --download --current-platform')
  console.log('    Generate and download Android platform tools for current platform')
  console.log('')
  console.log('GENERATED PACKAGES')
  console.log('  Main package:')
  console.log('    - @binkit/<tool-name>')
  console.log('')
  console.log('  Platform packages:')
  console.log('    - @binkit/<tool-name>-darwin-x64')
  console.log('    - @binkit/<tool-name>-darwin-arm64')
  console.log('    - @binkit/<tool-name>-linux-x64')
  console.log('    - @binkit/<tool-name>-linux-arm64')
  console.log('    - @binkit/<tool-name>-win32-x64')
  console.log('')
  console.log('WORKFLOW')
  console.log('  1. Run: binkit <tool-name> [version] [--download]')
  console.log('  2. (If not using --download) Add binaries to packages/<tool>-<platform>/bin/')
  console.log('  3. Publish: pnpm -r publish --filter "./packages/*"')
}

// Get predefined tool configuration
function getPredefinedConfig(toolName: string, version?: string) {
  const config = toolConfigs[toolName]
  if (!config) {
    return null
  }

  const downloads: Record<string, { url: string }> = {}
  for (const [platformId, url] of Object.entries(config.downloads)) {
    downloads[platformId] = { url }
  }

  return createToolConfig({
    toolName,
    version: version ?? config.version,
    binaries: config.binaries,
    downloads,
  })
}

async function main() {
  const { toolName, version, download, currentPlatformOnly, help } = parseArgs(args)

  if (help || !toolName) {
    showHelp()
    process.exit(help ? 0 : 1)
  }

  console.log(`Generating packages for ${toolName}${version ? '@' + version : ''}...`)
  console.log('')

  // Check for predefined config
  let config = getPredefinedConfig(toolName, version)
  if (!config) {
    config = createToolConfig({ toolName, version: version ?? '0.1.0' })
  }

  await generateToolPackages(config, {
    outputDir: './packages',
    force: true,
    download,
    currentPlatformOnly,
  })

  console.log('')
  console.log('✓ Successfully generated packages!')
  console.log('')
  if (!download) {
    console.log('Next steps:')
    console.log(`  1. Add binaries to packages/${toolName}-<platform>/bin/`)
    console.log(`  2. Add libraries to packages/${toolName}-<platform>/lib/`)
    console.log('  3. Publish: pnpm -r publish --filter "./packages/*"')
  } else {
    console.log('Next steps:')
    console.log('  Publish: pnpm -r publish --filter "./packages/*"')
  }
}

main().catch((error) => {
  console.error('Error:', error.message || error)
  process.exit(1)
})
