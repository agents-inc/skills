import path from "path";
import { copy, ensureDir, directoryExists, glob } from "../utils/fs";
import { verbose } from "../utils/logger";
import type { Marketplace, MarketplacePlugin } from "../../types";

/**
 * Options for fetching skills
 */
export interface FetchSkillsOptions {
  /** Force refresh from remote source */
  forceRefresh?: boolean;
}

/**
 * Resolve the source URL for a plugin from the marketplace
 */
function resolvePluginSource(
  plugin: MarketplacePlugin,
  _marketplace: Marketplace,
): string {
  // If plugin has explicit sourceUrl in source object, use it
  if (typeof plugin.source === "object" && plugin.source.url) {
    return plugin.source.url;
  }

  // If source is a string path, return it directly
  if (typeof plugin.source === "string") {
    return plugin.source;
  }

  // Construct from GitHub source
  if (typeof plugin.source === "object" && plugin.source.repo) {
    const ref = plugin.source.ref ? `#${plugin.source.ref}` : "";
    return `github:${plugin.source.repo}${ref}`;
  }

  // Fallback to plugin name
  return plugin.name;
}

/**
 * Fetch skills from the marketplace and copy to output directory
 *
 * @param skillIds - Array of skill IDs to fetch (e.g., ["react", "zustand"])
 * @param marketplace - Marketplace data containing plugin registry
 * @param outputDir - Plugin output directory
 * @param sourcePath - Path to the cached/fetched marketplace source
 * @param options - Fetch options
 * @returns Array of skill IDs that were successfully copied
 */
export async function fetchSkills(
  skillIds: string[],
  marketplace: Marketplace,
  outputDir: string,
  sourcePath: string,
  _options: FetchSkillsOptions = {},
): Promise<string[]> {
  const skillsOutputDir = path.join(outputDir, "skills");
  await ensureDir(skillsOutputDir);

  const copiedSkills: string[] = [];

  for (const skillId of skillIds) {
    // Find skill plugin in marketplace
    const pluginName = `skill-${skillId}`;
    const plugin = marketplace.plugins.find((p) => p.name === pluginName);

    if (plugin) {
      verbose(`Found skill plugin in marketplace: ${pluginName}`);
      // Plugin source is used for future remote fetching
      const pluginSource = resolvePluginSource(plugin, marketplace);
      verbose(`Plugin source: ${pluginSource}`);
    }

    // Skills are stored in src/skills/ directory
    // The skillId might be a path like "frontend/react (@vince)"
    // We need to find the actual skill directory
    const skillSourceDir = path.join(sourcePath, "src", "skills");

    // Walk the skills directory to find matching skill
    const skillPath = await findSkillPath(skillSourceDir, skillId);

    if (!skillPath) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    // Get the relative path from src/skills for output structure
    const relativePath = path.relative(skillSourceDir, skillPath);
    const destPath = path.join(skillsOutputDir, relativePath);

    await ensureDir(path.dirname(destPath));
    await copy(skillPath, destPath);
    copiedSkills.push(skillId);
    verbose(`Copied skill: ${skillId} -> ${destPath}`);
  }

  return copiedSkills;
}

/**
 * Find a skill directory by skill ID
 * Searches recursively since skills may be nested (e.g., frontend/react)
 *
 * @param baseDir - Base skills directory to search in
 * @param skillId - Skill ID to find (can be full path or just name)
 * @returns Path to skill directory or null if not found
 */
async function findSkillPath(
  baseDir: string,
  skillId: string,
): Promise<string | null> {
  // Check if base directory exists
  if (!(await directoryExists(baseDir))) {
    verbose(`Skills base directory not found: ${baseDir}`);
    return null;
  }

  // If skillId contains a path separator, it's a full path
  if (skillId.includes("/")) {
    const fullPath = path.join(baseDir, skillId);
    if (await directoryExists(fullPath)) {
      return fullPath;
    }
    // Try without author suffix (e.g., "frontend/framework/react (@vince)" -> "frontend/framework/react")
    const pathWithoutAuthor = skillId.replace(/\s*\(@\w+\)$/, "");
    const pathWithoutAuthorFull = path.join(baseDir, pathWithoutAuthor);
    if (await directoryExists(pathWithoutAuthorFull)) {
      return pathWithoutAuthorFull;
    }
  }

  // Otherwise search by skill name in all subdirectories
  // Escape special regex characters in skillId for glob pattern
  const escapedSkillId = skillId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = await glob(`**/${escapedSkillId}*/SKILL.md`, baseDir);

  if (matches.length > 0) {
    // Return the directory containing SKILL.md
    return path.join(baseDir, path.dirname(matches[0]));
  }

  // Try searching without author suffix in skill name
  const skillNameWithoutAuthor = skillId.replace(/\s*\(@\w+\)$/, "");
  if (skillNameWithoutAuthor !== skillId) {
    const escapedName = skillNameWithoutAuthor.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const matchesWithoutAuthor = await glob(
      `**/${escapedName}*/SKILL.md`,
      baseDir,
    );
    if (matchesWithoutAuthor.length > 0) {
      return path.join(baseDir, path.dirname(matchesWithoutAuthor[0]));
    }
  }

  return null;
}
