import {
  spawn as nodeSpawn,
  spawnSync as nodeSpawnSync,
  exec as nodeExec,
  execSync as nodeExecSync,
} from 'node:child_process'
import type * as cp from 'node:child_process'
import path from 'node:path'
import { getLibraryPathEnvVar } from './platform.js'
import type { OmitFirstFromOverloads } from './types.js'

/**
 * Binary runner interface that wraps child_process methods.
 * All methods have the same signature as their child_process counterparts,
 * but without the first command parameter (since it's already bound).
 */
export interface BinaryRunner {
  /** Path to the binary executable */
  readonly path: string

  /** @see https://nodejs.org/api/child_process.html#child_processspawncommand-args-options */
  spawn: OmitFirstFromOverloads<typeof cp.spawn>

  /** @see https://nodejs.org/api/child_process.html#child_processspawnsynccommand-args-options */
  spawnSync: OmitFirstFromOverloads<typeof cp.spawnSync>

  /** @see https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback */
  exec: OmitFirstFromOverloads<typeof cp.exec>

  /** @see https://nodejs.org/api/child_process.html#child_processexecsynccommand-options */
  execSync: OmitFirstFromOverloads<typeof cp.execSync>
}

/**
 * Build enhanced environment variables for a binary.
 * Sets up PATH and library path environment variables.
 */
function buildEnv(
  binaryPath: string,
  env?: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  const binaryDir = path.dirname(binaryPath)
  const libDir = path.join(path.dirname(binaryDir), 'lib')
  const libPathEnvVar = getLibraryPathEnvVar()

  const envVars: NodeJS.ProcessEnv = {
    ...process.env,
    ...env,
    PATH: `${binaryDir}${path.delimiter}${env?.PATH || process.env.PATH || ''}`,
  }

  if (libPathEnvVar === 'PATH') {
    envVars.PATH = `${libDir}${path.delimiter}${envVars.PATH}`
  } else {
    const existingLibPath = env?.[libPathEnvVar] || process.env[libPathEnvVar] || ''
    envVars[libPathEnvVar] = existingLibPath
      ? `${libDir}${path.delimiter}${existingLibPath}`
      : libDir
  }

  return envVars
}

/**
 * Create a binary runner for the given binary path.
 * Returns an object with child_process-like methods that automatically
 * configure environment variables for library paths.
 *
 * @param binaryPath - Full path to the binary executable
 * @returns Binary runner object with spawn, spawnSync, exec, execSync methods
 */
export function createBinaryRunner(binaryPath: string): BinaryRunner {
  return {
    path: binaryPath,

    spawn(...params: unknown[]) {
      const isArgsArray = Array.isArray(params[0])
      const args = isArgsArray ? (params[0] as string[]) : []
      const opts = (isArgsArray ? params[1] : params[0]) as cp.SpawnOptions | undefined
      return nodeSpawn(binaryPath, args, {
        ...opts,
        env: buildEnv(binaryPath, opts?.env),
      })
    },

    spawnSync(...params: unknown[]) {
      const isArgsArray = Array.isArray(params[0])
      const args = isArgsArray ? (params[0] as string[]) : []
      const opts = (isArgsArray ? params[1] : params[0]) as cp.SpawnSyncOptions | undefined
      return nodeSpawnSync(binaryPath, args, {
        ...opts,
        env: buildEnv(binaryPath, opts?.env),
      })
    },

    exec(...params: unknown[]) {
      const isOptionsFirst = params[0] != null && typeof params[0] !== 'function'
      const options = isOptionsFirst ? (params[0] as cp.ExecOptions) : undefined
      const cb = (isOptionsFirst ? params[1] : params[0]) as Parameters<typeof nodeExec>[2]
      return nodeExec(binaryPath, { ...options, env: buildEnv(binaryPath, options?.env) }, cb)
    },

    execSync(...params: unknown[]) {
      const options = params[0] as cp.ExecSyncOptions | undefined
      return nodeExecSync(binaryPath, {
        ...options,
        env: buildEnv(binaryPath, options?.env),
      })
    },
  } as BinaryRunner
}
