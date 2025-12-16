# Contributing to BinKit

## Adding a New Tool

To add a new tool to BinKit, you need to create a registry entry that defines where to download binaries and how to verify them.

### Step 1: Create a Registry Entry

Create a new file in `registry/src/entries/`:

```typescript
// registry/src/entries/my-tool.ts
import type { RegistryEntry } from "../types.js";

export const myTool: RegistryEntry = {
  // Upstream versions to support
  versions: ["1.0.0"],

  // Supported platforms
  targets: [
    { platform: "darwin", arch: "x64" },
    { platform: "darwin", arch: "arm64" },
    { platform: "linux", arch: "x64" },
    { platform: "win32", arch: "x64" },
  ],

  // Configuration per version × platform
  getConfig: ({ version, platform }) => ({
    downloadUrl: `https://example.com/my-tool-${version}-${platform}.zip`,
    stripPrefix: "my-tool", // Optional: strip this prefix from archive paths
    binaries: ["my-tool"], // Binary names to export
    verify: ["my-tool --version"], // Commands to verify binaries work
  }),
};
```

### Step 2: Register the Entry

Add your entry to the registry index:

```typescript
// registry/src/index.ts
import { myTool } from "./entries/my-tool.js";

export const entries: Record<string, RegistryEntry> = {
  "android-platform-tools": androidPlatformTools,
  "my-tool": myTool,
};
```

### Step 3: Test Locally

```bash
# Build the CLI
pnpm build

# Generate and test target package for your platform
pnpm generate target my-tool 1.0.0
```

### Step 4: Submit a PR

Once your entry works locally, submit a pull request. The CI will:

1. Detect the new unpublished version via `binkit check`
2. Build target packages on each platform runner
3. Download binaries and run verification commands
4. Publish to npm if all checks pass

## Registry Entry Reference

### `RegistryEntry` Interface

```typescript
interface RegistryEntry {
  /** Upstream versions to support */
  versions: string[];

  /** Supported platform targets */
  targets: Target[];

  /** Get configuration for a specific version and target */
  getConfig: (ctx: EntryContext) => EntryConfig;
}
```

### `EntryContext` (passed to `getConfig`)

```typescript
interface EntryContext {
  version: string; // Upstream version (e.g., "35.0.0")
  platform: NodeJS.Platform; // "darwin" | "linux" | "win32"
  arch: NodeJS.Architecture; // "x64" | "arm64"
}
```

### `EntryConfig` (returned from `getConfig`)

```typescript
interface EntryConfig {
  /** Download URL for this target */
  downloadUrl: string;

  /** Optional: path prefix to strip when extracting */
  stripPrefix?: string;

  /** Binary names relative to vendor dir */
  binaries: string[];

  /** Commands to verify binaries work */
  verify?: string[];
}
```

## Tips

- **Download URLs**: Most tools have platform-specific download URLs. Use the `platform` context to construct the right URL.
- **Strip prefix**: Many archives contain a top-level folder (e.g., `platform-tools/`). Use `stripPrefix` to flatten it.
- **Verification**: Add commands that exit 0 on success. `--version` usually works well.
- **Multiple binaries**: If a tool ships multiple binaries, list them all in the `binaries` array.
