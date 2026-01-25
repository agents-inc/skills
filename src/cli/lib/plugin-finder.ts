import path from "path";
import os from "os";
import { fileExists, readFile, glob } from "../utils/fs";
import { verbose } from "../utils/logger";
import {
  CLAUDE_DIR,
  PLUGINS_SUBDIR,
  PLUGIN_MANIFEST_DIR,
  PLUGIN_MANIFEST_FILE,
} from "../consts";
import type { PluginManifest } from "../../types";
import type { MergedSkillsMatrix } from "../types-matrix";

/**
 * Get the user plugins directory path (~/.claude/plugins/)
 */
export function getUserPluginsDir(): string {
  return path.join(os.homedir(), CLAUDE_DIR, PLUGINS_SUBDIR);
}

/**
 * Get the collective plugin directory path (.claude/plugins/claude-collective/)
 * This is project-local, sibling to .claude-collective/
 */
export function getCollectivePluginDir(projectDir?: string): string {
  const dir = projectDir ?? process.cwd();
  return path.join(dir, CLAUDE_DIR, PLUGINS_SUBDIR, "claude-collective");
}

/**
 * Get the project plugins directory path (.claude/plugins/)
 */
export function getProjectPluginsDir(projectDir?: string): string {
  const dir = projectDir ?? process.cwd();
  return path.join(dir, CLAUDE_DIR, PLUGINS_SUBDIR);
}

/**
 * Get the skills directory within a plugin
 */
export function getPluginSkillsDir(pluginDir: string): string {
  return path.join(pluginDir, "skills");
}

/**
 * Get the agents directory within a plugin
 */
export function getPluginAgentsDir(pluginDir: string): string {
  return path.join(pluginDir, "agents");
}

/**
 * Get the manifest path within a plugin
 */
export function getPluginManifestPath(pluginDir: string): string {
  return path.join(pluginDir, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
}

/**
 * Read and parse a plugin manifest
 * Returns null if manifest doesn't exist or is invalid
 */
export async function readPluginManifest(
  pluginDir: string,
): Promise<PluginManifest | null> {
  const manifestPath = getPluginManifestPath(pluginDir);

  if (!(await fileExists(manifestPath))) {
    verbose(`  No manifest at ${manifestPath}`);
    return null;
  }

  try {
    const content = await readFile(manifestPath);
    const manifest = JSON.parse(content) as PluginManifest;

    // Basic validation - must have name
    if (!manifest.name || typeof manifest.name !== "string") {
      verbose(`  Invalid manifest at ${manifestPath}: missing name`);
      return null;
    }

    return manifest;
  } catch (error) {
    verbose(`  Failed to parse manifest at ${manifestPath}: ${error}`);
    return null;
  }
}

/**
 * Get skill IDs from a plugin's skills directory by reading SKILL.md files
 * and matching them to skills in the matrix.
 *
 * Uses the skill name from the SKILL.md frontmatter to find the matching
 * skill ID in the matrix.
 */
export async function getPluginSkillIds(
  pluginSkillsDir: string,
  matrix: MergedSkillsMatrix,
): Promise<string[]> {
  // Find all SKILL.md files
  const skillFiles = await glob("**/SKILL.md", pluginSkillsDir);
  const skillIds: string[] = [];

  // Build a lookup map from skill names to IDs
  const nameToId = new Map<string, string>();
  for (const [id, skill] of Object.entries(matrix.skills)) {
    nameToId.set(skill.name.toLowerCase(), id);
    // Also map by alias if present
    if (skill.alias) {
      nameToId.set(skill.alias.toLowerCase(), id);
    }
  }

  // Build a lookup map from directory patterns to IDs
  // Skill directories are named like: category/skill-name/SKILL.md
  // We can try to match by the directory name
  const dirToId = new Map<string, string>();
  for (const [id, skill] of Object.entries(matrix.skills)) {
    // Create various possible directory name patterns
    const baseName = skill.name.toLowerCase().replace(/\s+/g, "-");
    dirToId.set(baseName, id);

    // Also try the skill's ID parts (e.g., "frontend-state-zustand" -> "zustand")
    const idParts = id.split("/");
    const lastPart = idParts[idParts.length - 1];
    if (lastPart) {
      dirToId.set(lastPart.toLowerCase(), id);
    }
  }

  for (const skillFile of skillFiles) {
    const fullPath = path.join(pluginSkillsDir, skillFile);
    const content = await readFile(fullPath);

    // Try to extract skill name from frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const nameMatch = frontmatter.match(/^name:\s*["']?(.+?)["']?\s*$/m);
      if (nameMatch) {
        const skillName = nameMatch[1].trim();
        const skillId = nameToId.get(skillName.toLowerCase());
        if (skillId) {
          skillIds.push(skillId);
          continue;
        }
      }
    }

    // Fallback: try to match by directory name
    const dirPath = path.dirname(skillFile);
    const dirName = path.basename(dirPath);
    const skillId = dirToId.get(dirName.toLowerCase());
    if (skillId) {
      skillIds.push(skillId);
    }
  }

  return skillIds;
}
