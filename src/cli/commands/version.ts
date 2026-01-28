import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE } from "../consts";
import { readFile, writeFile, fileExists } from "../utils/fs";
import { EXIT_CODES } from "../lib/exit-codes";
import type { PluginManifest } from "../../types";

/**
 * Valid version bump actions
 */
type VersionAction = "patch" | "minor" | "major" | "set";

/**
 * Semver version parts
 */
interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Default version for new plugins
 */
const DEFAULT_VERSION = "1.0.0";

/**
 * Semver validation regex
 */
const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Parse a semver string into parts
 */
function parseSemver(version: string): SemverParts | null {
  const match = version.match(SEMVER_REGEX);
  if (!match) {
    return null;
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Convert semver parts to string
 */
function formatSemver(parts: SemverParts): string {
  return `${parts.major}.${parts.minor}.${parts.patch}`;
}

/**
 * Increment a version by the specified action
 */
function incrementVersion(
  version: string,
  action: "patch" | "minor" | "major",
): string {
  const parts = parseSemver(version);
  if (!parts) {
    // If invalid version, start from 1.0.0
    return DEFAULT_VERSION;
  }

  switch (action) {
    case "major":
      return formatSemver({ major: parts.major + 1, minor: 0, patch: 0 });
    case "minor":
      return formatSemver({
        major: parts.major,
        minor: parts.minor + 1,
        patch: 0,
      });
    case "patch":
      return formatSemver({
        major: parts.major,
        minor: parts.minor,
        patch: parts.patch + 1,
      });
  }
}

/**
 * Search upward for a plugin.json file starting from the given directory
 */
async function findPluginManifest(startDir: string): Promise<string | null> {
  let currentDir = startDir;
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const manifestPath = path.join(
      currentDir,
      PLUGIN_MANIFEST_DIR,
      PLUGIN_MANIFEST_FILE,
    );
    if (await fileExists(manifestPath)) {
      return manifestPath;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Read plugin manifest from file
 */
async function readPluginManifest(
  manifestPath: string,
): Promise<PluginManifest> {
  const content = await readFile(manifestPath);
  return JSON.parse(content) as PluginManifest;
}

/**
 * Write plugin manifest to file
 */
async function writePluginManifestFile(
  manifestPath: string,
  manifest: PluginManifest,
): Promise<void> {
  const content = JSON.stringify(manifest, null, 2);
  await writeFile(manifestPath, content);
}

export const versionCommand = new Command("version")
  .description("Manage plugin version")
  .argument("<action>", 'Version action: "patch", "minor", "major", or "set"')
  .argument("[version]", 'Version to set (only for "set" action)')
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (action: string, version?: string) => {
    // Validate action
    const validActions: VersionAction[] = ["patch", "minor", "major", "set"];
    if (!validActions.includes(action as VersionAction)) {
      p.log.error(
        `Invalid action: "${action}". Must be one of: ${validActions.join(", ")}`,
      );
      process.exit(EXIT_CODES.INVALID_ARGS);
    }

    const versionAction = action as VersionAction;

    // Validate version argument for "set" action
    if (versionAction === "set") {
      if (!version) {
        p.log.error('Version argument required for "set" action');
        p.log.info("Usage: cc version set <version>");
        process.exit(EXIT_CODES.INVALID_ARGS);
      }

      if (!parseSemver(version)) {
        p.log.error(
          `Invalid version format: "${version}". Must be semantic version (e.g., 1.0.0)`,
        );
        process.exit(EXIT_CODES.INVALID_ARGS);
      }
    }

    // Find plugin manifest
    const manifestPath = await findPluginManifest(process.cwd());
    if (!manifestPath) {
      p.log.error("No plugin.json found in current directory or parents");
      p.log.info(
        `Expected location: ${PLUGIN_MANIFEST_DIR}/${PLUGIN_MANIFEST_FILE}`,
      );
      process.exit(EXIT_CODES.ERROR);
    }

    // Read manifest
    let manifest: PluginManifest;
    try {
      manifest = await readPluginManifest(manifestPath);
    } catch (error) {
      p.log.error(`Failed to read plugin manifest: ${error}`);
      process.exit(EXIT_CODES.ERROR);
    }

    const oldVersion = manifest.version || DEFAULT_VERSION;

    // Calculate new version
    let newVersion: string;
    if (versionAction === "set") {
      newVersion = version!;
    } else {
      newVersion = incrementVersion(oldVersion, versionAction);
    }

    // Update manifest
    manifest.version = newVersion;

    // Write manifest
    try {
      await writePluginManifestFile(manifestPath, manifest);
    } catch (error) {
      p.log.error(`Failed to write plugin manifest: ${error}`);
      process.exit(EXIT_CODES.ERROR);
    }

    // Output result
    const pluginName = manifest.name || "unknown";
    console.log(
      `${pc.cyan(pluginName)}: ${pc.dim(oldVersion)} ${pc.yellow("->")} ${pc.green(newVersion)}`,
    );
  });
