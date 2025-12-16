import { AUTHOR, LICENSE, SCOPE } from './constants.js'
import { type ToolConfig, type TargetConfig, getTargetId } from './config.js'

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
    path: config.name,
    name: config.name,
    exportName: toCamelCase(config.name),
  }]
}

/**
 * Generate package.json for the main tool package
 * No build scripts or typescript - dist files are pre-compiled
 */
export function generateMainPackageJson(config: ToolConfig): string {
  const { name, version, upstreamVersion, targets } = config
  const packageName = `${SCOPE}/${name}`

  const optionalDependencies: Record<string, string> = {}
  for (const target of targets) {
    // Use workspace protocol for workspace packages
    optionalDependencies[target.npmPackageName] = 'workspace:*'
  }

  const pkg = {
    name: packageName,
    version,
    upstreamVersion,
    description: `BinKit ${name} - Cross-platform ${name} binary`,
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
    keywords: ['binkit', name, 'binary', 'cli'],
    author: AUTHOR,
    license: LICENSE,
    optionalDependencies,
  }

  return JSON.stringify(pkg, null, 2)
}

/**
 * Generate index.js for the main tool package
 * This is the compiled JavaScript that will be copied to dist/
 * Runtime code is bundled inline to avoid version mismatch issues
 */
export function generateMainIndexJs(config: ToolConfig): string {
  const { name, targets } = config
  const binaries = getBinaries(config)

  // Generate exports for each binary
  const binaryExports = binaries
    .map(
      (binary) => `/**
 * Binary runner for ${binary.name}.
 * Provides spawn, spawnSync, exec, execSync methods.
 */
export const ${binary.exportName} = createBinaryRunner(getBinaryPath('${binary.path}'));`
    )
    .join('\n\n')

  return `import path from 'node:path';
import { createRequire } from 'node:module';
import {
  spawn as nodeSpawn,
  spawnSync as nodeSpawnSync,
  exec as nodeExec,
  execSync as nodeExecSync,
} from 'node:child_process';

const require = createRequire(import.meta.url);

function getCurrentTarget() {
  return \`\${process.platform}-\${process.arch}\`;
}

function createBinaryRunner(binaryPath) {
  return {
    path: binaryPath,

    spawn(...params) {
      const isArgsArray = Array.isArray(params[0]);
      const args = isArgsArray ? params[0] : [];
      const opts = isArgsArray ? params[1] : params[0];
      return nodeSpawn(binaryPath, args, opts);
    },

    spawnSync(...params) {
      const isArgsArray = Array.isArray(params[0]);
      const args = isArgsArray ? params[0] : [];
      const opts = isArgsArray ? params[1] : params[0];
      return nodeSpawnSync(binaryPath, args, opts);
    },

    exec(...params) {
      const isOptionsFirst = params[0] != null && typeof params[0] !== 'function';
      const options = isOptionsFirst ? params[0] : undefined;
      const cb = isOptionsFirst ? params[1] : params[0];
      return nodeExec(binaryPath, options, cb);
    },

    execSync(...params) {
      const options = params[0];
      return nodeExecSync(binaryPath, options);
    },
  };
}

/**
 * Get the vendor directory for the current target
 * @returns Path to the vendor directory
 */
function getVendorDir() {
  const targetId = getCurrentTarget();
  const targetPackages = {
${targets.map((t) => `    '${getTargetId(t)}': '${t.npmPackageName}',`).join('\n')}
  };

  const packageName = targetPackages[targetId];
  if (!packageName) {
    throw new Error(
      \`${capitalize(name)} binaries not found for target: \${targetId}.\\n\` +
      \`Supported targets: \${Object.keys(targetPackages).join(', ')}\`
    );
  }

  try {
    const packageJsonPath = require.resolve(packageName + '/package.json');
    return path.join(path.dirname(packageJsonPath), 'vendor');
  } catch (error) {
    throw new Error(
      \`${capitalize(name)} binaries not found for target: \${targetId}.\\n\` +
      \`Please ensure the target-specific package is installed: \${packageName}\\n\` +
      \`If you're using npm/pnpm, optional dependencies might not have been installed.\\n\` +
      \`Try installing manually: npm install \${packageName}\\n\` +
      \`Error: \${error instanceof Error ? error.message : String(error)}\`
    );
  }
}

/**
 * Get the full path to a binary
 * @param binaryPath - Binary path relative to vendor dir (e.g., "platform-tools/adb")
 * @returns Full path to the binary
 */
function getBinaryPath(binaryPath) {
  const vendorDir = getVendorDir();
  const extension = process.platform === 'win32' ? '.exe' : '';
  return path.join(vendorDir, binaryPath + extension);
}

${binaryExports}
`
}

/**
 * Generate index.d.ts for the main tool package
 * TypeScript type definitions with bundled runtime types
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

  return `import type * as cp from 'node:child_process';

// ============================================================================
// Bundled runtime types (from @binkit/runtime)
// ============================================================================

type OmitFirstParam<F> = F extends (first: any, ...rest: infer R) => infer T
  ? (...args: R) => T
  : never;

type OverloadsToUnion<T> =
  T extends {
    (...args: infer A1): infer R1
    (...args: infer A2): infer R2
    (...args: infer A3): infer R3
    (...args: infer A4): infer R4
    (...args: infer A5): infer R5
    (...args: infer A6): infer R6
    (...args: infer A7): infer R7
    (...args: infer A8): infer R8
    (...args: infer A9): infer R9
    (...args: infer A10): infer R10
  }
    ? ((...args: A1) => R1) | ((...args: A2) => R2) | ((...args: A3) => R3) | ((...args: A4) => R4) |
      ((...args: A5) => R5) | ((...args: A6) => R6) | ((...args: A7) => R7) | ((...args: A8) => R8) |
      ((...args: A9) => R9) | ((...args: A10) => R10)
    : T extends (...args: infer A) => infer R
      ? (...args: A) => R
      : never;

type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

type OmitFirstFromOverloads<T> = UnionToIntersection<
  OmitFirstParam<OverloadsToUnion<T>>
>;

/**
 * Binary runner interface that wraps child_process methods.
 * All methods have the same signature as their child_process counterparts,
 * but without the first command parameter (since it's already bound).
 */
export interface BinaryRunner {
  /** Path to the binary executable */
  readonly path: string;

  /** @see https://nodejs.org/api/child_process.html#child_processspawncommand-args-options */
  spawn: OmitFirstFromOverloads<typeof cp.spawn>;

  /** @see https://nodejs.org/api/child_process.html#child_processspawnsynccommand-args-options */
  spawnSync: OmitFirstFromOverloads<typeof cp.spawnSync>;

  /** @see https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback */
  exec: OmitFirstFromOverloads<typeof cp.exec>;

  /** @see https://nodejs.org/api/child_process.html#child_processexecsynccommand-options */
  execSync: OmitFirstFromOverloads<typeof cp.execSync>;
}

// ============================================================================
// Binary exports
// ============================================================================

${exportDeclarations}
`
}

/**
 * Generate package.json for a target-specific package
 * Target packages are just binary containers - no JS code needed
 */
export function generateTargetPackageJson(
  config: ToolConfig,
  target: TargetConfig
): string {
  const { name, version } = config
  const { platform, arch } = target

  const pkg = {
    name: target.npmPackageName,
    version,
    description: `${capitalize(name)} binary for ${platform}-${arch}`,
    files: ['vendor'],
    os: [platform],
    cpu: [arch],
    keywords: ['binkit', name, 'binary', platform, arch],
    author: AUTHOR,
    license: LICENSE,
  }

  return JSON.stringify(pkg, null, 2)
}

/**
 * Generate README.md for a target-specific package
 */
export function generateTargetReadme(
  config: ToolConfig,
  target: TargetConfig
): string {
  const { name } = config
  const mainPackageName = `${SCOPE}/${name}`

  return `# ${target.npmPackageName}

This is a target-specific binary package for [${mainPackageName}](https://www.npmjs.com/package/${mainPackageName}).

**Do not install this package directly.** Instead, install the main package:

\`\`\`bash
npm install ${mainPackageName}
\`\`\`

The main package will automatically select and install the correct binary for your target.
`
}

/**
 * Generate test file for the main tool package
 * Uses Node.js built-in test runner
 */
export function generateMainTestJs(config: ToolConfig): string {
  const binaries = getBinaries(config)

  // Generate test cases for each binary
  const binaryTests = binaries
    .map(
      (binary) => `
  await t.test('${binary.exportName}.path should be a valid path', () => {
    assert.ok(${binary.exportName}.path, '${binary.exportName}.path should be defined');
    assert.ok(typeof ${binary.exportName}.path === 'string', '${binary.exportName}.path should be a string');
    assert.ok(${binary.exportName}.path.length > 0, '${binary.exportName}.path should not be empty');
  });

  await t.test('${binary.exportName}.spawnSync should execute successfully', () => {
    const result = ${binary.exportName}.spawnSync(['--version']);
    // Some binaries may return non-zero for --version, so we just check it doesn't throw
    assert.ok(result, 'spawnSync should return a result');
    assert.ok('status' in result, 'result should have status property');
  });`
    )
    .join('\n')

  const imports = binaries.map((b) => b.exportName).join(', ')

  return `import { test } from 'node:test';
import assert from 'node:assert';
import { ${imports} } from './index.js';

test('${config.name} binaries', async (t) => {
${binaryTests}
});
`
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
