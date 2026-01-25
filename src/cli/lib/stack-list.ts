import path from "path";
import pc from "picocolors";
import { listDirectories, glob } from "../utils/fs";
import { getUserStacksDir } from "../consts";
import { getActiveStack } from "./config";
import { getCollectivePluginDir, readPluginManifest } from "./plugin-finder";

/**
 * Information about a stack
 */
export interface StackInfo {
  name: string;
  skillCount: number;
  isActive: boolean;
  version?: string;
}

/**
 * Get information about all stacks
 */
export async function getStacksInfo(): Promise<StackInfo[]> {
  const stacksDir = getUserStacksDir();
  const stackNames = await listDirectories(stacksDir);
  const activeStack = await getActiveStack();

  // Get version from compiled plugin manifest
  const pluginDir = getCollectivePluginDir();
  const manifest = await readPluginManifest(pluginDir);
  const pluginVersion = manifest?.version;

  const stacks: StackInfo[] = [];

  for (const name of stackNames) {
    const skillsDir = path.join(stacksDir, name, "skills");
    // Count SKILL.md files to get actual skill count (skills are nested in categories)
    const skillFiles = await glob("**/SKILL.md", skillsDir);
    const isActive = name === activeStack;

    stacks.push({
      name,
      skillCount: skillFiles.length,
      isActive,
      // Version comes from the plugin manifest (same for all stacks since there's one plugin)
      version: pluginVersion,
    });
  }

  return stacks;
}

/**
 * Format a stack for display (used in both list and switch)
 */
export function formatStackDisplay(stack: StackInfo): string {
  const marker = stack.isActive ? pc.green("*") : " ";
  const name = stack.isActive ? pc.green(pc.bold(stack.name)) : stack.name;
  const version = stack.version ? pc.cyan(`v${stack.version}`) : "";
  const count = pc.dim(
    `(${stack.skillCount} skill${stack.skillCount === 1 ? "" : "s"})`,
  );

  return `${marker} ${name} ${version ? `${version} ` : ""}${count}`;
}

/**
 * Format a stack for select options (label and hint)
 */
export function formatStackOption(stack: StackInfo): {
  value: string;
  label: string;
  hint?: string;
} {
  const versionStr = stack.version ? `v${stack.version}` : "";
  const label = stack.isActive
    ? `${pc.green("*")} ${pc.green(pc.bold(stack.name))}${versionStr ? ` ${pc.cyan(versionStr)}` : ""}`
    : `  ${stack.name}${versionStr ? ` ${pc.cyan(versionStr)}` : ""}`;

  return {
    value: stack.name,
    label,
    hint: `${stack.skillCount} skill${stack.skillCount === 1 ? "" : "s"}${stack.isActive ? " (active)" : ""}`,
  };
}
