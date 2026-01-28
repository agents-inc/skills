import path from "path";
import { verbose } from "../utils/logger";
import { directoryExists } from "../utils/fs";
import { SKILLS_MATRIX_PATH, SKILLS_DIR_PATH, PROJECT_ROOT } from "../consts";
import { resolveSource, isLocalSource, type ResolvedConfig } from "./config";
import { fetchFromSource } from "./source-fetcher";
import {
  loadSkillsMatrix,
  extractAllSkills,
  mergeMatrixWithSkills,
} from "./matrix-loader";
import {
  discoverLocalSkills,
  type LocalSkillDiscoveryResult,
} from "./local-skill-loader";
import type {
  MergedSkillsMatrix,
  ResolvedSkill,
  CategoryDefinition,
} from "../types-matrix";

/**
 * Options for loading from a source
 */
export interface SourceLoadOptions {
  /** Source URL override (from --source flag) */
  sourceFlag?: string;
  /** Project directory (for config resolution) */
  projectDir?: string;
  /** Force refresh from remote */
  forceRefresh?: boolean;
}

/**
 * Result of loading skills matrix from a source
 */
export interface SourceLoadResult {
  /** The merged skills matrix */
  matrix: MergedSkillsMatrix;
  /** The resolved source configuration */
  sourceConfig: ResolvedConfig;
  /** Path to the fetched source (local or cached) */
  sourcePath: string;
  /** Whether this is a local or remote source */
  isLocal: boolean;
}

/**
 * Load skills matrix from a source (local or remote)
 *
 * This is the main entry point for loading skills that supports:
 * - Local development (reading from PROJECT_ROOT)
 * - Remote sources (fetching via giget)
 * - Configuration precedence (flag > env > project > global > default)
 */
export async function loadSkillsMatrixFromSource(
  options: SourceLoadOptions = {},
): Promise<SourceLoadResult> {
  const { sourceFlag, projectDir, forceRefresh = false } = options;

  // Resolve which source to use
  const sourceConfig = await resolveSource(sourceFlag, projectDir);
  const { source } = sourceConfig;

  verbose(`Loading skills from source: ${source}`);

  // Check if this is local development mode
  // Local mode: source points to this repo or a local path
  const isLocal = isLocalSource(source) || (await isDevMode(source));

  let result: SourceLoadResult;
  if (isLocal) {
    result = await loadFromLocal(source, sourceConfig);
  } else {
    result = await loadFromRemote(source, sourceConfig, forceRefresh);
  }

  // Discover and merge local skills from project's .claude/skills/
  const resolvedProjectDir = projectDir || process.cwd();
  const localSkillsResult = await discoverLocalSkills(resolvedProjectDir);

  if (localSkillsResult && localSkillsResult.skills.length > 0) {
    verbose(
      `Found ${localSkillsResult.skills.length} local skill(s) in ${localSkillsResult.localSkillsPath}`,
    );
    result.matrix = mergeLocalSkillsIntoMatrix(
      result.matrix,
      localSkillsResult,
    );
  }

  return result;
}

/**
 * Check if we're in development mode (running from within the skills repository itself).
 * This allows local development to use the local skills directory instead of fetching
 * from the remote default source.
 *
 * Dev mode is detected when:
 * 1. The source contains "claude-collective/skills" (the default source)
 * 2. A local src/skills/ directory exists in PROJECT_ROOT
 */
async function isDevMode(source: string): Promise<boolean> {
  // If source is the default and we're running from within the project
  // that contains src/skills/, we're in dev mode
  if (!source.includes("claude-collective/skills")) {
    return false;
  }
  return hasLocalSkills();
}

/**
 * Check if local skills directory exists (indicates dev mode)
 */
async function hasLocalSkills(): Promise<boolean> {
  const localSkillsPath = path.join(PROJECT_ROOT, SKILLS_DIR_PATH);
  return directoryExists(localSkillsPath);
}

/**
 * Load from a local source (development mode or local path)
 */
async function loadFromLocal(
  source: string,
  sourceConfig: ResolvedConfig,
): Promise<SourceLoadResult> {
  // Determine the root path
  let rootPath: string;

  if (isLocalSource(source)) {
    // Explicit local path
    rootPath = path.isAbsolute(source)
      ? source
      : path.resolve(process.cwd(), source);
  } else {
    // Dev mode - use PROJECT_ROOT
    rootPath = PROJECT_ROOT;
  }

  verbose(`Loading from local path: ${rootPath}`);

  // Load matrix and skills
  const matrixPath = path.join(rootPath, SKILLS_MATRIX_PATH);
  const skillsDir = path.join(rootPath, SKILLS_DIR_PATH);

  const matrix = await loadSkillsMatrix(matrixPath);
  const skills = await extractAllSkills(skillsDir);
  const mergedMatrix = await mergeMatrixWithSkills(matrix, skills);

  return {
    matrix: mergedMatrix,
    sourceConfig,
    sourcePath: rootPath,
    isLocal: true,
  };
}

/**
 * Load from a remote source (via giget)
 */
async function loadFromRemote(
  source: string,
  sourceConfig: ResolvedConfig,
  forceRefresh: boolean,
): Promise<SourceLoadResult> {
  verbose(`Fetching from remote source: ${source}`);

  // Fetch the entire source repository
  const fetchResult = await fetchFromSource(source, { forceRefresh });

  verbose(`Fetched to: ${fetchResult.path}`);

  // Load matrix and skills from fetched content
  const matrixPath = path.join(fetchResult.path, SKILLS_MATRIX_PATH);
  const skillsDir = path.join(fetchResult.path, SKILLS_DIR_PATH);

  const matrix = await loadSkillsMatrix(matrixPath);
  const skills = await extractAllSkills(skillsDir);
  const mergedMatrix = await mergeMatrixWithSkills(matrix, skills);

  return {
    matrix: mergedMatrix,
    sourceConfig,
    sourcePath: fetchResult.path,
    isLocal: false,
  };
}

/**
 * Local category definitions for project-local skills
 * Two-level structure required by wizard: top-level -> subcategory -> skills
 */
const LOCAL_CATEGORY_TOP: CategoryDefinition = {
  id: "local",
  name: "Local Skills",
  description: "Project-specific skills from .claude/skills/",
  exclusive: false,
  required: false,
  order: 0, // Display first in category list
};

const LOCAL_CATEGORY_CUSTOM: CategoryDefinition = {
  id: "local/custom",
  name: "Custom",
  description: "Your project-specific skills",
  exclusive: false,
  required: false,
  order: 0,
  parent: "local", // Links to top-level category
};

/**
 * Merge local skills from project's .claude/skills/ into the skills matrix
 *
 * Local skills:
 * - Are added to a dedicated "local" category
 * - Have `local: true` and `localPath` set for special handling
 * - Have no conflict checking (can combine with any marketplace skill)
 * - Use ID format: "skill-name (@local)"
 */
function mergeLocalSkillsIntoMatrix(
  matrix: MergedSkillsMatrix,
  localResult: LocalSkillDiscoveryResult,
): MergedSkillsMatrix {
  // Add both category levels if they don't exist
  // Top-level: "local" (shows in category selection)
  // Subcategory: "local/custom" (holds the skills)
  if (!matrix.categories["local"]) {
    matrix.categories["local"] = LOCAL_CATEGORY_TOP;
  }
  if (!matrix.categories["local/custom"]) {
    matrix.categories["local/custom"] = LOCAL_CATEGORY_CUSTOM;
  }

  // Convert each local skill metadata to ResolvedSkill and add to matrix
  for (const metadata of localResult.skills) {
    const resolvedSkill: ResolvedSkill = {
      // Identity
      id: metadata.id,
      alias: undefined, // Local skills don't have aliases
      name: metadata.name,
      description: metadata.description,
      usageGuidance: metadata.usageGuidance,

      // Categorization - use subcategory so wizard works correctly
      category: "local/custom",
      categoryExclusive: false, // Multiple local skills can be selected
      tags: metadata.tags ?? [],

      // Authorship
      author: "@local",

      // Relationships - empty for local skills (no conflict checking)
      conflictsWith: [],
      recommends: [],
      recommendedBy: [],
      requires: [],
      requiredBy: [],
      alternatives: [],
      discourages: [],

      // Setup relationships
      requiresSetup: [],
      providesSetupFor: [],

      // Location - use the local path
      path: metadata.path,

      // Local skill markers
      local: true,
      localPath: metadata.localPath,
    };

    matrix.skills[metadata.id] = resolvedSkill;
    verbose(`Added local skill: ${metadata.id}`);
  }

  return matrix;
}
