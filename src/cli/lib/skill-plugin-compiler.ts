import path from "path";
import { parse as parseYaml } from "yaml";
import {
  readFile,
  writeFile,
  ensureDir,
  glob,
  fileExists,
  copy,
} from "../utils/fs";
import { verbose } from "../utils/logger";
import {
  generateSkillPluginManifest,
  writePluginManifest,
  getPluginManifestPath,
} from "./plugin-manifest";
import { hashSkillFolder, getCurrentDate } from "./versioning";
import type {
  PluginManifest,
  SkillFrontmatter,
  SkillMetadataConfig,
} from "../../types";

/**
 * Options for compiling a single skill into a plugin
 */
export interface SkillPluginOptions {
  /** Path to skill directory (e.g., src/skills/frontend/react (@vince)) */
  skillPath: string;
  /** Base output directory (e.g., dist/plugins) */
  outputDir: string;
  /** Override skill name (defaults to extracted from directory name) */
  skillName?: string;
}

/**
 * Result of compiling a skill into a plugin
 */
export interface CompiledSkillPlugin {
  /** Path to the compiled plugin directory */
  pluginPath: string;
  /** Generated plugin manifest */
  manifest: PluginManifest;
  /** Skill name (extracted from directory) */
  skillName: string;
}

/**
 * Frontmatter regex for extracting YAML from markdown files
 */
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

/**
 * Files that should be copied to the plugin output
 */
const SKILL_FILES = ["SKILL.md", "reference.md"] as const;

/**
 * Directories that should be copied to the plugin output
 */
const SKILL_DIRS = ["examples", "scripts"] as const;

/**
 * Parse YAML frontmatter from a markdown file
 */
function parseFrontmatter(content: string): SkillFrontmatter | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return null;

  const yamlContent = match[1];
  const frontmatter = parseYaml(yamlContent) as SkillFrontmatter;

  if (!frontmatter.name || !frontmatter.description) return null;
  return frontmatter;
}

/**
 * Sanitize a skill name to be valid kebab-case
 * Replaces invalid characters like "+" with "-"
 */
function sanitizeSkillName(name: string): string {
  // Replace + with - for valid kebab-case
  return name.replace(/\+/g, "-");
}

/**
 * Default version for new plugins (semver format)
 */
const DEFAULT_VERSION = "1.0.0";

/**
 * Parse semver string to extract major version number
 */
function parseMajorVersion(version: string): number {
  const match = version.match(/^(\d+)\./);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Create a semver string with bumped major version
 */
function bumpMajorVersion(version: string): string {
  const major = parseMajorVersion(version);
  return `${major + 1}.0.0`;
}

/**
 * Internal state for tracking content hash between compiles
 * Hash is stored in a separate .content-hash file alongside plugin.json
 */
const CONTENT_HASH_FILE = ".content-hash";

/**
 * Read existing plugin manifest to get previous version
 */
async function readExistingManifest(
  pluginDir: string,
): Promise<{ version: string; contentHash: string | undefined } | null> {
  const manifestPath = getPluginManifestPath(pluginDir);

  if (!(await fileExists(manifestPath))) {
    return null;
  }

  try {
    const content = await readFile(manifestPath);
    const manifest = JSON.parse(content) as PluginManifest;

    // Try to read content hash from separate file
    const hashFilePath = manifestPath.replace("plugin.json", CONTENT_HASH_FILE);
    let contentHash: string | undefined;
    if (await fileExists(hashFilePath)) {
      contentHash = (await readFile(hashFilePath)).trim();
    }

    return {
      version: manifest.version ?? DEFAULT_VERSION,
      contentHash,
    };
  } catch {
    return null;
  }
}

/**
 * Determine version based on content hash comparison
 * Returns new version (bumped if content changed) and current hash
 */
async function determineVersion(
  skillPath: string,
  pluginDir: string,
): Promise<{ version: string; contentHash: string }> {
  // Calculate current content hash
  const newHash = await hashSkillFolder(skillPath);

  // Read existing manifest
  const existing = await readExistingManifest(pluginDir);

  if (!existing) {
    // New plugin - use default version
    return {
      version: DEFAULT_VERSION,
      contentHash: newHash,
    };
  }

  if (existing.contentHash !== newHash) {
    // Content changed - bump major version (1.0.0 -> 2.0.0)
    return {
      version: bumpMajorVersion(existing.version),
      contentHash: newHash,
    };
  }

  // No change - keep existing version
  return {
    version: existing.version,
    contentHash: newHash,
  };
}

/**
 * Extract skill name from directory path
 * Handles paths like "frontend/framework/react (@vince)" -> "react"
 */
export function extractSkillName(skillPath: string): string {
  // Get the last directory component
  const dirName = path.basename(skillPath);

  // Remove the (@author) suffix if present
  const withoutAuthor = dirName.replace(/\s*\(@\w+\)$/, "").trim();

  // Sanitize to valid kebab-case
  return sanitizeSkillName(withoutAuthor);
}

/**
 * Extract category from skill path relative to skills root
 * Handles paths like "frontend/framework/react (@vince)" -> "frontend"
 */
export function extractCategory(
  skillPath: string,
  skillsRoot: string,
): string | undefined {
  const relativePath = path.relative(skillsRoot, skillPath);
  const parts = relativePath.split(path.sep);
  // Category is the first directory (frontend, backend, setup, etc.)
  return parts.length > 1 ? parts[0] : undefined;
}

/**
 * Extract author from directory path
 * Handles paths like "frontend/framework/react (@vince)" -> "vince"
 */
export function extractAuthor(skillPath: string): string | undefined {
  const dirName = path.basename(skillPath);
  const match = dirName.match(/\(@(\w+)\)$/);
  return match ? match[1] : undefined;
}

/**
 * Read and parse metadata.yaml from a skill directory
 */
async function readSkillMetadata(
  skillPath: string,
): Promise<SkillMetadataConfig | null> {
  const metadataPath = path.join(skillPath, "metadata.yaml");

  if (!(await fileExists(metadataPath))) {
    return null;
  }

  try {
    const content = await readFile(metadataPath);
    // Strip schema comment if present
    const lines = content.split("\n");
    const yamlContent = lines[0]?.startsWith("# yaml-language-server:")
      ? lines.slice(1).join("\n")
      : content;

    return parseYaml(yamlContent) as SkillMetadataConfig;
  } catch {
    return null;
  }
}

/**
 * Generate README.md content for a skill plugin
 */
function generateReadme(
  skillName: string,
  frontmatter: SkillFrontmatter,
  metadata: SkillMetadataConfig | null,
): string {
  const lines: string[] = [];

  lines.push(`# ${skillName}`);
  lines.push("");
  lines.push(frontmatter.description);
  lines.push("");

  if (metadata?.tags && metadata.tags.length > 0) {
    lines.push("## Tags");
    lines.push("");
    lines.push(metadata.tags.map((t) => `\`${t}\``).join(" "));
    lines.push("");
  }

  lines.push("## Installation");
  lines.push("");
  lines.push("Add this plugin to your Claude Code configuration:");
  lines.push("");
  lines.push("```json");
  lines.push(`{`);
  lines.push(`  "plugins": ["skill-${skillName}"]`);
  lines.push(`}`);
  lines.push("```");
  lines.push("");

  lines.push("## Usage");
  lines.push("");
  lines.push(`This skill is automatically available when installed.`);
  if (metadata?.requires && metadata.requires.length > 0) {
    lines.push("");
    lines.push("**Requires:** " + metadata.requires.join(", "));
  }
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push("*Generated by Claude Collective skill-plugin-compiler*");
  lines.push("");

  return lines.join("\n");
}

/**
 * Compile a single skill into a standalone plugin
 */
export async function compileSkillPlugin(
  options: SkillPluginOptions,
): Promise<CompiledSkillPlugin> {
  const { skillPath, outputDir, skillName: overrideName } = options;

  // 1. Extract skill name from path
  const skillName = overrideName ?? extractSkillName(skillPath);
  const author = extractAuthor(skillPath);

  verbose(`Compiling skill plugin: ${skillName} from ${skillPath}`);

  // 2. Read SKILL.md and parse frontmatter
  const skillMdPath = path.join(skillPath, "SKILL.md");
  if (!(await fileExists(skillMdPath))) {
    throw new Error(
      `Skill '${skillName}' is missing required SKILL.md file. Expected at: ${skillMdPath}`,
    );
  }

  const skillMdContent = await readFile(skillMdPath);
  const frontmatter = parseFrontmatter(skillMdContent);

  if (!frontmatter) {
    throw new Error(
      `Skill '${skillName}' has invalid or missing YAML frontmatter in SKILL.md. ` +
        `Required fields: 'name' and 'description'. File: ${skillMdPath}`,
    );
  }

  // 3. Read metadata.yaml
  const metadata = await readSkillMetadata(skillPath);

  // 4. Create plugin directory structure
  const pluginDir = path.join(outputDir, `skill-${skillName}`);
  const skillsDir = path.join(pluginDir, "skills", skillName);

  await ensureDir(pluginDir);
  await ensureDir(skillsDir);

  // 5. Determine version based on content hash
  const { version, contentHash } = await determineVersion(skillPath, pluginDir);

  // 6. Generate and write plugin manifest
  const manifest = generateSkillPluginManifest({
    skillName,
    description: frontmatter.description,
    author: author ? `@${author}` : metadata?.author,
    version,
    keywords: metadata?.tags,
  });

  await writePluginManifest(pluginDir, manifest);

  // 7. Write content hash to separate file for internal tracking
  const hashFilePath = getPluginManifestPath(pluginDir).replace(
    "plugin.json",
    CONTENT_HASH_FILE,
  );
  await writeFile(hashFilePath, contentHash);

  verbose(`  Wrote plugin.json for ${skillName} (v${version})`);

  // 8. Copy SKILL.md (and transform frontmatter if needed)
  await writeFile(path.join(skillsDir, "SKILL.md"), skillMdContent);
  verbose(`  Copied SKILL.md`);

  // 9. Copy optional files (reference.md)
  for (const fileName of SKILL_FILES) {
    if (fileName === "SKILL.md") continue; // Already handled

    const sourcePath = path.join(skillPath, fileName);
    if (await fileExists(sourcePath)) {
      const content = await readFile(sourcePath);
      await writeFile(path.join(skillsDir, fileName), content);
      verbose(`  Copied ${fileName}`);
    }
  }

  // 10. Copy optional directories (examples, scripts)
  for (const dirName of SKILL_DIRS) {
    const sourceDir = path.join(skillPath, dirName);
    if (await fileExists(sourceDir)) {
      await copy(sourceDir, path.join(skillsDir, dirName));
      verbose(`  Copied ${dirName}/`);
    }
  }

  // 11. Generate and write README.md
  const readme = generateReadme(skillName, frontmatter, metadata);
  await writeFile(path.join(pluginDir, "README.md"), readme);
  verbose(`  Generated README.md`);

  return {
    pluginPath: pluginDir,
    manifest,
    skillName,
  };
}

/**
 * Compile all skills from a source directory into plugins
 */
export async function compileAllSkillPlugins(
  skillsDir: string,
  outputDir: string,
): Promise<CompiledSkillPlugin[]> {
  const results: CompiledSkillPlugin[] = [];

  // Find all skills by locating SKILL.md files
  const skillMdFiles = await glob("**/SKILL.md", skillsDir);

  // Build a map of skill names to detect collisions
  const skillNameMap = new Map<string, string[]>();
  for (const skillMdFile of skillMdFiles) {
    const skillPath = path.join(skillsDir, path.dirname(skillMdFile));
    const baseName = extractSkillName(skillPath);
    const existing = skillNameMap.get(baseName) ?? [];
    existing.push(skillPath);
    skillNameMap.set(baseName, existing);
  }

  // Track which base names have collisions
  const collidingNames = new Set<string>();
  for (const [name, paths] of skillNameMap.entries()) {
    if (paths.length > 1) {
      collidingNames.add(name);
      verbose(`Name collision detected for "${name}": ${paths.length} skills`);
    }
  }

  for (const skillMdFile of skillMdFiles) {
    const skillPath = path.join(skillsDir, path.dirname(skillMdFile));
    const baseName = extractSkillName(skillPath);

    // If there's a name collision, prefix with category
    let skillName = baseName;
    if (collidingNames.has(baseName)) {
      const category = extractCategory(skillPath, skillsDir);
      if (category) {
        skillName = `${category}-${baseName}`;
      }
    }

    try {
      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
        skillName,
      });
      results.push(result);
      console.log(`  [OK] skill-${result.skillName}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(
        `  [WARN] Failed to compile skill 'skill-${skillName}' from ${skillPath}: ${errorMessage}`,
      );
    }
  }

  return results;
}

/**
 * Print compilation summary
 */
export function printCompilationSummary(results: CompiledSkillPlugin[]): void {
  console.log(`\nCompiled ${results.length} skill plugins:`);
  for (const result of results) {
    console.log(`  - skill-${result.skillName} (v${result.manifest.version})`);
  }
}
