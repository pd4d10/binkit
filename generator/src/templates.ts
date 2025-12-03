import { AUTHOR, LICENSE, type ToolConfig, type PlatformConfig } from './config.js'

function parsePlatform(platformId: string): { os: string; arch: string } {
  const [os, arch] = platformId.split('-')
  return { os, arch }
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
    keywords: ['binkit', toolName, 'binary', 'cli'],
    author: AUTHOR,
    license: LICENSE,
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

  return `import { spawn } from 'node:child_process';
import path from 'node:path';

/**
 * Get the current platform identifier
 * @returns PlatformId in format <os>-<arch>
 */
function getCurrentPlatform() {
  return \`\${process.platform}-\${process.arch}\`;
}

/**
 * Get library path environment variable name for the current platform
 * @returns Environment variable name for library path
 */
function getLibraryPathEnvVar() {
  const platform = process.platform;
  switch (platform) {
    case 'darwin':
      return 'DYLD_LIBRARY_PATH';
    case 'win32':
      return 'PATH';
    default:
      return 'LD_LIBRARY_PATH';
  }
}

/**
 * Run a binary with the given arguments and options
 * Automatically configures environment variables for library paths
 */
async function runBinary(binaryPath, args = [], options = {}) {
  const { cwd, env = {}, stdio = 'inherit' } = options;

  const binaryDir = path.dirname(binaryPath);
  const libDir = path.join(path.dirname(binaryDir), 'lib');

  const libPathEnvVar = getLibraryPathEnvVar();
  const envVars = {
    ...process.env,
    ...env,
    PATH: \`\${binaryDir}\${path.delimiter}\${env.PATH || process.env.PATH || ''}\`,
  };

  if (libPathEnvVar === 'PATH') {
    envVars.PATH = \`\${libDir}\${path.delimiter}\${envVars.PATH}\`;
  } else {
    const existingLibPath = env[libPathEnvVar] || process.env[libPathEnvVar] || '';
    envVars[libPathEnvVar] = existingLibPath
      ? \`\${libDir}\${path.delimiter}\${existingLibPath}\`
      : libDir;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      cwd,
      env: envVars,
      stdio,
    });

    let stdout = '';
    let stderr = '';

    if (stdio === 'pipe') {
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('error', (error) => {
      reject(new Error(\`Failed to execute binary: \${error.message}\`));
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: stdio === 'pipe' ? stdout : undefined,
        stderr: stdio === 'pipe' ? stderr : undefined,
      });
    });
  });
}

/**
 * Load the native binary for the current platform
 * @returns Path to the binary
 */
function loadNativeBinary() {
  const platformId = getCurrentPlatform();
  const platformPackages = {
${platforms.map((p) => `    '${p.platformId}': '${p.npmPackageName}',`).join('\n')}
  };

  const packageName = platformPackages[platformId];
  if (!packageName) {
    throw new Error(
      \`${capitalize(toolName)} binary not found for platform: \${platformId}.\\n\` +
      \`Supported platforms: \${Object.keys(platformPackages).join(', ')}\`
    );
  }

  try {
    const platformModule = require(packageName);

    if (platformModule?.binaryPath) {
      return platformModule.binaryPath;
    }

    throw new Error(\`Package \${packageName} does not export binaryPath\`);
  } catch (error) {
    throw new Error(
      \`${capitalize(toolName)} binary not found for platform: \${platformId}.\\n\` +
      \`Please ensure the platform-specific package is installed: \${packageName}\\n\` +
      \`If you're using npm/pnpm, optional dependencies might not have been installed.\\n\` +
      \`Try installing manually: npm install \${packageName}\\n\` +
      \`Error: \${error instanceof Error ? error.message : String(error)}\`
    );
  }
}

/**
 * Run ${toolName} with the given arguments
 * @param options - Run options including arguments
 * @returns Promise that resolves to the exit code
 */
export async function run${capitalize(toolName)}(options) {
  const binaryPath = loadNativeBinary();
  const { args, ...runOptions } = options;
  const result = await runBinary(binaryPath, args, runOptions);
  return result.exitCode;
}
`
}

/**
 * Generate index.d.ts for the main tool package
 * TypeScript type definitions
 */
export function generateMainIndexDts(config: ToolConfig): string {
  const { toolName } = config

  return `export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdio?: 'inherit' | 'pipe' | 'ignore';
}

export interface ${capitalize(toolName)}RunOptions extends RunOptions {
  args: string[];
}

/**
 * Run ${toolName} with the given arguments
 * @param options - Run options including arguments
 * @returns Promise that resolves to the exit code
 */
export declare function run${capitalize(toolName)}(options: ${capitalize(toolName)}RunOptions): Promise<number>;
`
}

/**
 * Generate package.json for a platform-specific package
 * No build scripts or typescript - dist files are pre-compiled
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
    os: [os],
    cpu: [arch],
    keywords: ['binkit', toolName, 'binary', os, arch],
    author: AUTHOR,
    license: LICENSE,
  }

  return JSON.stringify(pkg, null, 2)
}

/**
 * Generate index.js for a platform-specific package
 */
export function generatePlatformIndexJs(
  config: ToolConfig,
  platform: PlatformConfig
): string {
  const { toolName } = config
  const extension = platform.platformId.startsWith('win32') ? '.exe' : ''

  return `import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Path to the ${toolName} binary for this platform
 */
export const binaryPath = path.join(__dirname, '..', 'bin', '${toolName}${extension}');

/**
 * Path to the lib directory containing shared libraries
 */
export const libPath = path.join(__dirname, '..', 'lib');
`
}

/**
 * Generate index.d.ts for a platform-specific package
 */
export function generatePlatformIndexDts(
  config: ToolConfig,
  _platform: PlatformConfig
): string {
  const { toolName } = config

  return `/**
 * Path to the ${toolName} binary for this platform
 */
export declare const binaryPath: string;

/**
 * Path to the lib directory containing shared libraries
 */
export declare const libPath: string;
`
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
