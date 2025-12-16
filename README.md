# BinKit — The Binary Toolkit

BinKit packages precompiled native CLI tools for Node.js. Install a tool, and the correct binary for your platform loads automatically.

## Quick Start

```bash
npm install @binkit/android-platform-tools
```

```typescript
import { adb, fastboot } from "@binkit/android-platform-tools";

// Spawn async process
const child = adb.spawn(["devices"]);
child.stdout.on("data", (data) => console.log(data.toString()));

// Spawn sync
const result = adb.spawnSync(["--version"]);
console.log(result.stdout.toString());

// Exec sync
const output = fastboot.execSync({ encoding: "utf-8" });
```

## Available Tools

| Tool                   | Package                          | Description                      |
| ---------------------- | -------------------------------- | -------------------------------- |
| Android Platform Tools | `@binkit/android-platform-tools` | ADB, fastboot, and related tools |

## Features

- **Zero config**: Platform detection is automatic
- **Type-safe**: Full TypeScript support
- **Modular**: Only downloads binaries for your platform via `optionalDependencies`
- **Pure ESM**: Modern module format

## API

Each tool package exports `BinaryRunner` objects for its binaries:

```typescript
interface BinaryRunner {
  /** Path to the binary executable */
  path: string;

  /** Async spawn (same as child_process.spawn, without command arg) */
  spawn(args?: string[], options?: SpawnOptions): ChildProcess;

  /** Sync spawn */
  spawnSync(
    args?: string[],
    options?: SpawnSyncOptions
  ): SpawnSyncReturns<Buffer>;

  /** Async exec */
  exec(options?: ExecOptions, callback?: ExecCallback): ChildProcess;

  /** Sync exec */
  execSync(options?: ExecSyncOptions): Buffer | string;
}
```

Example with `android-platform-tools`:

```typescript
import { adb, fastboot } from "@binkit/android-platform-tools";

// All exports are BinaryRunner objects
adb.path; // '/path/to/node_modules/@binkit/.../vendor/adb'
adb.spawnSync(["devices"]);
```

## Documentation

- [Product Overview](./docs/product.md) — Vision, use cases, and roadmap
- [Technical Design](./docs/technical.md) — Architecture and implementation details
- [Contributing](./docs/contributing.md) — How to add new tools

## License

MIT
