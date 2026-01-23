import path from "path";
import os from "os";
import {
  directoryExists,
  fileExists,
  readFile,
  listDirectories,
} from "../utils/fs";
import { verbose } from "../utils/logger";
import {
  CLAUDE_DIR,
  PLUGINS_SUBDIR,
  PLUGIN_MANIFEST_DIR,
  PLUGIN_MANIFEST_FILE,
} from "../consts";
import type { PluginManifest } from "../../types";

/**
 * Plugin location result with metadata
 */
export interface PluginLocation {
  /** Absolute path to the plugin directory */
  path: string;
  /** Scope where plugin was found */
  scope: "user" | "project";
  /** Parsed plugin manifest */
  manifest: PluginManifest;
}

/**
 * Get the user plugins directory path (~/.claude/plugins/)
 */
export function getUserPluginsDir(): string {
  return path.join(os.homedir(), CLAUDE_DIR, PLUGINS_SUBDIR);
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
async function readPluginManifest(
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
 * Find a plugin in a plugins directory by name
 * Returns null if not found
 */
async function findPluginByName(
  pluginsDir: string,
  pluginName: string,
  scope: "user" | "project",
): Promise<PluginLocation | null> {
  const pluginDir = path.join(pluginsDir, pluginName);

  if (!(await directoryExists(pluginDir))) {
    return null;
  }

  const manifest = await readPluginManifest(pluginDir);
  if (!manifest) {
    return null;
  }

  return {
    path: pluginDir,
    scope,
    manifest,
  };
}

/**
 * Find all plugins in a plugins directory
 */
async function findAllPluginsInDir(
  pluginsDir: string,
  scope: "user" | "project",
): Promise<PluginLocation[]> {
  if (!(await directoryExists(pluginsDir))) {
    return [];
  }

  const plugins: PluginLocation[] = [];
  const subdirs = await listDirectories(pluginsDir);

  for (const subdir of subdirs) {
    const pluginDir = path.join(pluginsDir, subdir);
    const manifest = await readPluginManifest(pluginDir);

    if (manifest) {
      plugins.push({
        path: pluginDir,
        scope,
        manifest,
      });
    }
  }

  return plugins;
}

/**
 * Find a plugin directory by name
 *
 * Search order:
 * 1. Project scope (.claude/plugins/<name>/)
 * 2. User scope (~/.claude/plugins/<name>/)
 *
 * @param pluginName - Name of the plugin to find (optional)
 * @param projectDir - Project directory to search in (defaults to cwd)
 * @returns Plugin location or null if not found
 */
export async function findPluginDirectory(
  pluginName?: string,
  projectDir?: string,
): Promise<PluginLocation | null> {
  const projectPluginsDir = getProjectPluginsDir(projectDir);
  const userPluginsDir = getUserPluginsDir();

  if (pluginName) {
    // Search for specific plugin by name
    verbose(`Searching for plugin: ${pluginName}`);

    // Try project scope first
    const projectPlugin = await findPluginByName(
      projectPluginsDir,
      pluginName,
      "project",
    );
    if (projectPlugin) {
      verbose(`  Found in project: ${projectPlugin.path}`);
      return projectPlugin;
    }

    // Try user scope
    const userPlugin = await findPluginByName(
      userPluginsDir,
      pluginName,
      "user",
    );
    if (userPlugin) {
      verbose(`  Found in user: ${userPlugin.path}`);
      return userPlugin;
    }

    verbose(`  Plugin not found: ${pluginName}`);
    return null;
  }

  // No name specified - find first available plugin
  verbose("Searching for any plugin...");

  // Try project scope first
  const projectPlugins = await findAllPluginsInDir(
    projectPluginsDir,
    "project",
  );
  if (projectPlugins.length > 0) {
    verbose(`  Found ${projectPlugins.length} project plugins`);
    return projectPlugins[0];
  }

  // Try user scope
  const userPlugins = await findAllPluginsInDir(userPluginsDir, "user");
  if (userPlugins.length > 0) {
    verbose(`  Found ${userPlugins.length} user plugins`);
    return userPlugins[0];
  }

  verbose("  No plugins found");
  return null;
}

/**
 * Find all plugins in both project and user scopes
 *
 * @param projectDir - Project directory to search in (defaults to cwd)
 * @returns Array of all found plugins
 */
export async function findAllPlugins(
  projectDir?: string,
): Promise<PluginLocation[]> {
  const projectPluginsDir = getProjectPluginsDir(projectDir);
  const userPluginsDir = getUserPluginsDir();

  const projectPlugins = await findAllPluginsInDir(
    projectPluginsDir,
    "project",
  );
  const userPlugins = await findAllPluginsInDir(userPluginsDir, "user");

  return [...projectPlugins, ...userPlugins];
}
