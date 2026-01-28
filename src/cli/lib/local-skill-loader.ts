import { parse as parseYaml } from "yaml";
import path from "path";
import {
  directoryExists,
  listDirectories,
  fileExists,
  readFile,
} from "../utils/fs";
import { verbose } from "../utils/logger";
import { LOCAL_SKILLS_PATH } from "../consts";
import { parseFrontmatter } from "./loader";
import type { ExtractedSkillMetadata } from "../types-matrix";

/**
 * Local skill category constant
 */
const LOCAL_CATEGORY = "local";

/**
 * Local skill author constant
 */
const LOCAL_AUTHOR = "@local";

/**
 * Prefix for test skills (temporary workaround)
 */
const TEST_SKILL_PREFIX = "test-";

/**
 * Metadata from local skill's metadata.yaml file
 */
interface LocalRawMetadata {
  /** Required for skill to load. Short display name for CLI (e.g., "Company Patterns") */
  cli_name: string;
  /** Short description for CLI display (5-6 words). Falls back to SKILL.md frontmatter. */
  cli_description?: string;
}

/**
 * Result of local skill discovery
 */
export interface LocalSkillDiscoveryResult {
  /** Discovered local skills */
  skills: ExtractedSkillMetadata[];
  /** Absolute path to .claude/skills/ directory */
  localSkillsPath: string;
}

/**
 * Discover local skills from .claude/skills/ directory
 *
 * Local skills are user-defined skills that appear in the wizard alongside
 * repository skills. They must have:
 * - metadata.yaml with cli_name (required)
 * - SKILL.md with frontmatter (required)
 *
 * @param projectDir - Absolute path to the project root
 * @returns Discovery result with skills array, or null if .claude/skills/ doesn't exist
 */
export async function discoverLocalSkills(
  projectDir: string,
): Promise<LocalSkillDiscoveryResult | null> {
  const localSkillsPath = path.join(projectDir, LOCAL_SKILLS_PATH);

  // Check if .claude/skills/ exists
  if (!(await directoryExists(localSkillsPath))) {
    verbose(`Local skills directory not found: ${localSkillsPath}`);
    return null;
  }

  const skills: ExtractedSkillMetadata[] = [];

  // List all subdirectories in .claude/skills/
  const skillDirs = await listDirectories(localSkillsPath);

  for (const skillDirName of skillDirs) {
    // TEMPORARY WORKAROUND: Only discover skills with test- prefix
    // TODO: Remove this filter when ready to enable full local skill discovery
    if (!skillDirName.startsWith(TEST_SKILL_PREFIX)) {
      verbose(
        `Skipping local skill '${skillDirName}': Does not have test- prefix (temporary filter)`,
      );
      continue;
    }

    // Full discovery code (commented out for now):
    // const skill = await extractLocalSkill(localSkillsPath, skillDirName);
    // if (skill) {
    //   skills.push(skill);
    // }

    // Filtered version (enabled):
    const skill = await extractLocalSkill(localSkillsPath, skillDirName);
    if (skill) {
      skills.push(skill);
    }
  }

  verbose(`Discovered ${skills.length} local skills from ${localSkillsPath}`);

  return {
    skills,
    localSkillsPath,
  };
}

/**
 * Extract metadata from a single local skill directory
 *
 * @param localSkillsPath - Absolute path to .claude/skills/
 * @param skillDirName - Name of the skill subdirectory
 * @returns Extracted skill metadata, or null if invalid
 */
async function extractLocalSkill(
  localSkillsPath: string,
  skillDirName: string,
): Promise<ExtractedSkillMetadata | null> {
  const skillDir = path.join(localSkillsPath, skillDirName);
  const metadataPath = path.join(skillDir, "metadata.yaml");
  const skillMdPath = path.join(skillDir, "SKILL.md");

  // Check metadata.yaml exists
  if (!(await fileExists(metadataPath))) {
    verbose(`Skipping local skill '${skillDirName}': No metadata.yaml found`);
    return null;
  }

  // Check SKILL.md exists
  if (!(await fileExists(skillMdPath))) {
    verbose(`Skipping local skill '${skillDirName}': No SKILL.md found`);
    return null;
  }

  // Read and parse metadata.yaml
  const metadataContent = await readFile(metadataPath);
  const metadata = parseYaml(metadataContent) as LocalRawMetadata;

  // cli_name is required
  if (!metadata.cli_name) {
    verbose(
      `Skipping local skill '${skillDirName}': Missing required 'cli_name' in metadata.yaml`,
    );
    return null;
  }

  // Read and parse SKILL.md frontmatter
  const skillMdContent = await readFile(skillMdPath);
  const frontmatter = parseFrontmatter(skillMdContent);

  if (!frontmatter) {
    verbose(
      `Skipping local skill '${skillDirName}': Invalid SKILL.md frontmatter`,
    );
    return null;
  }

  // Build relative path from project root
  const relativePath = `${LOCAL_SKILLS_PATH}/${skillDirName}/`;

  // Use frontmatter name as the canonical skill ID
  const skillId = frontmatter.name;

  // Build extracted skill metadata
  const extracted: ExtractedSkillMetadata = {
    // Identity (from SKILL.md frontmatter - this is the canonical ID)
    id: skillId,
    // Store directory path for filesystem access
    directoryPath: skillDirName,
    // Display name format: "cli_name @local"
    name: `${metadata.cli_name} ${LOCAL_AUTHOR}`,
    // Use cli_description from metadata.yaml, fallback to frontmatter description
    description: metadata.cli_description || frontmatter.description,
    usageGuidance: undefined,

    // Catalog data - always "local" category for local skills
    category: LOCAL_CATEGORY,
    categoryExclusive: false,
    author: LOCAL_AUTHOR,
    tags: [],

    // Relationships - local skills have no relationships
    compatibleWith: [],
    conflictsWith: [],
    requires: [],

    // Setup relationships - local skills have no setup relationships
    requiresSetup: [],
    providesSetupFor: [],

    // Location - relative path from project root
    path: relativePath,

    // Local skill flags
    local: true,
    localPath: relativePath,
  };

  verbose(`Extracted local skill: ${skillId}`);
  return extracted;
}
