import path from "path";
import os from "os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { readFile, writeFile, fileExists, ensureDir } from "../utils/fs";
import { verbose } from "../utils/logger";

/**
 * Legacy project config directory (still used for backwards compatibility)
 */
const PROJECT_CONFIG_DIR = ".claude-collective";

/**
 * Default skills source repository
 */
export const DEFAULT_SOURCE = "github:claude-collective/skills";

/**
 * Environment variable for source override
 */
export const SOURCE_ENV_VAR = "CC_SOURCE";

/**
 * Global config directory
 */
export const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".claude-collective");

/**
 * Global config file name
 */
export const GLOBAL_CONFIG_FILE = "config.yaml";

/**
 * Project config file name (inside .claude-collective/)
 */
export const PROJECT_CONFIG_FILE = "config.yaml";

/**
 * Global configuration structure
 */
export interface GlobalConfig {
  /** Default skills source URL (giget format) */
  source?: string;
  /** Default author name for created skills */
  author?: string;
}

/**
 * Project configuration structure
 */
export interface ProjectConfig {
  /** Skills source URL override for this project */
  source?: string;
}

/**
 * Resolved configuration with all values determined
 */
export interface ResolvedConfig {
  /** The resolved source URL */
  source: string;
  /** Where the source was resolved from */
  sourceOrigin: "flag" | "env" | "project" | "global" | "default";
}

/**
 * Validate that an object conforms to GlobalConfig structure
 */
function isValidGlobalConfig(obj: unknown): obj is GlobalConfig {
  if (typeof obj !== "object" || obj === null) return false;
  const config = obj as Record<string, unknown>;
  if (config.source !== undefined && typeof config.source !== "string")
    return false;
  if (config.author !== undefined && typeof config.author !== "string")
    return false;
  return true;
}

/**
 * Validate that an object conforms to ProjectConfig structure
 */
function isValidProjectConfig(obj: unknown): obj is ProjectConfig {
  if (typeof obj !== "object" || obj === null) return false;
  const config = obj as Record<string, unknown>;
  if (config.source !== undefined && typeof config.source !== "string")
    return false;
  return true;
}

/**
 * Get the global config file path
 */
export function getGlobalConfigPath(): string {
  return path.join(GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILE);
}

/**
 * Get the project config file path
 */
export function getProjectConfigPath(projectDir: string): string {
  return path.join(projectDir, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
}

/**
 * Load global configuration from ~/.claude-collective/config.yaml
 * Returns null if file doesn't exist
 */
export async function loadGlobalConfig(): Promise<GlobalConfig | null> {
  const configPath = getGlobalConfigPath();

  if (!(await fileExists(configPath))) {
    verbose(`Global config not found at ${configPath}`);
    return null;
  }

  try {
    const content = await readFile(configPath);
    const parsed = parseYaml(content);
    if (!isValidGlobalConfig(parsed)) {
      verbose(`Invalid global config structure at ${configPath}`);
      return null;
    }
    verbose(`Loaded global config from ${configPath}`);
    return parsed;
  } catch (error) {
    verbose(`Failed to parse global config: ${error}`);
    return null;
  }
}

/**
 * Load project configuration from .claude-collective/config.yaml
 * Returns null if file doesn't exist
 */
export async function loadProjectConfig(
  projectDir: string,
): Promise<ProjectConfig | null> {
  const configPath = getProjectConfigPath(projectDir);

  if (!(await fileExists(configPath))) {
    verbose(`Project config not found at ${configPath}`);
    return null;
  }

  try {
    const content = await readFile(configPath);
    const parsed = parseYaml(content);
    if (!isValidProjectConfig(parsed)) {
      verbose(`Invalid project config structure at ${configPath}`);
      return null;
    }
    verbose(`Loaded project config from ${configPath}`);
    return parsed;
  } catch (error) {
    verbose(`Failed to parse project config: ${error}`);
    return null;
  }
}

/**
 * Save global configuration
 */
export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  const configPath = getGlobalConfigPath();
  await ensureDir(GLOBAL_CONFIG_DIR);
  const content = stringifyYaml(config, { lineWidth: 0 });
  await writeFile(configPath, content);
  verbose(`Saved global config to ${configPath}`);
}

/**
 * Save project configuration
 */
export async function saveProjectConfig(
  projectDir: string,
  config: ProjectConfig,
): Promise<void> {
  const configPath = getProjectConfigPath(projectDir);
  await ensureDir(path.join(projectDir, PROJECT_CONFIG_DIR));
  const content = stringifyYaml(config, { lineWidth: 0 });
  await writeFile(configPath, content);
  verbose(`Saved project config to ${configPath}`);
}

/**
 * Resolve the source URL with precedence:
 * 1. CLI flag (--source)
 * 2. Environment variable (CC_SOURCE)
 * 3. Project config (.claude-collective/config.yaml)
 * 4. Global config (~/.claude-collective/config.yaml)
 * 5. Default (github:claude-collective/skills)
 */
export async function resolveSource(
  flagValue?: string,
  projectDir?: string,
): Promise<ResolvedConfig> {
  // 1. CLI flag takes highest priority
  if (flagValue !== undefined) {
    if (flagValue === "" || flagValue.trim() === "") {
      throw new Error("--source flag cannot be empty");
    }
    verbose(`Source from --source flag: ${flagValue}`);
    return { source: flagValue, sourceOrigin: "flag" };
  }

  // 2. Environment variable
  const envValue = process.env[SOURCE_ENV_VAR];
  if (envValue) {
    verbose(`Source from ${SOURCE_ENV_VAR} env var: ${envValue}`);
    return { source: envValue, sourceOrigin: "env" };
  }

  // 3. Project config
  if (projectDir) {
    const projectConfig = await loadProjectConfig(projectDir);
    if (projectConfig?.source) {
      verbose(`Source from project config: ${projectConfig.source}`);
      return { source: projectConfig.source, sourceOrigin: "project" };
    }
  }

  // 4. Global config
  const globalConfig = await loadGlobalConfig();
  if (globalConfig?.source) {
    verbose(`Source from global config: ${globalConfig.source}`);
    return { source: globalConfig.source, sourceOrigin: "global" };
  }

  // 5. Default
  verbose(`Using default source: ${DEFAULT_SOURCE}`);
  return { source: DEFAULT_SOURCE, sourceOrigin: "default" };
}

/**
 * Format source origin for display
 */
export function formatSourceOrigin(
  origin: ResolvedConfig["sourceOrigin"],
): string {
  switch (origin) {
    case "flag":
      return "--source flag";
    case "env":
      return `${SOURCE_ENV_VAR} environment variable`;
    case "project":
      return "project config (.claude-collective/config.yaml)";
    case "global":
      return "global config (~/.claude-collective/config.yaml)";
    case "default":
      return "default";
  }
}

/**
 * Check if a source is local (file path) or remote (giget URL)
 * Throws an error for potentially dangerous path patterns.
 */
export function isLocalSource(source: string): boolean {
  // Local if it starts with / or .
  if (source.startsWith("/") || source.startsWith(".")) {
    return true;
  }

  // Check for giget protocol prefixes - if it has one, it's remote
  const remoteProtocols = [
    "github:",
    "gh:",
    "gitlab:",
    "bitbucket:",
    "sourcehut:",
    "https://",
    "http://",
  ];

  const hasRemoteProtocol = remoteProtocols.some((prefix) =>
    source.startsWith(prefix),
  );

  // If no remote protocol, treat as local but validate it doesn't contain traversal
  if (!hasRemoteProtocol) {
    // Reject obvious path traversal attempts for "bare" names
    if (source.includes("..") || source.includes("~")) {
      throw new Error(
        `Invalid source path: ${source}. Path traversal patterns are not allowed.`,
      );
    }
  }

  return !hasRemoteProtocol;
}
