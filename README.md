# BinKit — The Binary Toolkit

BinKit packages precompiled native CLI tools for Node.js. Install a tool, and the correct binary for your platform loads automatically.

## Quick Start

```bash
npm install @binkit/android-platform-tools
```

```typescript
import { execSync } from "child_process";
import { adb } from "@binkit/android-platform-tools";

// BinaryRunner provides binaryPath, spawn, and spawnSync
adb.spawn(["devices"]);
adb.spawnSync(["--version"]);

// For shell features (pipes, etc.), use binaryPath with exec/execSync
execSync(`${adb.binaryPath} devices | grep device`);
```

## Available Tools

| Package                  | Version                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `android-platform-tools` | [![npm](https://img.shields.io/npm/v/@binkit/android-platform-tools)](https://www.npmjs.com/package/@binkit/android-platform-tools) |
| `ffmpeg`                 | [![npm](https://img.shields.io/npm/v/@binkit/ffmpeg)](https://www.npmjs.com/package/@binkit/ffmpeg)                                 |

## Features

- **Zero config**: Platform detection is automatic
- **Type-safe**: Full TypeScript support
- **Modular**: Only downloads binaries for your platform via `optionalDependencies`
- **Pure ESM**: Modern module format

## Documentation

- [Product Overview](./docs/product.md) — Vision, use cases, and roadmap
- [Technical Design](./docs/technical.md) — Architecture and implementation details
- [Contributing](./docs/contributing.md) — How to add new tools

## License

MIT
