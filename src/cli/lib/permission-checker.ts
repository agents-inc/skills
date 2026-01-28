import path from "path";
import * as p from "@clack/prompts";
import { fileExists, readFile } from "../utils/fs";

interface PermissionConfig {
  allow?: string[];
  deny?: string[];
}

interface SettingsFile {
  permissions?: PermissionConfig;
}

/**
 * Check for Claude permission configuration and warn if missing or restrictive
 *
 * @param projectRoot - Project root directory to check for .claude/settings.json
 */
export async function checkPermissions(projectRoot: string): Promise<void> {
  const settingsPath = path.join(projectRoot, ".claude", "settings.json");
  const localSettingsPath = path.join(
    projectRoot,
    ".claude",
    "settings.local.json",
  );

  let permissions: PermissionConfig | undefined;

  // Check local settings first (higher priority), then project settings
  for (const filePath of [localSettingsPath, settingsPath]) {
    if (await fileExists(filePath)) {
      try {
        const content = await readFile(filePath);
        const parsed = JSON.parse(content) as SettingsFile;
        if (parsed.permissions) {
          permissions = parsed.permissions;
          break;
        }
      } catch {
        // Invalid JSON, continue
      }
    }
  }

  // Analyze and warn
  if (!permissions) {
    p.note(
      `No permissions configured in .claude/settings.json
Agents will prompt for approval on each tool use.

For autonomous operation, add to .claude/settings.json:

{
  "permissions": {
    "allow": [
      "Read(*)",
      "Bash(git *)",
      "Bash(bun *)"
    ]
  }
}`,
      "Permission Notice",
    );
    return;
  }

  // Check if overly restrictive
  const hasRestrictiveBash = permissions.deny?.some(
    (rule) => rule === "Bash(*)" || rule === "Bash",
  );
  const hasNoAllows = !permissions.allow || permissions.allow.length === 0;

  if (hasRestrictiveBash) {
    p.log.warn(
      `Bash is denied in permissions. Some agents require Bash for git, testing, and build commands.`,
    );
  }

  if (hasNoAllows) {
    p.log.warn(
      `No allow rules configured. Agents will prompt for each tool use.`,
    );
  }
}
