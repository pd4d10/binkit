import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Read package.json to get author and license
const pkgPath = path.join(__dirname, '..', '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

/** Package author from package.json */
export const AUTHOR: string = pkg.author

/** Package license from package.json */
export const LICENSE: string = pkg.license

/** NPM scope for all BinKit packages */
export const SCOPE = '@binkit'

/**
 * BinKit framework major version.
 * Increment when making breaking changes to the framework.
 */
export const FRAMEWORK_MAJOR_VERSION = 0
