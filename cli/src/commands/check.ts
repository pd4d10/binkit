/**
 * Check command - finds unpublished versions in the registry
 */

import { entries } from 'binkit-registry'
import { SCOPE } from '../constants.js'

/**
 * Check all tools for unpublished versions and output results for CI
 */
export async function runCheck(): Promise<void> {
  console.log('Checking for unpublished versions...')
  console.log('')

  const unpublished: Record<string, string[]> = {}

  for (const [name, entry] of Object.entries(entries)) {
    // Fetch published metadata from npm registry
    const publishedMetadata = await fetchNpmMetadata(`${SCOPE}/${name}`)

    // Find versions not yet published
    const unpublishedVersions = entry.versions.filter(
      (version) => !Object.values(publishedMetadata).some((meta) => meta.upstreamVersion === version)
    )

    if (unpublishedVersions.length > 0) {
      unpublished[name] = unpublishedVersions
    }
  }

  // Output results
  if (Object.keys(unpublished).length === 0) {
    console.log('✓ All versions are published')
    console.log('')
    console.log('UNPUBLISHED_JSON=[]')
  } else {
    console.log('Unpublished versions:')
    const matrix = Object.entries(unpublished).flatMap(([name, versions]) =>
      versions.map((version) => {
        console.log(`  - ${name}@${version}`)
        return { name, version }
      })
    )
    console.log('')
    console.log(`UNPUBLISHED_JSON=${JSON.stringify(matrix)}`)
  }
}

// ============================================================================
// NPM Registry (inline - only used here)
// ============================================================================

interface NpmVersionMetadata {
  version: string
  upstreamVersion?: string
}

async function fetchNpmMetadata(packageName: string): Promise<Record<string, NpmVersionMetadata>> {
  const url = `https://registry.npmjs.org/${packageName}`

  try {
    const response = await fetch(url)
    if (response.status === 404) return {}
    if (!response.ok) throw new Error(`Failed to fetch npm info: ${response.status}`)

    const data = (await response.json()) as { versions: Record<string, NpmVersionMetadata> }
    return data.versions
  } catch (error) {
    // Network error - assume no versions published
    if (error instanceof TypeError && error.message.includes('fetch')) return {}
    throw error
  }
}
