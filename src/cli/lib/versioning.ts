import { createHash } from 'crypto'
import path from 'path'
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml'
import { readFile, writeFile, glob, fileExists } from '../utils/fs'
import { verbose } from '../utils/logger'

/**
 * Length of the content hash prefix
 */
const HASH_PREFIX_LENGTH = 7

/**
 * Metadata file name
 */
const METADATA_FILE_NAME = 'metadata.yaml'

/**
 * Files to include in the hash calculation (in priority order)
 */
const HASHABLE_FILES = ['SKILL.md', 'reference.md']

/**
 * Directories to include in the hash calculation
 */
const HASHABLE_DIRS = ['examples', 'scripts']

/**
 * Metadata structure for versioning
 */
interface VersionedMetadata {
  version: number
  content_hash?: string
  updated?: string
  [key: string]: unknown
}

/**
 * Result of version checking a skill
 */
export interface VersionCheckResult {
  skillPath: string
  previousVersion: number
  newVersion: number
  previousHash: string | undefined
  newHash: string
  changed: boolean
}

/**
 * Get the current date in YYYY-MM-DD format
 */
export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Hash a string content and return the first 7 characters of SHA-256
 */
export function hashString(content: string): string {
  const hash = createHash('sha256')
  hash.update(content)
  return hash.digest('hex').slice(0, HASH_PREFIX_LENGTH)
}

/**
 * Calculate a combined hash for all content in a skill folder
 * Includes SKILL.md, reference.md, and all files in examples/ and scripts/
 */
export async function hashSkillFolder(skillPath: string): Promise<string> {
  const contents: string[] = []

  // Hash main files
  for (const fileName of HASHABLE_FILES) {
    const filePath = path.join(skillPath, fileName)
    if (await fileExists(filePath)) {
      const content = await readFile(filePath)
      contents.push(`${fileName}:${content}`)
    }
  }

  // Hash files in subdirectories
  for (const dirName of HASHABLE_DIRS) {
    const dirPath = path.join(skillPath, dirName)
    if (await fileExists(dirPath)) {
      const files = await glob('**/*', dirPath)
      for (const file of files.sort()) {
        const filePath = path.join(dirPath, file)
        const content = await readFile(filePath)
        contents.push(`${dirName}/${file}:${content}`)
      }
    }
  }

  // Combine all contents and hash
  const combined = contents.join('\n---\n')
  return hashString(combined)
}

/**
 * Read and parse metadata.yaml, preserving the schema comment
 */
async function readMetadata(
  skillPath: string
): Promise<{ metadata: VersionedMetadata; schemaComment: string }> {
  const metadataPath = path.join(skillPath, METADATA_FILE_NAME)
  const rawContent = await readFile(metadataPath)

  // Extract the schema comment line if present
  const lines = rawContent.split('\n')
  let schemaComment = ''
  let yamlContent = rawContent

  if (lines[0]?.startsWith('# yaml-language-server:')) {
    schemaComment = lines[0] + '\n'
    yamlContent = lines.slice(1).join('\n')
  }

  const metadata = parseYaml(yamlContent) as VersionedMetadata
  return { metadata, schemaComment }
}

/**
 * Write metadata.yaml back, preserving the schema comment
 */
async function writeMetadata(
  skillPath: string,
  metadata: VersionedMetadata,
  schemaComment: string
): Promise<void> {
  const metadataPath = path.join(skillPath, METADATA_FILE_NAME)
  const yamlContent = stringifyYaml(metadata, { lineWidth: 0 })
  await writeFile(metadataPath, schemaComment + yamlContent)
}

/**
 * Check and update version for a single skill if content has changed
 * Returns information about the version check
 */
export async function versionSkill(skillPath: string): Promise<VersionCheckResult> {
  // Calculate current content hash
  const newHash = await hashSkillFolder(skillPath)

  // Read existing metadata
  const { metadata, schemaComment } = await readMetadata(skillPath)
  const previousVersion = metadata.version
  const previousHash = metadata.content_hash

  // Check if content has changed
  const changed = previousHash !== newHash

  if (changed) {
    // Update metadata
    metadata.version = previousVersion + 1
    metadata.content_hash = newHash
    metadata.updated = getCurrentDate()

    // Write back
    await writeMetadata(skillPath, metadata, schemaComment)

    verbose(`  Version bumped: ${skillPath} (v${previousVersion} -> v${metadata.version})`)
  }

  return {
    skillPath,
    previousVersion,
    newVersion: changed ? previousVersion + 1 : previousVersion,
    previousHash,
    newHash,
    changed,
  }
}

/**
 * Version all skills in the skills directory
 * Only updates skills where content has changed
 */
export async function versionAllSkills(skillsDir: string): Promise<VersionCheckResult[]> {
  const results: VersionCheckResult[] = []

  // Find all metadata.yaml files (each represents a skill)
  const metadataFiles = await glob('**/metadata.yaml', skillsDir)

  for (const metadataFile of metadataFiles) {
    const skillPath = path.join(skillsDir, path.dirname(metadataFile))

    try {
      const result = await versionSkill(skillPath)
      results.push(result)
    } catch (error) {
      console.warn(`  Warning: Failed to version skill at ${skillPath}: ${error}`)
    }
  }

  return results
}

/**
 * Print version check results summary
 */
export function printVersionResults(results: VersionCheckResult[]): void {
  const changed = results.filter((r) => r.changed)
  const unchanged = results.filter((r) => !r.changed)

  if (changed.length > 0) {
    console.log(`\n  Version Updates:`)
    for (const result of changed) {
      const skillName = path.basename(result.skillPath)
      console.log(`    ✓ ${skillName}: v${result.previousVersion} -> v${result.newVersion}`)
    }
  }

  console.log(`\n  Summary: ${changed.length} updated, ${unchanged.length} unchanged`)
}
