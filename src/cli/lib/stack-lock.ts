import path from 'path'
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml'
import { readFile, writeFile, fileExists } from '../utils/fs'
import { combineHashes } from './hash'
import type { CopiedSkill } from './skill-copier'

/**
 * Stack lock file version
 */
const LOCKFILE_VERSION = 1

/**
 * Stack lock file name
 */
const STACK_LOCK_NAME = 'stack.lock.yaml'

/**
 * Resolved skill entry in the stack lock file
 */
export interface ResolvedSkillEntry {
  version: string
  content_hash: string
  updated: string
}

/**
 * Stack lock file structure
 */
export interface StackLockFile {
  lockfile_version: number
  generated: string
  stack_id: string
  digest: string
  resolved: Record<string, ResolvedSkillEntry>
}

/**
 * Get the stack lock file path
 */
export function getStackLockPath(stackDir: string): string {
  return path.join(stackDir, STACK_LOCK_NAME)
}

/**
 * Generate a stack lock file from copied skills
 */
export function generateStackLock(stackId: string, copiedSkills: CopiedSkill[]): StackLockFile {
  const resolved: Record<string, ResolvedSkillEntry> = {}
  const hashes: string[] = []
  const now = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  for (const skill of copiedSkills) {
    resolved[skill.skillId] = {
      version: skill.version,
      content_hash: skill.contentHash,
      updated: now,
    }
    hashes.push(skill.contentHash)
  }

  // Generate digest from all content hashes
  const digest = combineHashes(hashes)

  return {
    lockfile_version: LOCKFILE_VERSION,
    generated: new Date().toISOString(),
    stack_id: stackId,
    digest,
    resolved,
  }
}

/**
 * Write the stack lock file
 */
export async function writeStackLock(stackDir: string, lockFile: StackLockFile): Promise<void> {
  const lockPath = getStackLockPath(stackDir)
  const content = stringifyYaml(lockFile, { lineWidth: 0 })
  await writeFile(lockPath, content)
}

/**
 * Read the stack lock file
 * Returns null if the file doesn't exist
 */
export async function readStackLock(stackDir: string): Promise<StackLockFile | null> {
  const lockPath = getStackLockPath(stackDir)
  const exists = await fileExists(lockPath)

  if (!exists) {
    return null
  }

  const content = await readFile(lockPath)
  return parseYaml(content) as StackLockFile
}

/**
 * Check if a skill has changed by comparing content hashes
 */
export function hasSkillChanged(
  skillId: string,
  newHash: string,
  existingLock: StackLockFile | null,
): boolean {
  if (!existingLock) {
    return true
  }

  const existing = existingLock.resolved[skillId]
  if (!existing) {
    return true
  }

  return existing.content_hash !== newHash
}
