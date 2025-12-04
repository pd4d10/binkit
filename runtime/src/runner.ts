import { spawn } from 'node:child_process'
import path from 'node:path'
import type { RunOptions, RunResult } from './types.js'
import { getLibraryPathEnvVar } from './platform.js'

/**
 * Run a binary with the given arguments and options.
 * Automatically configures environment variables for library paths.
 *
 * @param binaryPath - Full path to the binary executable
 * @param args - Command line arguments to pass to the binary
 * @param options - Run options (cwd, env, stdio)
 * @returns Promise that resolves with execution result
 */
export async function runBinary(
  binaryPath: string,
  args: string[] = [],
  options: RunOptions = {}
): Promise<RunResult> {
  const { cwd, env = {}, stdio = 'inherit' } = options

  const binaryDir = path.dirname(binaryPath)
  const libDir = path.join(path.dirname(binaryDir), 'lib')

  const libPathEnvVar = getLibraryPathEnvVar()
  const envVars: Record<string, string | undefined> = {
    ...process.env,
    ...env,
    PATH: `${binaryDir}${path.delimiter}${env.PATH || process.env.PATH || ''}`,
  }

  if (libPathEnvVar === 'PATH') {
    envVars.PATH = `${libDir}${path.delimiter}${envVars.PATH}`
  } else {
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
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data: Buffer) => {
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

