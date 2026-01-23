import path from "path";
import { ensureDir, writeFile } from "../utils/fs";
import type { PluginManifest, PluginAuthor } from "../../types";

/**
 * Default version for new plugins
 */
const DEFAULT_VERSION = "1.0.0";

/**
 * Default license for new plugins
 */
const DEFAULT_LICENSE = "MIT";

/**
 * Plugin directory name within output
 */
const PLUGIN_DIR_NAME = ".claude-plugin";

/**
 * Plugin manifest file name
 */
const PLUGIN_MANIFEST_FILE = "plugin.json";

/**
 * Prefix for skill plugins
 */
const SKILL_PLUGIN_PREFIX = "skill-";

/**
 * Options for generating a skill plugin manifest
 */
export interface SkillPluginOptions {
  /** Skill name (kebab-case, e.g., "react") */
  skillName: string;
  /** Skill description */
  description?: string;
  /** Author name */
  author?: string;
  /** Author email */
  authorEmail?: string;
  /** Plugin version (defaults to 1.0.0) */
  version?: string;
  /** Keywords for discoverability */
  keywords?: string[];
}

/**
 * Options for generating a stack plugin manifest
 */
export interface StackPluginOptions {
  /** Stack name (kebab-case, e.g., "modern-react") */
  stackName: string;
  /** Stack description */
  description?: string;
  /** Author name */
  author?: string;
  /** Author email */
  authorEmail?: string;
  /** Plugin version (defaults to 1.0.0) */
  version?: string;
  /** Keywords for discoverability */
  keywords?: string[];
  /** Whether skills directory should be embedded */
  hasSkills?: boolean;
  /** Whether this stack has compiled agents */
  hasAgents?: boolean;
  /** Whether this stack has hooks configuration */
  hasHooks?: boolean;
}

/**
 * Build author object from name and optional email
 */
function buildAuthor(name?: string, email?: string): PluginAuthor | undefined {
  if (!name) {
    return undefined;
  }
  const author: PluginAuthor = { name };
  if (email) {
    author.email = email;
  }
  return author;
}

/**
 * Generate a plugin manifest for a skill plugin
 * Skill plugins contain a single skill without agents
 */
export function generateSkillPluginManifest(
  options: SkillPluginOptions,
): PluginManifest {
  const manifest: PluginManifest = {
    name: `${SKILL_PLUGIN_PREFIX}${options.skillName}`,
    version: options.version ?? DEFAULT_VERSION,
    license: DEFAULT_LICENSE,
    skills: "./skills/",
  };

  if (options.description) {
    manifest.description = options.description;
  }

  const author = buildAuthor(options.author, options.authorEmail);
  if (author) {
    manifest.author = author;
  }

  if (options.keywords && options.keywords.length > 0) {
    manifest.keywords = options.keywords;
  }

  return manifest;
}

/**
 * Generate a plugin manifest for a stack plugin
 * Stack plugins contain skills and optionally agents
 */
export function generateStackPluginManifest(
  options: StackPluginOptions,
): PluginManifest {
  const manifest: PluginManifest = {
    name: options.stackName,
    version: options.version ?? DEFAULT_VERSION,
    license: DEFAULT_LICENSE,
  };

  // Stack plugins embed skills as a directory
  if (options.hasSkills) {
    manifest.skills = "./skills/";
  }

  if (options.description) {
    manifest.description = options.description;
  }

  const author = buildAuthor(options.author, options.authorEmail);
  if (author) {
    manifest.author = author;
  }

  if (options.keywords && options.keywords.length > 0) {
    manifest.keywords = options.keywords;
  }

  if (options.hasAgents) {
    manifest.agents = "./agents/";
  }

  if (options.hasHooks) {
    manifest.hooks = "./hooks/hooks.json";
  }

  return manifest;
}

/**
 * Write a plugin manifest to the output directory
 * Creates .claude-plugin/plugin.json
 */
export async function writePluginManifest(
  outputDir: string,
  manifest: PluginManifest,
): Promise<string> {
  const pluginDir = path.join(outputDir, PLUGIN_DIR_NAME);
  const manifestPath = path.join(pluginDir, PLUGIN_MANIFEST_FILE);

  await ensureDir(pluginDir);

  const content = JSON.stringify(manifest, null, 2);
  await writeFile(manifestPath, content);

  return manifestPath;
}

/**
 * Get the plugin directory path for an output directory
 */
export function getPluginDir(outputDir: string): string {
  return path.join(outputDir, PLUGIN_DIR_NAME);
}

/**
 * Get the plugin manifest file path for an output directory
 */
export function getPluginManifestPath(outputDir: string): string {
  return path.join(outputDir, PLUGIN_DIR_NAME, PLUGIN_MANIFEST_FILE);
}
