/**
 * Template generators for package files
 */

import { AUTHOR, LICENSE, SCOPE } from './constants.js'
import type { Target, RegistryEntry, EntryConfig } from 'binkit-registry'

// ============================================================================
// Types
// ============================================================================

export interface ToolConfig {
  name: string
  upstreamVersion: string
  packageVersion: string
  entry: RegistryEntry
  entryConfig: EntryConfig
}

interface BinaryInfo {
  path: string
  name: string
  exportName: string
}

// ============================================================================
// Main Package Templates
// ============================================================================

export function generateMainPackageJson(config: ToolConfig): string {
  const { name, packageVersion, upstreamVersion, entry } = config

  const optionalDependencies: Record<string, string> = {}
  for (const t of entry.targets) {
    optionalDependencies[`${SCOPE}/${name}-${t.platform}-${t.arch}`] = packageVersion
  }

  return JSON.stringify({
    name: `${SCOPE}/${name}`,
    version: packageVersion,
    upstreamVersion,
    description: `BinKit \`${name}\` - Cross-platform binary`,
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
  }, null, 2)
}

export function generateMainIndexJs(config: ToolConfig): string {
  const { name, entry, entryConfig } = config
  const binaryInfos = getBinaryInfos(entryConfig.binaries, name)

  const binaryExports = binaryInfos
    .map((b) => `/**
 * Binary runner for ${b.name}.
 * Provides spawn and spawnSync methods.
 */
export const ${b.exportName} = createBinaryRunner(getBinaryPath('${b.path}'));`)
    .join('\n\n')

  const targetPackageEntries = entry.targets
    .map((t) => `    '${t.platform}-${t.arch}': '${SCOPE}/${name}-${t.platform}-${t.arch}',`)
    .join('\n')

  return `import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn as nodeSpawn, spawnSync as nodeSpawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);

function getCurrentTarget() {
  return \`\${process.platform}-\${process.arch}\`;
}

function createBinaryRunner(binaryPath) {
  return {
    binaryPath,

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
  };
}

function getVendorDir() {
  const targetId = getCurrentTarget();
  const targetPackages = {
${targetPackageEntries}
  };

  const packageName = targetPackages[targetId];
  if (!packageName) {
    throw new Error(
      \`\\\`${name}\\\` binaries not found for target: \${targetId}.\\n\` +
      \`Supported targets: \${Object.keys(targetPackages).join(', ')}\`
    );
  }

  try {
    const packageJsonPath = require.resolve(packageName + '/package.json');
    return path.join(path.dirname(packageJsonPath), 'vendor');
  } catch (error) {
    throw new Error(
      \`\\\`${name}\\\` binaries not found for target: \${targetId}.\\n\` +
      \`Please ensure the target-specific package is installed: \${packageName}\\n\` +
      \`If you're using npm/pnpm, optional dependencies might not have been installed.\\n\` +
      \`Try installing manually: npm install \${packageName}\\n\` +
      \`Error: \${error instanceof Error ? error.message : String(error)}\`
    );
  }
}

function getBinaryPath(binaryPath) {
  const vendorDir = getVendorDir();
  const extension = process.platform === 'win32' ? '.exe' : '';
  return path.join(vendorDir, binaryPath + extension);
}

${binaryExports}
`
}

export function generateMainIndexDts(config: ToolConfig): string {
  const { name, entryConfig } = config
  const binaryInfos = getBinaryInfos(entryConfig.binaries, name)

  const exportDeclarations = binaryInfos
    .map((b) => `/**
 * Binary runner for ${b.name}.
 * Provides spawn and spawnSync methods.
 */
export declare const ${b.exportName}: BinaryRunner;`)
    .join('\n\n')

  return `import type * as cp from 'node:child_process';

// ============================================================================
// Bundled runtime types
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
 */
export interface BinaryRunner {
  readonly binaryPath: string;
  spawn: OmitFirstFromOverloads<typeof cp.spawn>;
  spawnSync: OmitFirstFromOverloads<typeof cp.spawnSync>;
}

// ============================================================================
// Binary exports
// ============================================================================

${exportDeclarations}
`
}

export function generateMainTestJs(config: ToolConfig): string {
  const { name, entryConfig } = config
  const binaryInfos = getBinaryInfos(entryConfig.binaries, name)

  const binaryTests = binaryInfos
    .map((b) => `
  await t.test('${b.exportName}.binaryPath should be a valid path', () => {
    assert.ok(${b.exportName}.binaryPath, '${b.exportName}.binaryPath should be defined');
    assert.ok(typeof ${b.exportName}.binaryPath === 'string', '${b.exportName}.binaryPath should be a string');
    assert.ok(${b.exportName}.binaryPath.length > 0, '${b.exportName}.binaryPath should not be empty');
  });

  await t.test('${b.exportName}.spawnSync should execute successfully', () => {
    const result = ${b.exportName}.spawnSync(['--version']);
    assert.ok(result, 'spawnSync should return a result');
    assert.ok('status' in result, 'result should have status property');
  });`)
    .join('\n')

  const imports = binaryInfos.map((b) => b.exportName).join(', ')

  return `import { test } from 'node:test';
import assert from 'node:assert';
import { ${imports} } from './index.js';

test('\`${name}\` binaries', async (t) => {
${binaryTests}
});
`
}

// ============================================================================
// Target Package Templates
// ============================================================================

export function generateTargetPackageJson(config: ToolConfig, target: Target): string {
  const { name, packageVersion } = config
  const npmPackageName = `${SCOPE}/${name}-${target.platform}-${target.arch}`

  return JSON.stringify({
    name: npmPackageName,
    version: packageVersion,
    description: `\`${name}\` binary for ${target.platform}-${target.arch}`,
    files: ['vendor'],
    os: [target.platform],
    cpu: [target.arch],
    keywords: ['binkit', name, 'binary', target.platform, target.arch],
    author: AUTHOR,
    license: LICENSE,
  }, null, 2)
}

export function generateTargetReadme(config: ToolConfig, target: Target): string {
  const { name } = config
  const npmPackageName = `${SCOPE}/${name}-${target.platform}-${target.arch}`
  const mainPackageName = `${SCOPE}/${name}`

  return `# ${npmPackageName}

This is a target-specific binary package for [${mainPackageName}](https://www.npmjs.com/package/${mainPackageName}).

**Do not install this package directly.** Instead, install the main package:

\`\`\`bash
npm install ${mainPackageName}
\`\`\`

The main package will automatically select and install the correct binary for your target.
`
}

// ============================================================================
// Helpers
// ============================================================================

function getBinaryInfos(binaries: string[], defaultName: string): BinaryInfo[] {
  const paths = binaries.length > 0 ? binaries : [defaultName]
  return paths.map((binaryPath) => {
    const parts = binaryPath.split('/')
    const name = parts[parts.length - 1]
    return {
      path: binaryPath,
      name,
      exportName: name.replace(/[-_]([a-z0-9])/g, (_, char) => char.toUpperCase()),
    }
  })
}
