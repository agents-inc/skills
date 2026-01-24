import path from "path";
import os from "os";
import { fileExists, readFile } from "../utils/fs";
import { verbose } from "../utils/logger";
import {
  CLAUDE_DIR,
  PLUGINS_SUBDIR,
  PLUGIN_MANIFEST_DIR,
  PLUGIN_MANIFEST_FILE,
} from "../consts";
import type { PluginManifest } from "../../types";

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
