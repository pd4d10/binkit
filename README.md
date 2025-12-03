# BinKit — The Binary Toolkit

A monorepo for packaging precompiled native CLI tools for Node.js, with platform-specific binaries automatically loaded based on the current system.

## Features

- **Cross-platform**: Automatically selects the right binary for your OS and architecture
- **Type-safe**: Full TypeScript support with complete type definitions
- **Modular**: Each tool is an independent package with platform-specific sub-packages
- **ESM**: Pure ESM module format
- **Generator**: Scaffold new tool packages with a single command

## Project Structure

```
binkit/
├── core/                        # binkit (private) - Core toolkit
│   ├── src/                     # Platform detection, binary runner, generator
│   ├── dist/                    # Compiled output
│   └── package.json
├── packages/                    # Generated tool packages (gitignored)
│   ├── <tool>/                  # @binkit/<tool> - Publishable
│   ├── <tool>-darwin-x64/       # @binkit/<tool>-darwin-x64
│   ├── <tool>-darwin-arm64/     # @binkit/<tool>-darwin-arm64
│   ├── <tool>-linux-x64/        # @binkit/<tool>-linux-x64
│   ├── <tool>-linux-arm64/      # @binkit/<tool>-linux-arm64
│   └── <tool>-win32-x64/        # @binkit/<tool>-win32-x64
├── package.json                 # Workspace root (private)
└── pnpm-workspace.yaml
```

## Getting Started

### Installation

```bash
pnpm install
```

### Build All Packages

```bash
pnpm build
```

### Generate a New Tool

Use the `binkit` CLI to generate packages for a new tool:

```bash
# Show help
pnpm generate --help

# Generate with default version (0.1.0)
pnpm generate ffmpeg

# Generate with specific version
pnpm generate adb 1.0.0
```

Generated packages are placed in `packages/` (gitignored) and should be reviewed before publishing.

## Usage

Once published, users can install and use the tools:

```bash
npm install @binkit/ffmpeg
```

```typescript
import { runFfmpeg } from '@binkit/ffmpeg'

// Run ffmpeg with arguments
const exitCode = await runFfmpeg({
  args: ['-version'],
  cwd: process.cwd(),
})

console.log('Exit code:', exitCode)
```

The main package automatically loads the correct platform-specific binary based on your system's OS and architecture.

## Architecture

### Core Package (binkit)

An all-in-one private toolkit providing:

- **Platform Detection**: Maps `process.platform` + `process.arch` to platform identifiers
- **Binary Runner**: Executes binaries with proper environment variables (PATH, LD_LIBRARY_PATH, etc.)
- **Package Generator**: Scaffolds new tool packages with TypeScript configs and build scripts
- **CLI Tool**: `binkit` command for generating tool packages
- **Type Definitions**: Shared types for tool configurations

### Tool Packages

Each tool (like `ffmpeg`) consists of:

1. **Main Package** (`@binkit/ffmpeg`):
   - Exports JS API
   - Loads platform-specific binary at runtime
   - Lists all platform packages as `optionalDependencies`

2. **Platform Packages** (`@binkit/ffmpeg-<platform>`):
   - Contains the actual binary for that platform
   - Exports `binaryPath` and `libPath`
   - Marked with `os` and `cpu` fields in package.json

## Development

### Adding a New Tool

1. Generate packages using the CLI:

```bash
pnpm generate mytool 1.0.0
```

2. Add real binaries to `packages/<tool>-<platform>/bin/`
3. Add shared libraries to `packages/<tool>-<platform>/lib/`
4. Build: `pnpm install && pnpm build`
5. Publish: `pnpm -r publish --filter "./packages/*"`

Or use the API programmatically:

```typescript
import { createToolConfig, generateToolPackages } from 'binkit'

const config = createToolConfig({ toolName: 'mytool', version: '1.0.0' })
await generateToolPackages(config, { outputDir: './packages', force: true })
```

**Note**: The `binkit` core package is private and not published. The `@binkit` scope is reserved for tool packages (like `@binkit/ffmpeg`).

### Scripts

- `pnpm build` - Build all packages
- `pnpm lint` - Run ESLint
- `pnpm clean` - Remove all build artifacts
- `pnpm generate <tool> [version]` - Generate tool packages using binkit CLI

## License

MIT
