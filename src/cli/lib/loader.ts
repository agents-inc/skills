import { parse as parseYaml } from "yaml";
import path from "path";
import { glob, readFile, directoryExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { DIRS, COLLECTIVE_DIR, COLLECTIVE_STACKS_SUBDIR } from "../consts";
import type {
  AgentDefinition,
  AgentYamlConfig,
  SkillDefinition,
  SkillFrontmatter,
  StackConfig,
} from "../types";

/**
 * Compile mode: 'dev' for this repo (src/stacks), 'user' for user projects (.claude-collective/stacks)
 */
export type CompileMode = "dev" | "user";

/**
 * Detect compile mode based on whether .claude-collective/stacks exists
 */
export async function detectCompileMode(
  projectRoot: string,
): Promise<CompileMode> {
  const collectiveStacksDir = path.join(
    projectRoot,
    COLLECTIVE_DIR,
    COLLECTIVE_STACKS_SUBDIR,
  );
  if (await directoryExists(collectiveStacksDir)) {
    return "user";
  }
  return "dev";
}

/**
 * Get directories based on compile mode
 */
export function getDirs(mode: CompileMode) {
  if (mode === "user") {
    return {
      agents: "src/agents", // Always from CLI repo for now
      skills: `${COLLECTIVE_DIR}/skills`, // Future: user-defined skills
      stacks: `${COLLECTIVE_DIR}/${COLLECTIVE_STACKS_SUBDIR}`,
      principles: "src/agents/_principles",
      templates: "src/agents/_templates",
      commands: "src/commands",
    } as const;
  }

  // Dev mode (current behavior)
  return DIRS;
}

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

/**
 * Parse YAML frontmatter from a markdown file
 */
export function parseFrontmatter(content: string): SkillFrontmatter | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return null;

  const yamlContent = match[1];
  const frontmatter = parseYaml(yamlContent) as SkillFrontmatter;

  if (!frontmatter.name || !frontmatter.description) return null;
  return frontmatter;
}

/**
 * Extract display name from skill ID
 * e.g., "frontend/react (@vince)" -> "React"
 */
function extractDisplayName(skillId: string): string {
  const withoutCategory = skillId.split("/").pop() || skillId;
  const withoutAuthor = withoutCategory.replace(/\s*\(@\w+\)$/, "").trim();
  return withoutAuthor
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Load all agents by scanning agents/{category}/{agentId}/agent.yaml
 */
export async function loadAllAgents(
  projectRoot: string,
): Promise<Record<string, AgentDefinition>> {
  const agents: Record<string, AgentDefinition> = {};
  const agentSourcesDir = path.join(projectRoot, DIRS.agents);

  const files = await glob("**/agent.yaml", agentSourcesDir);

  for (const file of files) {
    const fullPath = path.join(agentSourcesDir, file);
    const content = await readFile(fullPath);
    const config = parseYaml(content) as AgentYamlConfig;

    // Extract relative directory path (e.g., "backend-developer" or "developer/backend-developer")
    const agentPath = path.dirname(file);

    agents[config.id] = {
      title: config.title,
      description: config.description,
      model: config.model,
      tools: config.tools,
      path: agentPath,
    };

    verbose(`Loaded agent: ${config.id} from ${file}`);
  }

  return agents;
}

/**
 * Load skills from a stack's embedded skills directory
 * Scans stacks/{stackId}/skills/**\/SKILL.md for Phase 1 architecture
 * @deprecated Use loadSkillsByIds instead - stacks no longer embed skills
 */
export async function loadStackSkills(
  stackId: string,
  projectRoot: string,
  mode: CompileMode = "dev",
): Promise<Record<string, SkillDefinition>> {
  const skills: Record<string, SkillDefinition> = {};
  const dirs = getDirs(mode);
  const stackSkillsDir = path.join(projectRoot, dirs.stacks, stackId, "skills");

  // Check if skills directory exists (backward compatibility)
  if (!(await directoryExists(stackSkillsDir))) {
    verbose(`No embedded skills directory for stack ${stackId}`);
    return skills;
  }

  const files = await glob("**/SKILL.md", stackSkillsDir);

  for (const file of files) {
    const fullPath = path.join(stackSkillsDir, file);
    const content = await readFile(fullPath);

    const frontmatter = parseFrontmatter(content);
    if (!frontmatter) {
      console.warn(
        `  Warning: Skipping ${file}: Missing or invalid frontmatter`,
      );
      continue;
    }

    const folderPath = file.replace("/SKILL.md", "");
    // Path points to stack's embedded skill location (full relative path from project root)
    // For dev mode: src/stacks/{stackId}/skills/{folderPath}/
    // For user mode: .claude-collective/stacks/{stackId}/skills/{folderPath}/
    const skillPath =
      mode === "dev"
        ? `src/stacks/${stackId}/skills/${folderPath}/`
        : `${dirs.stacks}/${stackId}/skills/${folderPath}/`;
    // Use frontmatter name as canonical skill ID
    const skillId = frontmatter.name;

    skills[skillId] = {
      path: skillPath,
      name: extractDisplayName(frontmatter.name),
      description: frontmatter.description,
    };

    verbose(`Loaded stack skill: ${skillId} from ${file}`);
  }

  return skills;
}

/**
 * Build a mapping from frontmatter names (canonical IDs) to directory paths
 * Scans all SKILL.md files and extracts their frontmatter name
 */
async function buildIdToDirectoryPathMap(
  skillsDir: string,
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const files = await glob("**/SKILL.md", skillsDir);

  for (const file of files) {
    const fullPath = path.join(skillsDir, file);
    const content = await readFile(fullPath);
    const frontmatter = parseFrontmatter(content);

    if (frontmatter?.name) {
      const directoryPath = file.replace("/SKILL.md", "");
      // Map frontmatter name (canonical ID) to directory path
      map[frontmatter.name] = directoryPath;
      // Also map directory path to itself for backward compatibility
      map[directoryPath] = directoryPath;
    }
  }

  return map;
}

/**
 * Load skills from src/skills/ based on skill IDs from stack config
 * Skill IDs can be either:
 * - Canonical IDs (frontmatter names like "frontend/react (@vince)")
 * - Directory paths (like "frontend/framework/react (@vince)") - for backward compatibility
 */
export async function loadSkillsByIds(
  skillIds: Array<{ id: string }>,
  projectRoot: string,
): Promise<Record<string, SkillDefinition>> {
  const skills: Record<string, SkillDefinition> = {};
  const skillsDir = path.join(projectRoot, DIRS.skills);

  // Build mapping from skill IDs (including frontmatter names) to directory paths
  const idToDirectoryPath = await buildIdToDirectoryPathMap(skillsDir);

  for (const { id: skillId } of skillIds) {
    // Resolve the skill ID to a directory path
    const directoryPath = idToDirectoryPath[skillId];
    if (!directoryPath) {
      console.warn(
        `  Warning: Could not find skill ${skillId}: No matching skill found`,
      );
      continue;
    }

    const skillPath = path.join(skillsDir, directoryPath);
    const skillMdPath = path.join(skillPath, "SKILL.md");

    try {
      const content = await readFile(skillMdPath);
      const frontmatter = parseFrontmatter(content);

      if (!frontmatter) {
        console.warn(
          `  Warning: Skipping ${skillId}: Missing or invalid frontmatter`,
        );
        continue;
      }

      // Use the canonical ID (frontmatter name) as the primary key
      const canonicalId = frontmatter.name;
      const skillDef: SkillDefinition = {
        path: `${DIRS.skills}/${directoryPath}/`,
        name: extractDisplayName(frontmatter.name),
        description: frontmatter.description,
      };

      // Add under canonical ID (frontmatter name)
      skills[canonicalId] = skillDef;

      // Also add under directory path for backward compatibility
      // This allows stack configs using either format to work
      if (directoryPath !== canonicalId) {
        skills[directoryPath] = skillDef;
      }

      verbose(`Loaded skill: ${canonicalId} (from ${directoryPath})`);
    } catch (error) {
      console.warn(`  Warning: Could not load skill ${skillId}: ${error}`);
    }
  }

  return skills;
}

/**
 * Load skills from a plugin's skills directory
 * Scans pluginDir/skills/**\/SKILL.md for compiled plugin output
 */
export async function loadPluginSkills(
  pluginDir: string,
): Promise<Record<string, SkillDefinition>> {
  const skills: Record<string, SkillDefinition> = {};
  const pluginSkillsDir = path.join(pluginDir, "skills");

  // Check if skills directory exists
  if (!(await directoryExists(pluginSkillsDir))) {
    return skills;
  }

  const files = await glob("**/SKILL.md", pluginSkillsDir);

  for (const file of files) {
    const fullPath = path.join(pluginSkillsDir, file);
    const content = await readFile(fullPath);

    const frontmatter = parseFrontmatter(content);
    if (!frontmatter) {
      console.warn(
        `  Warning: Skipping ${file}: Missing or invalid frontmatter`,
      );
      continue;
    }

    const folderPath = file.replace("/SKILL.md", "");
    // Path is relative to the plugin directory
    const skillPath = `skills/${folderPath}/`;
    // Use frontmatter name as canonical skill ID
    const skillId = frontmatter.name;

    skills[skillId] = {
      path: skillPath,
      name: extractDisplayName(frontmatter.name),
      description: frontmatter.description,
    };

    verbose(`Loaded plugin skill: ${skillId} from ${file}`);
  }

  return skills;
}

// Cache for loaded stacks (keyed by mode:stackId)
const stackCache = new Map<string, StackConfig>();

/**
 * Load a stack configuration from stacks/{stackId}/config.yaml
 */
export async function loadStack(
  stackId: string,
  projectRoot: string,
  mode: CompileMode = "dev",
): Promise<StackConfig> {
  const cacheKey = `${mode}:${stackId}`;
  const cached = stackCache.get(cacheKey);
  if (cached) return cached;

  const dirs = getDirs(mode);
  const stackPath = path.join(projectRoot, dirs.stacks, stackId, "config.yaml");

  try {
    const content = await readFile(stackPath);
    const stack = parseYaml(content) as StackConfig;
    stackCache.set(cacheKey, stack);
    verbose(`Loaded stack: ${stack.name} (${stackId})`);
    return stack;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load stack '${stackId}': ${errorMessage}. Expected config at: ${stackPath}`,
    );
  }
}
