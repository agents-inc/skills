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
import type { MergedSkillsMatrix } from "../types-matrix";

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

  if (isLocal) {
    return loadFromLocal(source, sourceConfig);
  }

  return loadFromRemote(source, sourceConfig, forceRefresh);
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
 * Get the skills directory path for a loaded source
 */
export function getSkillsDir(sourceResult: SourceLoadResult): string {
  return path.join(sourceResult.sourcePath, SKILLS_DIR_PATH);
}

/**
 * Resolve a skill path relative to the source
 */
export function resolveSkillPath(
  sourceResult: SourceLoadResult,
  skillRelativePath: string,
): string {
  // skillRelativePath is like "skills/frontend/react (@vince)/"
  // We need to join with src/ because that's where skills live in the source
  return path.join(sourceResult.sourcePath, "src", skillRelativePath);
}
