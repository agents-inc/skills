import path from "path";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import { copy, ensureDir, readFile, writeFile } from "../utils/fs";
import { hashFile } from "./hash";
import type { MergedSkillsMatrix, ResolvedSkill } from "../types-matrix";
import type { SourceLoadResult } from "./source-loader";

/**
 * Forked from metadata for provenance tracking
 */
interface ForkedFromMetadata {
  skill_id: string;
  content_hash: string;
  date: string;
}

/**
 * Metadata structure (subset needed for forked_from injection)
 */
interface SkillMetadata {
  content_hash?: string;
  forked_from?: ForkedFromMetadata;
  // Allow other properties
  [key: string]: unknown;
}

/**
 * Metadata file name
 */
const METADATA_FILE_NAME = "metadata.yaml";

/**
 * Result of copying a skill
 */
export interface CopiedSkill {
  skillId: string;
  contentHash: string;
  sourcePath: string;
  destPath: string;
  /** True if this is a local skill (not copied, stays in place) */
  local?: boolean;
}

/**
 * Get the source path for a skill in the registry
 */
function getSkillSourcePath(
  skill: ResolvedSkill,
  registryRoot: string,
): string {
  // skill.path is like "skills/frontend/client-state-management/zustand (@vince)/"
  // We need to join with the registry root
  return path.join(registryRoot, "src", skill.path);
}

/**
 * Get the destination path for a skill in the local stack
 */
function getSkillDestPath(skill: ResolvedSkill, stackDir: string): string {
  // Extract the skill path without "skills/" prefix
  // skill.path is like "skills/frontend/client-state-management/zustand (@vince)/"
  const skillRelativePath = skill.path.replace(/^skills\//, "");
  return path.join(stackDir, "skills", skillRelativePath);
}

/**
 * Generate content hash for a skill (hash of SKILL.md)
 */
async function generateSkillHash(skillSourcePath: string): Promise<string> {
  const skillMdPath = path.join(skillSourcePath, "SKILL.md");
  return hashFile(skillMdPath);
}

/**
 * Get the current date in YYYY-MM-DD format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Inject forked_from metadata into a copied skill's metadata.yaml
 * - Removes the yaml-language-server schema comment (path is invalid in destination)
 * - Records the original skill_id and content_hash for provenance tracking
 */
async function injectForkedFromMetadata(
  destPath: string,
  skillId: string,
  contentHash: string,
): Promise<void> {
  const metadataPath = path.join(destPath, METADATA_FILE_NAME);
  const rawContent = await readFile(metadataPath);

  // Remove the schema comment line if present (path is invalid in copied location)
  const lines = rawContent.split("\n");
  let yamlContent = rawContent;

  if (lines[0]?.startsWith("# yaml-language-server:")) {
    yamlContent = lines.slice(1).join("\n");
  }

  // Parse the metadata
  const metadata = parseYaml(yamlContent) as SkillMetadata;

  // Add forked_from provenance (content_hash is the primary identifier)
  metadata.forked_from = {
    skill_id: skillId,
    content_hash: contentHash,
    date: getCurrentDate(),
  };

  // Write back without schema comment
  const newYamlContent = stringifyYaml(metadata, { lineWidth: 0 });
  await writeFile(metadataPath, newYamlContent);
}

/**
 * Copy a single skill from registry to local stack
 */
export async function copySkill(
  skill: ResolvedSkill,
  stackDir: string,
  registryRoot: string,
): Promise<CopiedSkill> {
  const sourcePath = getSkillSourcePath(skill, registryRoot);
  const destPath = getSkillDestPath(skill, stackDir);

  // Generate content hash before copying
  const contentHash = await generateSkillHash(sourcePath);

  // Ensure destination directory exists and copy
  await ensureDir(path.dirname(destPath));
  await copy(sourcePath, destPath);

  // Inject forked_from provenance tracking into the copied skill's metadata
  await injectForkedFromMetadata(destPath, skill.id, contentHash);

  return {
    skillId: skill.id,
    contentHash,
    sourcePath,
    destPath,
  };
}

/**
 * Get the source path for a skill from a SourceLoadResult
 */
function getSkillSourcePathFromSource(
  skill: ResolvedSkill,
  sourceResult: SourceLoadResult,
): string {
  // skill.path is like "skills/frontend/client-state-management/zustand (@vince)/"
  // sourcePath is the root of the fetched content (local or cached remote)
  return path.join(sourceResult.sourcePath, "src", skill.path);
}

/**
 * Copy a single skill from a source to local stack
 */
export async function copySkillFromSource(
  skill: ResolvedSkill,
  stackDir: string,
  sourceResult: SourceLoadResult,
): Promise<CopiedSkill> {
  const sourcePath = getSkillSourcePathFromSource(skill, sourceResult);
  const destPath = getSkillDestPath(skill, stackDir);

  // Generate content hash before copying
  const contentHash = await generateSkillHash(sourcePath);

  // Ensure destination directory exists and copy
  await ensureDir(path.dirname(destPath));
  await copy(sourcePath, destPath);

  // Inject forked_from provenance tracking into the copied skill's metadata
  await injectForkedFromMetadata(destPath, skill.id, contentHash);

  return {
    skillId: skill.id,
    contentHash,
    sourcePath,
    destPath,
  };
}

/**
 * Copy all selected skills to a plugin directory from a source
 * This is the primary method for single-plugin-per-project architecture
 *
 * Local skills (from .claude/skills/) are NOT copied - they stay in place
 * and are referenced by their relative path from project root.
 */
export async function copySkillsToPluginFromSource(
  selectedSkillIds: string[],
  pluginDir: string,
  matrix: MergedSkillsMatrix,
  sourceResult: SourceLoadResult,
): Promise<CopiedSkill[]> {
  const copiedSkills: CopiedSkill[] = [];

  for (const skillId of selectedSkillIds) {
    const skill = matrix.skills[skillId];
    if (!skill) {
      console.warn(`Warning: Skill not found in matrix: ${skillId}`);
      continue;
    }

    // Skip copying local skills - they stay in place
    if (skill.local && skill.localPath) {
      // Compute hash from the local skill's SKILL.md in the project directory
      const localSkillPath = path.join(process.cwd(), skill.localPath);
      const contentHash = await generateSkillHash(localSkillPath);

      copiedSkills.push({
        skillId: skill.id,
        sourcePath: skill.localPath, // Relative path from project root
        destPath: skill.localPath, // Same - not copied
        contentHash,
        local: true,
      });
      continue;
    }

    const copied = await copySkillFromSource(skill, pluginDir, sourceResult);
    copiedSkills.push(copied);
  }

  return copiedSkills;
}
