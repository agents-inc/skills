/**
 * @deprecated This module is deprecated. Use plugin-finder.ts instead.
 * The .claude-collective directory structure has been replaced by ~/.claude/plugins/
 *
 * These functions remain for backward compatibility during migration.
 * TODO: Remove in next major version.
 */

import path from "path";
import {
  readFile,
  writeFile,
  fileExists,
  ensureDir,
  directoryExists,
  listDirectories,
} from "../utils/fs";
import {
  COLLECTIVE_DIR,
  COLLECTIVE_STACKS_SUBDIR,
  ACTIVE_STACK_FILE,
} from "../consts";
import { readStackConfig } from "./stack-config";

/**
 * Read the active stack name from .claude-collective/active-stack
 * Returns null if file doesn't exist or is empty
 * @deprecated Use plugin-finder.ts instead
 */
export async function readActiveStack(
  projectDir: string,
): Promise<string | null> {
  const filePath = path.join(projectDir, COLLECTIVE_DIR, ACTIVE_STACK_FILE);
  if (!(await fileExists(filePath))) return null;
  const content = await readFile(filePath);
  return content.trim() || null;
}

/**
 * Write the active stack name to .claude-collective/active-stack
 * @deprecated Use plugin-finder.ts instead
 */
export async function writeActiveStack(
  projectDir: string,
  stackName: string,
): Promise<void> {
  const collectiveDir = path.join(projectDir, COLLECTIVE_DIR);
  await ensureDir(collectiveDir);
  const filePath = path.join(collectiveDir, ACTIVE_STACK_FILE);
  await writeFile(filePath, stackName.trim());
}

/**
 * Stack list item with metadata
 * @deprecated Use plugin-finder.ts instead
 */
export interface StackListItem {
  name: string;
  isActive: boolean;
  skillCount: number;
}

/**
 * Get the stacks directory path for a project
 * @deprecated Use plugin-finder.ts instead
 */
export function getCollectiveStacksDir(projectDir: string): string {
  return path.join(projectDir, COLLECTIVE_DIR, COLLECTIVE_STACKS_SUBDIR);
}

/**
 * List all stacks in a project with their metadata
 * @deprecated Use plugin-finder.ts instead
 */
export async function listStacks(projectDir: string): Promise<StackListItem[]> {
  const stacksDir = getCollectiveStacksDir(projectDir);

  if (!(await directoryExists(stacksDir))) {
    return [];
  }

  const stackNames = await listDirectories(stacksDir);
  const activeStack = await readActiveStack(projectDir);

  const stacks: StackListItem[] = [];

  for (const name of stackNames) {
    const stackDir = path.join(stacksDir, name);
    const config = await readStackConfig(stackDir);
    const skillCount = config?.skill_ids?.length ?? 0;

    stacks.push({
      name,
      isActive: name === activeStack,
      skillCount,
    });
  }

  return stacks;
}

/**
 * Get list of existing stack names in .claude-collective/stacks/
 * @deprecated Use plugin-finder.ts instead
 */
export async function getExistingStacks(projectDir: string): Promise<string[]> {
  const stacksDir = getCollectiveStacksDir(projectDir);
  return listDirectories(stacksDir);
}
