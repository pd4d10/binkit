import { spawn } from 'node:child_process'
import path from 'node:path'
import { getLibraryPathEnvVar } from './platform.js'

export interface RunOptions {
  cwd?: string
  env?: Record<string, string>
  stdio?: 'inherit' | 'pipe' | 'ignore'
}

export interface RunResult {
  exitCode: number
  stdout?: string
  stderr?: string
}

/**
 * Run a binary with the given arguments and options
 * Automatically configures environment variables for library paths
 *
 * @param binaryPath - Path to the binary to execute
 * @param args - Arguments to pass to the binary
 * @param options - Execution options
 * @returns Promise that resolves to the exit code and output
 */
export async function runBinary(
  binaryPath: string,
  args: string[] = [],
  options: RunOptions = {}
): Promise<RunResult> {
  const { cwd, env = {}, stdio = 'inherit' } = options

  // Get the directory containing the binary
  const binaryDir = path.dirname(binaryPath)

  // Get the lib directory (assuming it's a sibling of bin directory)
  const libDir = path.join(path.dirname(binaryDir), 'lib')

  // Prepare environment variables
  const libPathEnvVar = getLibraryPathEnvVar()
  const envVars: Record<string, string> = {
    ...process.env,
    ...env,
    // Add binary directory to PATH
    PATH: `${binaryDir}${path.delimiter}${env.PATH || process.env.PATH || ''}`,
  } as Record<string, string>

  // Add library path based on platform
  if (libPathEnvVar === 'PATH') {
    // On Windows, PATH is used for both executables and DLLs
    envVars.PATH = `${libDir}${path.delimiter}${envVars.PATH}`
  } else {
    // On Unix-like systems, use the appropriate library path variable
    const existingLibPath = env[libPathEnvVar] || process.env[libPathEnvVar] || ''
    envVars[libPathEnvVar] = existingLibPath
      ? `${libDir}${path.delimiter}${existingLibPath}`
      : libDir
  }

  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      cwd,
      env: envVars,
      stdio,
    })

    let stdout = ''
    let stderr = ''

    if (stdio === 'pipe') {
      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })
    }

    child.on('error', (error) => {
      reject(new Error(`Failed to execute binary: ${error.message}`))
    })

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: stdio === 'pipe' ? stdout : undefined,
        stderr: stdio === 'pipe' ? stderr : undefined,
      })
    })
  })
}
