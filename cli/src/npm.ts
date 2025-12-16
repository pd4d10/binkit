/**
 * NPM registry utilities
 */

import { FRAMEWORK_MAJOR_VERSION, SCOPE } from './constants.js'

interface NpmVersionMetadata {
  version: string
  upstreamVersion?: string
}

interface NpmRegistryResponse {
  versions: Record<string, NpmVersionMetadata>
}

/**
 * Fetch published versions from npm registry
 */
export async function fetchPublishedVersions(packageName: string): Promise<string[]> {
  const metadata = await fetchPublishedMetadata(packageName)
  return Object.keys(metadata)
}

/**
 * Fetch published version metadata from npm registry
 * Returns a map of package version to metadata (including upstreamVersion)
 */
export async function fetchPublishedMetadata(
  packageName: string
): Promise<Record<string, NpmVersionMetadata>> {
  const url = `https://registry.npmjs.org/${packageName}`

  try {
    const response = await fetch(url)
    if (response.status === 404) {
      // Package not published yet
      return {}
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch npm info: ${response.status}`)
    }

    const data = (await response.json()) as NpmRegistryResponse
    return data.versions
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // Network error, assume no versions published
      return {}
    }
    throw error
  }
}

/**
 * Calculate the next package version based on upstream version and published versions.
 *
 * Version format: {FRAMEWORK_MAJOR_VERSION}.{upstream-major}.{patch}
 * - FRAMEWORK_MAJOR_VERSION: BinKit framework major version
 * - upstream-major: major version from upstream (e.g., 35 from 35.0.2)
 * - patch: incremented for each release of the same upstream major
 */
export function calculatePackageVersion(
  upstreamVersion: string,
  publishedVersions: string[]
): string {
  // Extract upstream major version (e.g., "35" from "35.0.2")
  const upstreamMajor = upstreamVersion.split('.')[0]

  // Find all published versions matching {FRAMEWORK_MAJOR_VERSION}.{upstreamMajor}.x
  const prefix = `${FRAMEWORK_MAJOR_VERSION}.${upstreamMajor}.`
  const matchingVersions = publishedVersions.filter((v) => v.startsWith(prefix))

  if (matchingVersions.length === 0) {
    return `${FRAMEWORK_MAJOR_VERSION}.${upstreamMajor}.0`
  }

  // Find the highest patch version
  const patches = matchingVersions.map((v) => {
    const patch = v.slice(prefix.length)
    return parseInt(patch, 10)
  })
  const maxPatch = Math.max(...patches)

  return `${FRAMEWORK_MAJOR_VERSION}.${upstreamMajor}.${maxPatch + 1}`
}

/**
 * Get the package version to use for a given tool and upstream version.
 * Queries npm and calculates the next version.
 */
export async function getPackageVersion(
  name: string,
  upstreamVersion: string
): Promise<string> {
  const packageName = `${SCOPE}/${name}`
  const publishedVersions = await fetchPublishedVersions(packageName)
  return calculatePackageVersion(upstreamVersion, publishedVersions)
}

/**
 * Check if an upstream version is already published to npm.
 * Checks the upstreamVersion field in package metadata.
 */
export function isVersionPublished(
  upstreamVersion: string,
  publishedMetadata: Record<string, NpmVersionMetadata>
): boolean {
  return Object.values(publishedMetadata).some(
    (meta) => meta.upstreamVersion === upstreamVersion
  )
}

/**
 * Result of checking a tool for unpublished versions
 */
export interface UnpublishedVersion {
  tool: string
  upstreamVersion: string
}

/**
 * Check all tools in the registry for unpublished versions.
 * Returns a list of tool/version pairs that need to be published.
 */
export async function getUnpublishedVersions(
  entries: Record<string, { versions: string[] }>
): Promise<UnpublishedVersion[]> {
  const unpublished: UnpublishedVersion[] = []

  for (const [tool, entry] of Object.entries(entries)) {
    const packageName = `${SCOPE}/${tool}`
    const publishedMetadata = await fetchPublishedMetadata(packageName)

    for (const upstreamVersion of entry.versions) {
      if (!isVersionPublished(upstreamVersion, publishedMetadata)) {
        unpublished.push({ tool, upstreamVersion })
      }
    }
  }

  return unpublished
}
