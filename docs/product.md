# BinKit Product Overview

## What is BinKit?

BinKit is a toolkit for distributing precompiled native CLI tools through npm. It enables Node.js and Electron applications to bundle native binaries directly, achieving zero external dependencies for end users.

## Problem Statement

When building Node.js or Electron applications, we often need to invoke native CLI tools for system-level capabilities:

- **Android tooling**: `adb`, `fastboot` for device communication
- **Media processing**: `ffmpeg` for video/audio manipulation
- **Database tools**: `sqlite3` for local data management

### The Traditional Approach

Typically, developers ask users to install these tools manually:

```
Please install Android Platform Tools before using this app:
- macOS: brew install android-platform-tools
- Windows: Download from https://developer.android.com/...
- Linux: apt install android-tools-adb
```

This creates several problems:

1. **Poor user experience** — Users must leave the app, find the right download, and configure PATH
2. **Version inconsistency** — Different users may have different versions, causing subtle bugs
3. **CI/CD complexity** — Build pipelines need extra setup steps for each tool
4. **Cross-platform burden** — Different installation methods for each OS

### The BinKit Solution

For statically-linked CLI tools, there's a better way: **bundle the binary directly in the npm package**.

```bash
npm install @binkit/android-platform-tools
```

```typescript
import { adb } from "@binkit/android-platform-tools";

// Just works — no manual installation required
adb.spawnSync(["devices"]);
```

Benefits:

- **Zero dependencies** — Everything needed is in the package
- **Consistent versions** — All users get the exact same binary
- **Works out of the box** — `npm install` is all you need
- **Lockfile-friendly** — Binary version is locked alongside your code

## How It Works

BinKit splits each tool into multiple npm packages:

```
@binkit/android-platform-tools              # Main package (API + platform detection)
├── @binkit/android-platform-tools-darwin-x64    # macOS Intel
├── @binkit/android-platform-tools-darwin-arm64  # macOS Apple Silicon
├── @binkit/android-platform-tools-linux-x64     # Linux x64
└── @binkit/android-platform-tools-win32-x64     # Windows x64
```

The main package declares platform packages as `optionalDependencies` with `os` and `cpu` constraints. npm/pnpm only downloads the binary for your current platform — not all of them.

## Use Cases

### 1. Electron Apps with Native Tool Dependencies

Desktop apps that need to interact with external devices or perform system operations:

```typescript
import { adb } from "@binkit/android-platform-tools";

// Your Electron app can communicate with Android devices
// without asking users to install anything
const devices = adb.spawnSync(["devices"]);
```

### 2. CLI Tools and Scripts

Development tools that wrap native binaries with better UX:

```typescript
import { adb } from "@binkit/android-platform-tools";

// Build a cross-platform CLI tool
// Users just need Node.js — nothing else
export function listDevices() {
  return adb.spawnSync(["devices"], { encoding: "utf-8" });
}
```

### 3. CI/CD Pipelines

Reproducible builds without system-level setup:

```yaml
# No need for "apt install" or "brew install"
- run: npm install
- run: node scripts/deploy-to-device.js
```

## Target Users

| User Type            | Use Case                                                        |
| -------------------- | --------------------------------------------------------------- |
| **App Developers**   | Bundle native tools in Electron/Node.js apps for zero-config UX |
| **Tool Authors**     | Distribute CLI tools that "just work" cross-platform            |
| **DevOps Engineers** | Simplify CI/CD pipelines by removing system dependencies        |

## Versioning Strategy

BinKit uses a three-part version scheme:

```
{framework-major}.{binary-major}.{patch}
```

| Position | Meaning                           | Example                     |
| -------- | --------------------------------- | --------------------------- |
| Major    | Framework breaking changes        | `1.x.x` → `2.x.x`           |
| Minor    | Upstream binary major version     | `1.35.x` (upstream v35.x.x) |
| Patch    | Binary updates or framework fixes | `1.35.1`, `1.35.2`          |

This allows users to update to new binary versions with minor bumps while reserving major versions for API changes.

## Roadmap

### Current

- Android Platform Tools (adb, fastboot, etc.)

### Planned

- ffmpeg / ffprobe
- Additional tools based on community needs

## Non-Goals

- **Compilation from source** — BinKit distributes precompiled binaries only
- **Dynamic libraries with system deps** — Focus is on statically-linked, self-contained tools
- **GUI applications** — CLI tools only
