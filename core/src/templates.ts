import type { ToolConfig, PlatformConfig } from './config.js'
import { parsePlatform } from './platform.js'

/**
 * Generate package.json for the main tool package
 */
export function generateMainPackageJson(config: ToolConfig): string {
  const { toolName, scope, version, platforms } = config
  const packageName = `${scope}/${toolName}`

  const optionalDependencies: Record<string, string> = {}
  for (const platform of platforms) {
    optionalDependencies[platform.npmPackageName] = version
  }

  const pkg = {
    name: packageName,
    version,
    description: `BinKit ${toolName} - Cross-platform ${toolName} binary`,
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
      },
    },
    files: ['dist'],
    scripts: {
      build: 'tsc',
      clean: 'rm -rf dist',
    },
    keywords: ['binkit', toolName, 'binary', 'cli'],
    author: '',
    license: 'MIT',
    dependencies: {
      'binkit': 'workspace:*',
    },
    optionalDependencies,
    devDependencies: {
      '@types/node': '^22.10.1',
      typescript: '^5.7.2',
    },
  }

  return JSON.stringify(pkg, null, 2)
}

/**
 * Generate index.ts for the main tool package
 */
export function generateMainIndexTs(config: ToolConfig): string {
  const { toolName, platforms } = config

  return `import { getCurrentPlatform, runBinary, type RunOptions } from 'binkit'

export interface ${capitalize(toolName)}RunOptions extends RunOptions {
  args: string[]
}

/**
 * Load the native binary for the current platform
 * @returns Path to the binary
 */
function loadNativeBinary(): string {
  const platformId = getCurrentPlatform()
  const platformPackages: Record<string, string> = {
${platforms.map((p) => `    '${p.platformId}': '${p.npmPackageName}',`).join('\n')}
  }

  const packageName = platformPackages[platformId]
  if (!packageName) {
    throw new Error(
      \`${capitalize(toolName)} binary not found for platform: \${platformId}.\\n\` +
      \`Supported platforms: \${Object.keys(platformPackages).join(', ')}\`
    )
  }

  // Try to load the platform-specific package
  try {
    // Use require for CommonJS compatibility
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const platformModule = require(packageName)

    if (platformModule?.binaryPath) {
      return platformModule.binaryPath
    }

    throw new Error(\`Package \${packageName} does not export binaryPath\`)
  } catch (error) {
    throw new Error(
      \`${capitalize(toolName)} binary not found for platform: \${platformId}.\\n\` +
      \`Please ensure the platform-specific package is installed: \${packageName}\\n\` +
      \`If you're using npm/pnpm, optional dependencies might not have been installed.\\n\` +
      \`Try installing manually: npm install \${packageName}\\n\` +
      \`Error: \${error instanceof Error ? error.message : String(error)}\`
    )
  }
}

/**
 * Run ${toolName} with the given arguments
 * @param options - Run options including arguments
 * @returns Promise that resolves to the exit code
 */
export async function run${capitalize(toolName)}(options: ${capitalize(toolName)}RunOptions): Promise<number> {
  const binaryPath = loadNativeBinary()
  const { args, ...runOptions } = options
  const result = await runBinary(binaryPath, args, runOptions)
  return result.exitCode
}
`
}

/**
 * Generate package.json for a platform-specific package
 */
export function generatePlatformPackageJson(
  config: ToolConfig,
  platform: PlatformConfig
): string {
  const { toolName, version } = config
  const { os, arch } = parsePlatform(platform.platformId)

  const pkg = {
    name: platform.npmPackageName,
    version,
    description: `${capitalize(toolName)} binary for ${os}-${arch}`,
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
      },
    },
    files: ['dist', 'bin', 'lib'],
    scripts: {
      build: 'tsc',
      clean: 'rm -rf dist',
    },
    os: [os],
    cpu: [arch],
    keywords: ['binkit', toolName, 'binary', os, arch],
    author: '',
    license: 'MIT',
    devDependencies: {
      '@types/node': '^22.10.1',
      typescript: '^5.7.2',
    },
  }

  return JSON.stringify(pkg, null, 2)
}

/**
 * Generate index.ts for a platform-specific package
 */
export function generatePlatformIndexTs(
  config: ToolConfig,
  platform: PlatformConfig
): string {
  const { toolName } = config
  const extension = platform.platformId.startsWith('win32') ? '.exe' : ''

  return `import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Path to the ${toolName} binary for this platform
 */
export const binaryPath = path.join(__dirname, '..', 'bin', '${toolName}${extension}')

/**
 * Path to the lib directory containing shared libraries
 */
export const libPath = path.join(__dirname, '..', 'lib')
`
}

/**
 * Generate tsconfig.json for any package
 */
export function generateTsConfig(): string {
  return JSON.stringify(
    {
      extends: '../../tsconfig.json',
      compilerOptions: {
        rootDir: './src',
        outDir: './dist',
      },
      include: ['src/**/*'],
    },
    null,
    2
  )
}


/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
