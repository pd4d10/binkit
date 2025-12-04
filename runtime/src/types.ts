/**
 * Options for running a binary
 */
export interface RunOptions {
  /** Working directory for the process */
  cwd?: string
  /** Additional environment variables */
  env?: Record<string, string>
  /** stdio mode: 'inherit' passes through, 'pipe' captures output, 'ignore' discards */
  stdio?: 'inherit' | 'pipe' | 'ignore'
}

/**
 * Result of running a binary
 */
export interface RunResult {
  /** Exit code of the process */
  exitCode: number
  /** Captured stdout (only available when stdio is 'pipe') */
  stdout?: string
  /** Captured stderr (only available when stdio is 'pipe') */
  stderr?: string
}

/**
 * Platform identifier in format <os>-<arch>
 * e.g., 'darwin-arm64', 'linux-x64', 'win32-x64'
 */
export type PlatformId = string

