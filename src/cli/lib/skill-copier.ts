import path from 'path'
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml'
import { copy, ensureDir, readFile, writeFile } from '../utils/fs'
import { hashFile } from './hash'
import { PROJECT_ROOT, DIRS } from '../consts'
import type { MergedSkillsMatrix, ResolvedSkill } from '../types-matrix'

/**
 * Forked from metadata for provenance tracking
 */
interface ForkedFromMetadata {
  skill_id: string
  version: number
  content_hash: string
  date: string
}

/**
 * Metadata structure (subset needed for forked_from injection)
 */
interface SkillMetadata {
  version: number
  content_hash?: string
  forked_from?: ForkedFromMetadata
  // Allow other properties
  [key: string]: unknown
}

/**
 * Metadata file name
 */
const METADATA_FILE_NAME = 'metadata.yaml'

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
 * Get the current date in YYYY-MM-DD format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Inject forked_from metadata into a copied skill's metadata.yaml
 * - Preserves the yaml-language-server schema comment
 * - Records the original skill_id, version, and content_hash
 * - Resets local version to 1 (fresh fork)
 */
async function injectForkedFromMetadata(
  destPath: string,
  skillId: string,
  contentHash: string,
): Promise<void> {
  const metadataPath = path.join(destPath, METADATA_FILE_NAME)
  const rawContent = await readFile(metadataPath)

  // Extract the schema comment line if present
  const lines = rawContent.split('\n')
  let schemaComment = ''
  let yamlContent = rawContent

  if (lines[0]?.startsWith('# yaml-language-server:')) {
    schemaComment = lines[0] + '\n'
    yamlContent = lines.slice(1).join('\n')
  }

  // Parse the metadata
  const metadata = parseYaml(yamlContent) as SkillMetadata

  // Store the original version before resetting
  const originalVersion = metadata.version

  // Add forked_from provenance
  metadata.forked_from = {
    skill_id: skillId,
    version: originalVersion,
    content_hash: contentHash,
    date: getCurrentDate(),
  }

  // Reset local version to 1 (fresh fork)
  metadata.version = 1

  // Write back with schema comment preserved
  const newYamlContent = stringifyYaml(metadata, { lineWidth: 0 })
  await writeFile(metadataPath, schemaComment + newYamlContent)
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

  // Inject forked_from provenance tracking into the copied skill's metadata
  await injectForkedFromMetadata(destPath, skill.id, contentHash)

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
