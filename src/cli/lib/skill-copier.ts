import path from 'path'
import { copy, ensureDir, readFile } from '../utils/fs'
import { hashFile } from './hash'
import { PROJECT_ROOT, DIRS } from '../consts'
import type { MergedSkillsMatrix, ResolvedSkill } from '../types-matrix'

/**
 * Result of copying a skill
 */
export interface CopiedSkill {
  skillId: string
  version: string
  contentHash: string
  sourcePath: string
  destPath: string
}

/**
 * Get the source path for a skill in the registry
 */
function getSkillSourcePath(skill: ResolvedSkill, registryRoot: string): string {
  // skill.path is like "skills/frontend/client-state-management/zustand (@vince)/"
  // We need to join with the registry root
  return path.join(registryRoot, 'src', skill.path)
}

/**
 * Get the destination path for a skill in the local stack
 */
function getSkillDestPath(skill: ResolvedSkill, stackDir: string): string {
  // Extract the skill path without "skills/" prefix
  // skill.path is like "skills/frontend/client-state-management/zustand (@vince)/"
  const skillRelativePath = skill.path.replace(/^skills\//, '')
  return path.join(stackDir, 'skills', skillRelativePath)
}

/**
 * Generate content hash for a skill (hash of SKILL.md)
 */
async function generateSkillHash(skillSourcePath: string): Promise<string> {
  const skillMdPath = path.join(skillSourcePath, 'SKILL.md')
  return hashFile(skillMdPath)
}

/**
 * Copy a single skill from registry to local stack
 */
export async function copySkill(
  skill: ResolvedSkill,
  stackDir: string,
  registryRoot: string,
): Promise<CopiedSkill> {
  const sourcePath = getSkillSourcePath(skill, registryRoot)
  const destPath = getSkillDestPath(skill, stackDir)

  // Generate content hash before copying
  const contentHash = await generateSkillHash(sourcePath)

  // Ensure destination directory exists and copy
  await ensureDir(path.dirname(destPath))
  await copy(sourcePath, destPath)

  return {
    skillId: skill.id,
    version: skill.version,
    contentHash,
    sourcePath,
    destPath,
  }
}

/**
 * Copy all selected skills to a stack directory
 */
export async function copySkillsToStack(
  selectedSkillIds: string[],
  stackDir: string,
  matrix: MergedSkillsMatrix,
  registryRoot: string = PROJECT_ROOT,
): Promise<CopiedSkill[]> {
  const copiedSkills: CopiedSkill[] = []

  for (const skillId of selectedSkillIds) {
    const skill = matrix.skills[skillId]
    if (!skill) {
      console.warn(`Warning: Skill not found in matrix: ${skillId}`)
      continue
    }

    const copied = await copySkill(skill, stackDir, registryRoot)
    copiedSkills.push(copied)
  }

  return copiedSkills
}

/**
 * Get the stack directory path
 */
export function getStackDir(projectDir: string, stackName: string): string {
  return path.join(projectDir, '.claude', 'stacks', stackName)
}
