import path from "path";
import { readFile, writeFile } from "../utils/fs";
import { PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE } from "../consts";
import type { PluginManifest } from "../../types";

/**
 * Version bump type
 */
export type VersionBumpType = "major" | "minor" | "patch";

/**
 * Default version when none is specified
 */
const DEFAULT_VERSION = "1.0.0";

/**
 * Parse a semantic version string
 */
function parseVersion(version: string): [number, number, number] {
  const parts = version.split(".").map(Number);
  return [parts[0] || 1, parts[1] || 0, parts[2] || 0];
}

/**
 * Bump plugin version in manifest
 *
 * @param pluginDir - Plugin directory path
 * @param type - Version bump type (major, minor, patch)
 * @returns New version string
 */
export async function bumpPluginVersion(
  pluginDir: string,
  type: VersionBumpType,
): Promise<string> {
  const manifestPath = path.join(
    pluginDir,
    PLUGIN_MANIFEST_DIR,
    PLUGIN_MANIFEST_FILE,
  );
  const content = await readFile(manifestPath);
  const manifest = JSON.parse(content) as PluginManifest;

  const [major, minor, patch] = parseVersion(
    manifest.version || DEFAULT_VERSION,
  );

  let newVersion: string;
  switch (type) {
    case "major":
      newVersion = `${major + 1}.0.0`;
      break;
    case "minor":
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case "patch":
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }

  manifest.version = newVersion;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  return newVersion;
}

/**
 * Get current plugin version from manifest
 */
export async function getPluginVersion(pluginDir: string): Promise<string> {
  const manifestPath = path.join(
    pluginDir,
    PLUGIN_MANIFEST_DIR,
    PLUGIN_MANIFEST_FILE,
  );
  const content = await readFile(manifestPath);
  const manifest = JSON.parse(content) as PluginManifest;
  return manifest.version || DEFAULT_VERSION;
}
