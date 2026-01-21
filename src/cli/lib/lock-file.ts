import path from 'path'
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml'
import { readFile, writeFile, fileExists } from '../utils/fs'

/**
 * Lock file name (stored in .claude/)
 */
const LOCK_FILE_NAME = '.cc-lock.yaml'

/**
 * Stack entry in the lock file
 */
export interface LockFileStack {
  name: string
  added_at: string
  skill_count: number
}

/**
 * Lock file structure
 */
export interface LockFile {
  initialized_at: string
  cli_version: string
  stacks: LockFileStack[]
}

/**
 * Get the lock file path for a project directory
 */
export function getLockFilePath(projectDir: string): string {
  return path.join(projectDir, '.claude', LOCK_FILE_NAME)
}

/**
 * Check if a project has been initialized (lock file exists)
 */
export async function isInitialized(projectDir: string): Promise<boolean> {
  const lockPath = getLockFilePath(projectDir)
  return fileExists(lockPath)
}

/**
 * Read the lock file from a project directory
 * Returns null if the lock file doesn't exist
 */
export async function readLockFile(projectDir: string): Promise<LockFile | null> {
  const lockPath = getLockFilePath(projectDir)
  const exists = await fileExists(lockPath)

  if (!exists) {
    return null
  }

  const content = await readFile(lockPath)
  return parseYaml(content) as LockFile
}

/**
 * Write the lock file to a project directory
 */
export async function writeLockFile(projectDir: string, lockFile: LockFile): Promise<void> {
  const lockPath = getLockFilePath(projectDir)
  const content = stringifyYaml(lockFile, { lineWidth: 0 })
  await writeFile(lockPath, content)
}

/**
 * Create a new lock file for a project
 */
export function createLockFile(cliVersion: string): LockFile {
  return {
    initialized_at: new Date().toISOString(),
    cli_version: cliVersion,
    stacks: [],
  }
}

/**
 * Add a stack to the lock file
 */
export function addStackToLockFile(lockFile: LockFile, stackName: string, skillCount: number): void {
  // Check if stack already exists
  const existingIndex = lockFile.stacks.findIndex(s => s.name === stackName)
  if (existingIndex >= 0) {
    // Update existing stack
    lockFile.stacks[existingIndex] = {
      name: stackName,
      added_at: new Date().toISOString(),
      skill_count: skillCount,
    }
  } else {
    // Add new stack
    lockFile.stacks.push({
      name: stackName,
      added_at: new Date().toISOString(),
      skill_count: skillCount,
    })
  }
}

/**
 * Check if a stack name already exists in the lock file
 */
export function stackExists(lockFile: LockFile, stackName: string): boolean {
  return lockFile.stacks.some(s => s.name === stackName)
}

/**
 * Get all stack names from the lock file
 */
export function getStackNames(lockFile: LockFile): string[] {
  return lockFile.stacks.map(s => s.name)
}
