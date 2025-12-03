#!/usr/bin/env node

import { createToolConfig } from './config.js'
import { generateToolPackages } from './generator.js'

const args = process.argv.slice(2)

function showHelp() {
  console.log('BinKit - The Binary Toolkit')
  console.log('')
  console.log('USAGE')
  console.log('  binkit <tool-name> [version]')
  console.log('')
  console.log('DESCRIPTION')
  console.log('  Generate packages for a new binary tool with platform-specific builds.')
  console.log('  Generated packages will be placed in the ./packages directory.')
  console.log('')
  console.log('ARGUMENTS')
  console.log('  <tool-name>     Name of the tool (e.g., ffmpeg, adb)')
  console.log('  [version]       Package version (default: 0.1.0)')
  console.log('')
  console.log('EXAMPLES')
  console.log('  binkit ffmpeg 0.1.0')
  console.log('    Generate @binkit/ffmpeg packages with version 0.1.0')
  console.log('')
  console.log('  binkit adb')
  console.log('    Generate @binkit/adb packages with default version 0.1.0')
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
  console.log('  1. Run: binkit <tool-name> [version]')
  console.log('  2. Add real binaries to packages/<tool>-<platform>/bin/')
  console.log('  3. Add shared libraries to packages/<tool>-<platform>/lib/')
  console.log('  4. Publish: pnpm -r publish --filter "./packages/*"')
}

async function main() {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp()
    process.exit(0)
  }

  const toolName = args[0]
  const version = args[1] || '0.1.0'

  console.log(`Generating packages for ${toolName}@${version}...`)
  console.log('')

  const config = createToolConfig(toolName, version)
  await generateToolPackages(config, {
    outputDir: './packages',
    force: true,
  })

  console.log('')
  console.log('✓ Successfully generated packages!')
  console.log('')
  console.log('Next steps:')
  console.log(`  1. Add binaries to packages/${toolName}-<platform>/bin/`)
  console.log(`  2. Add libraries to packages/${toolName}-<platform>/lib/`)
  console.log('  3. Publish: pnpm -r publish --filter "./packages/*"')
}

main().catch((error) => {
  console.error('Error:', error.message || error)
  process.exit(1)
})
