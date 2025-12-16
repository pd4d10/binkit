import { AUTHOR, LICENSE, type ToolConfig, type PlatformConfig } from './config.js'

function parsePlatform(platformId: string): { os: string; arch: string } {
  const [os, arch] = platformId.split('-')
  return { os, arch }
}

/**
 * Convert a binary name to camelCase export name
 * e.g., "hprof-conv" -> "hprofConv", "make_f2fs" -> "makeF2fs"
 */
function toCamelCase(name: string): string {
  return name.replace(/[-_]([a-z0-9])/g, (_, char) => char.toUpperCase())
}

/**
 * Get the filename from a path
 * e.g., "platform-tools/adb" -> "adb"
 */
function getFilename(binaryPath: string): string {
  const parts = binaryPath.split('/')
  return parts[parts.length - 1]
}

interface BinaryInfo {
  /** Full path relative to zip root (e.g., "platform-tools/adb") */
  path: string
  /** Binary filename (e.g., "adb") */
  name: string
  /** Export name in camelCase (e.g., "hprofConv") */
  exportName: string
}

/**
 * Get the list of binaries for a tool
 * If no binaries are specified, use the tool name as the only binary
 */
function getBinaries(config: ToolConfig): BinaryInfo[] {
  if (config.binaries && config.binaries.length > 0) {
    return config.binaries.map((binaryPath) => {
      const name = getFilename(binaryPath)
      return {
        path: binaryPath,
        name,
        exportName: toCamelCase(name),
      }
    })
  }
  // Default: single binary with the tool name
  return [{
    path: config.toolName,
    name: config.toolName,
    exportName: toCamelCase(config.toolName),
  }]
}

/**
 * Generate package.json for the main tool package
 * No build scripts or typescript - dist files are pre-compiled
 */
export function generateMainPackageJson(config: ToolConfig): string {
  const { toolName, scope, version, platforms } = config
  const packageName = `${scope}/${toolName}`

  const optionalDependencies: Record<string, string> = {}
  for (const platform of platforms) {
    optionalDependencies[platform.npmPackageName] = 'workspace:^'
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
    keywords: ['binkit', toolName, 'binary', 'cli'],
    author: AUTHOR,
    license: LICENSE,
    dependencies: {
      '@binkit/runtime': 'workspace:^',
    },
    optionalDependencies,
  }

  return JSON.stringify(pkg, null, 2)
}

/**
 * Generate index.js for the main tool package
 * This is the compiled JavaScript that will be copied to dist/
 */
export function generateMainIndexJs(config: ToolConfig): string {
  const { toolName, platforms } = config
  const binaries = getBinaries(config)

  // Generate exports for each binary
  const binaryExports = binaries
    .map(
      (binary) => `/**
 * Binary runner for ${binary.name}.
 * Provides spawn, spawnSync, exec, execSync methods.
 */
export const ${binary.exportName} = createBinaryRunner(getBinaryPath('${binary.name}'));`
    )
    .join('\n\n')

  return `import path from 'node:path';
import { createRequire } from 'node:module';
import { getCurrentPlatform, createBinaryRunner } from '@binkit/runtime';

const require = createRequire(import.meta.url);

/**
 * Get the bin directory for the current platform
 * @returns Path to the bin directory
 */
function getBinDir() {
  const platformId = getCurrentPlatform();
  const platformPackages = {
${platforms.map((p) => `    '${p.platformId}': '${p.npmPackageName}',`).join('\n')}
  };

  const packageName = platformPackages[platformId];
  if (!packageName) {
    throw new Error(
      \`${capitalize(toolName)} binaries not found for platform: \${platformId}.\\n\` +
      \`Supported platforms: \${Object.keys(platformPackages).join(', ')}\`
    );
  }

  try {
    const packageJsonPath = require.resolve(packageName + '/package.json');
    return path.join(path.dirname(packageJsonPath), 'bin');
  } catch (error) {
    throw new Error(
      \`${capitalize(toolName)} binaries not found for platform: \${platformId}.\\n\` +
      \`Please ensure the platform-specific package is installed: \${packageName}\\n\` +
      \`If you're using npm/pnpm, optional dependencies might not have been installed.\\n\` +
      \`Try installing manually: npm install \${packageName}\\n\` +
      \`Error: \${error instanceof Error ? error.message : String(error)}\`
    );
  }
}

/**
 * Get the full path to a binary
 * @param name - Binary name (without extension)
 * @returns Full path to the binary
 */
function getBinaryPath(name) {
  const binDir = getBinDir();
  const extension = process.platform === 'win32' ? '.exe' : '';
  return path.join(binDir, name + extension);
}

${binaryExports}
`
}

/**
 * Generate index.d.ts for the main tool package
 * TypeScript type definitions
 */
export function generateMainIndexDts(config: ToolConfig): string {
  const binaries = getBinaries(config)

  // Generate export declarations for each binary
  const exportDeclarations = binaries
    .map(
      (binary) => `/**
 * Binary runner for ${binary.name}.
 * Provides spawn, spawnSync, exec, execSync methods.
 */
export declare const ${binary.exportName}: BinaryRunner;`
    )
    .join('\n\n')

  return `export type { BinaryRunner } from '@binkit/runtime';
import type { BinaryRunner } from '@binkit/runtime';

${exportDeclarations}
`
}

/**
 * Generate package.json for a platform-specific package
 * Platform packages are just binary containers - no JS code needed
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
    files: ['bin', 'lib'],
    os: [os],
    cpu: [arch],
    keywords: ['binkit', toolName, 'binary', os, arch],
    author: AUTHOR,
    license: LICENSE,
  }

  return JSON.stringify(pkg, null, 2)
}

/**
 * Generate README.md for a platform-specific package
 */
export function generatePlatformReadme(
  config: ToolConfig,
  platform: PlatformConfig
): string {
  const { toolName, scope } = config
  const mainPackageName = `${scope}/${toolName}`

  return `# ${platform.npmPackageName}

This is a platform-specific binary package for [${mainPackageName}](https://www.npmjs.com/package/${mainPackageName}).

**Do not install this package directly.** Instead, install the main package:

\`\`\`bash
npm install ${mainPackageName}
\`\`\`

The main package will automatically select and install the correct binary for your platform.
`
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
