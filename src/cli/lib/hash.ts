import { createHash } from 'crypto'
import { readFile } from '../utils/fs'

/**
 * Length of the content hash prefix used in lock files
 */
const HASH_PREFIX_LENGTH = 7

/**
 * Generate a SHA-256 hash of content and return the first 7 characters
 */
export function hashContent(content: string): string {
  const hash = createHash('sha256')
  hash.update(content)
  return hash.digest('hex').slice(0, HASH_PREFIX_LENGTH)
}

/**
 * Generate a content hash for a file
 */
export async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath)
  return hashContent(content)
}

/**
 * Generate a combined hash for multiple files (sorted for consistency)
 * Used for generating stack digest from all skill hashes
 */
export function combineHashes(hashes: string[]): string {
  const sorted = [...hashes].sort()
  const combined = sorted.join('')
  return hashContent(combined)
}
