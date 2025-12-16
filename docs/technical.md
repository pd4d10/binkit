# BinKit Technical Design

## Architecture Overview

BinKit is a monorepo with three main components:

```
binkit/
├── cli/              # CLI tool for generating packages
├── registry/         # Tool configurations (download URLs, binaries)
└── packages/         # Generated packages (gitignored)
```

### Component Responsibilities

| Component | Package Name       | Responsibility                             |
| --------- | ------------------ | ------------------------------------------ |
| CLI       | `binkit` (private) | Package generation, download, verification |
| Registry  | `binkit-registry`  | Declarative tool configurations            |
| Packages  | `@binkit/<tool>`   | Published npm packages                     |

## Package Generation Flow

The core flow transforms registry configurations into publishable npm packages:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Registry Entry                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ versions: ['35.0.0']                                            │   │
│  │ targets: [{ platform: 'darwin', arch: 'arm64' }, ...]           │   │
│  │ getConfig: (ctx) => {                                           │   │
│  │   downloadUrl: 'https://...',                                   │   │
│  │   binaries: ['adb', 'fastboot', ...],                           │   │
│  │   verify: ['adb --version', ...]                                │   │
│  │ }                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLI: binkit target                             │
│  1. Query npm registry → Calculate next version (1.35.0)               │
│  2. Generate main package (package.json, index.js, index.d.ts)         │
│  3. Generate target package (package.json with os/cpu constraints)     │
│  4. Download archive from upstream URL                                  │
│  5. Extract to vendor/, strip prefix, chmod +x binaries                │
│  6. Run verification commands                                           │
│  7. Install workspace for testing                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Generated Packages                              │
│  packages/                                                              │
│  ├── android-platform-tools/          # Main package                   │
│  │   ├── package.json                 # optionalDependencies           │
│  │   └── dist/                                                         │
│  │       ├── index.js                 # Runtime (platform detection)   │
│  │       ├── index.d.ts               # TypeScript types               │
│  │       └── index.test.js            # Verification tests             │
│  └── android-platform-tools-darwin-arm64/  # Target package            │
│      ├── package.json                 # os: ['darwin'], cpu: ['arm64'] │
│      └── vendor/                      # Binaries                       │
│          ├── adb                                                       │
│          ├── fastboot                                                  │
│          └── lib64/libc++.dylib                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## Detailed Flow Steps

### Step 1: Registry Configuration

Each tool is defined as a `RegistryEntry` in `registry/src/entries/`:

```typescript
// registry/src/entries/android-platform-tools.ts
export const androidPlatformTools: RegistryEntry = {
  // Supported upstream versions
  versions: ["35.0.0"],

  // Supported platforms
  targets: [
    { platform: "darwin", arch: "x64" },
    { platform: "darwin", arch: "arm64" },
    { platform: "linux", arch: "x64" },
    { platform: "win32", arch: "x64" },
  ],

  // Configuration generator (called per version × target)
  getConfig: ({ version, platform }) => {
    const osName =
      platform === "win32" ? "windows" : platform === "linux" ? "linux" : "darwin";

    return {
      downloadUrl: `https://dl.google.com/android/repository/platform-tools_r${version}-${osName}.zip`,
      stripPrefix: "platform-tools", // Archive contains platform-tools/ folder
      binaries: ["adb", "fastboot", "etc1tool", "hprof-conv", ...],
      verify: ["adb --version", "fastboot --version"],
    };
  },
};
```

Entries are registered in `registry/src/index.ts`:

```typescript
export const entries: Record<string, RegistryEntry> = {
  "android-platform-tools": androidPlatformTools,
};
```

### Step 2: Version Calculation

When generating packages, the CLI queries npm to calculate the next version:

```typescript
// cli/src/npm.ts
export async function getPackageVersion(
  name: string,
  upstreamVersion: string
): Promise<string> {
  const packageName = `${SCOPE}/${name}`;
  const publishedVersions = await fetchPublishedVersions(packageName);
  return calculatePackageVersion(upstreamVersion, publishedVersions);
}
```

Version format: `{FRAMEWORK_MAJOR}.{UPSTREAM_MAJOR}.{PATCH}`

- If `@binkit/android-platform-tools` has no `1.35.x` versions → `1.35.0`
- If `1.35.0` exists → `1.35.1`
- If `1.35.0`, `1.35.1` exist → `1.35.2`

### Step 3: Code Generation

The CLI generates JavaScript code from binary configurations:

```typescript
// cli/src/templates.ts
export function generateMainIndexJs(config: ToolConfig): string {
  const binaries = getBinaries(config);

  // For each binary, generate an export
  const binaryExports = binaries
    .map(
      (binary) =>
        `export const ${binary.exportName} = createBinaryRunner(getBinaryPath('${binary.path}'));`
    )
    .join("\n\n");

  return `
import path from 'node:path';
// ... runtime code ...

function getBinaryPath(binaryPath) {
  const vendorDir = getVendorDir();
  const extension = process.platform === 'win32' ? '.exe' : '';
  return path.join(vendorDir, binaryPath + extension);
}

${binaryExports}
`;
}
```

Binary names are converted to camelCase exports:

| Binary Name  | Export Name |
| ------------ | ----------- |
| `adb`        | `adb`       |
| `fastboot`   | `fastboot`  |
| `hprof-conv` | `hprofConv` |
| `make_f2fs`  | `makeF2fs`  |

### Step 4: Download and Extraction

The download process in `cli/src/download.ts`:

```typescript
export async function downloadAndExtractTarget(
  config: ToolConfig,
  target: TargetConfig,
  packageDir: string,
  verify?: VerifyCommands
): Promise<void> {
  const vendorDir = path.join(packageDir, "vendor");
  const zipPath = path.join(packageDir, "download.zip");

  // 1. Download archive
  await downloadFile(target.download.url, zipPath);

  // 2. Extract to vendor/
  await extractToVendor(
    zipPath,
    vendorDir,
    config.binaries,
    config.stripPrefix
  );

  // 3. Verify binaries
  if (verify && verify.length > 0) {
    await verifyBinaries(vendorDir, verify);
  }
}
```

Extraction handles platform differences:

```typescript
export async function extractToVendor(
  zipPath: string,
  vendorDir: string,
  binaryPaths: string[],
  stripPrefix?: string
): Promise<void> {
  // Platform-specific unzip
  if (process.platform === "win32") {
    await execAsync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' ..."`
    );
  } else {
    await execAsync(`unzip -o -q "${zipPath}" -d "${vendorDir}"`);
  }

  // Strip prefix (e.g., move platform-tools/* to vendor/*)
  if (stripPrefix) {
    const prefixDir = path.join(vendorDir, stripPrefix);
    const entries = await fs.readdir(prefixDir);
    for (const entry of entries) {
      await fs.rename(path.join(prefixDir, entry), path.join(vendorDir, entry));
    }
    await fs.rmdir(prefixDir);
  }

  // Set executable permissions
  for (const binaryPath of binaryPaths) {
    await fs.chmod(path.join(vendorDir, binaryPath), 0o755);
  }
}
```

### Step 5: Verification

After extraction, verification commands ensure binaries work:

```typescript
export async function verifyBinaries(
  vendorDir: string,
  commands: VerifyCommands
): Promise<void> {
  for (const command of commands) {
    // Parse "adb --version" → binary: "adb", args: ["--version"]
    const [binaryPath, ...args] = command.split(" ");
    const fullPath = path.join(vendorDir, binaryPath);

    const { code, output } = await runCommand(fullPath, args);

    if (code !== 0) {
      throw new Error(`Verification failed for ${binaryPath}`);
    }
    console.log(`✓ ${binaryPath}: ${output.split("\n")[0]}`);
  }
}
```

## Runtime Binary Loading

When a user imports the package:

```typescript
import { adb, fastboot } from "@binkit/android-platform-tools";

// adb.spawnSync(['devices'])
```

The runtime flow:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          User Code                                      │
│  import { adb } from '@binkit/android-platform-tools'                  │
│  adb.spawnSync(['devices'])                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Main Package (index.js)                           │
│  1. getCurrentTarget() → 'darwin-arm64'                                │
│  2. Lookup target package → '@binkit/android-platform-tools-darwin-arm64'
│  3. require.resolve(package + '/package.json')                         │
│  4. vendorDir = path.dirname(packageJsonPath) + '/vendor'              │
│  5. binaryPath = vendorDir + '/adb'                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       BinaryRunner                                      │
│  {                                                                      │
│    binaryPath: '/node_modules/@binkit/.../vendor/adb',                 │
│    spawn: (args, opts) => child_process.spawn(binaryPath, args, opts), │
│    spawnSync: (args, opts) => child_process.spawnSync(binaryPath, ...),│
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

Target package resolution uses `require.resolve()` to find the installed package:

```typescript
function getVendorDir() {
  const targetId = getCurrentTarget(); // 'darwin-arm64'
  const targetPackages = {
    "darwin-x64": "@binkit/android-platform-tools-darwin-x64",
    "darwin-arm64": "@binkit/android-platform-tools-darwin-arm64",
    "linux-x64": "@binkit/android-platform-tools-linux-x64",
    "win32-x64": "@binkit/android-platform-tools-win32-x64",
  };

  const packageName = targetPackages[targetId];
  const packageJsonPath = require.resolve(packageName + "/package.json");
  return path.join(path.dirname(packageJsonPath), "vendor");
}
```

## CI/CD Pipeline

### Release Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Push to main                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Job: check (ubuntu-latest)                           │
│  1. binkit check                                                        │
│  2. Query npm for each entry × version                                  │
│  3. Output: [{ tool: 'android-platform-tools', upstreamVersion: '35.0.0' }]
└─────────────────────────────────────────────────────────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
┌──────────────────────────────┐    ┌──────────────────────────────────────┐
│  Job: publish-main           │    │  Job: publish-targets (matrix)       │
│  (ubuntu-latest)             │    │                                      │
│                              │    │  ┌─────────────────────────────────┐ │
│  For each unpublished:       │    │  │ darwin-arm64 (macos-15)         │ │
│  1. binkit main <tool> <ver> │    │  │ darwin-x64 (macos-15-intel)     │ │
│  2. cd packages/<tool>       │    │  │ linux-x64 (ubuntu-24.04)        │ │
│  3. npm publish              │    │  │ linux-arm64 (ubuntu-24.04-arm)  │ │
│                              │    │  │ win32-x64 (windows-2025)        │ │
└──────────────────────────────┘    │  └─────────────────────────────────┘ │
                                    │                                      │
                                    │  For each target runner:             │
                                    │  1. binkit target <tool> <ver>       │
                                    │  2. Download + extract + verify      │
                                    │  3. npm publish target package       │
                                    └──────────────────────────────────────┘
```

### Check Command

```bash
$ binkit check
Checking for unpublished versions...

  📦 Querying npm for @binkit/android-platform-tools...

Unpublished versions:
  - android-platform-tools@35.0.0

UNPUBLISHED_JSON=[{"name":"android-platform-tools","version":"35.0.0"}]
```

The check logic:

```typescript
export async function getUnpublishedVersions(
  entries: Record<string, { versions: string[] }>
): Promise<Record<string, string[]>> {
  const unpublished: Record<string, string[]> = {};

  for (const [name, entry] of Object.entries(entries)) {
    const publishedMetadata = await fetchPublishedMetadata(`${SCOPE}/${name}`);

    const unpublishedVersions = entry.versions.filter(
      (version) => !isVersionPublished(version, publishedMetadata)
    );

    if (unpublishedVersions.length > 0) {
      unpublished[name] = unpublishedVersions;
    }
  }

  return unpublished;
}
```

## Platform-Specific Notes

### macOS

- Uses `unzip` for extraction
- Dynamic libraries in `vendor/lib64/` (e.g., `libc++.dylib`)
- No special runtime environment setup needed (dyld handles it)

### Linux

- Uses `unzip` for extraction
- May require `LD_LIBRARY_PATH` for some tools (handled by runtime if needed)

### Windows

- Uses PowerShell `Expand-Archive` for extraction
- Binaries have `.exe` extension
- `getBinaryPath()` appends `.exe` automatically
