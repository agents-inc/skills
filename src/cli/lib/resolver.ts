import path from "path";
import { fileExists } from "../utils/fs";
import { DIRS } from "../consts";
import { loadStack, getDirs, type CompileMode } from "./loader";
import type {
  AgentConfig,
  AgentDefinition,
  CompileAgentConfig,
  CompileConfig,
  Skill,
  SkillAssignment,
  SkillDefinition,
  SkillReference,
  StackConfig,
} from "../types";

/**
 * Resolve agent template: Stack -> Default
 */
export async function resolveTemplate(
  projectRoot: string,
  stackId: string,
  mode: CompileMode = "dev",
): Promise<string> {
  const dirs = getDirs(mode);
  // 1. Stack-specific template
  const stackTemplate = path.join(
    projectRoot,
    dirs.stacks,
    stackId,
    "agent.liquid",
  );
  if (await fileExists(stackTemplate)) return stackTemplate;

  // 2. Default template
  return path.join(projectRoot, dirs.templates, "agent.liquid");
}

/**
 * Resolve CLAUDE.md from stack
 */
export async function resolveClaudeMd(
  projectRoot: string,
  stackId: string,
  mode: CompileMode = "dev",
): Promise<string> {
  const dirs = getDirs(mode);
  const stackClaude = path.join(projectRoot, dirs.stacks, stackId, "CLAUDE.md");
  if (await fileExists(stackClaude)) return stackClaude;

  throw new Error(
    `Stack '${stackId}' is missing required CLAUDE.md file. Expected at: ${stackClaude}`,
  );
}

/**
 * Resolve a single skill reference to a full Skill object
 */
export function resolveSkillReference(
  ref: SkillReference,
  skills: Record<string, SkillDefinition>,
): Skill {
  const definition = skills[ref.id];
  if (!definition) {
    const availableSkills = Object.keys(skills);
    const skillList =
      availableSkills.length > 0
        ? `Available skills: ${availableSkills.slice(0, 5).join(", ")}${availableSkills.length > 5 ? ` (and ${availableSkills.length - 5} more)` : ""}`
        : "No skills found in scanned directories";
    throw new Error(
      `Skill '${ref.id}' not found in scanned skills. ${skillList}`,
    );
  }
  return {
    id: ref.id,
    path: definition.path,
    name: definition.name,
    description: definition.description,
    usage: ref.usage,
    preloaded: ref.preloaded ?? false,
  };
}

/**
 * Resolve multiple skill references
 */
export function resolveSkillReferences(
  skillRefs: SkillReference[],
  skills: Record<string, SkillDefinition>,
): Skill[] {
  return skillRefs.map((ref) => resolveSkillReference(ref, skills));
}

/**
 * Get skill IDs from stack skills array (for validation)
 */
function getStackSkillIds(stackSkills: SkillAssignment[]): string[] {
  return stackSkills.map((s) => s.id);
}

/**
 * Flatten hierarchical agent skills (categorized format) to flat array
 * Format: { framework: [...], styling: [...] } -> [...]
 */
function flattenAgentSkills(
  categorizedSkills: Record<string, SkillAssignment[]>,
): SkillAssignment[] {
  const assignments: SkillAssignment[] = [];
  for (const category of Object.keys(categorizedSkills)) {
    assignments.push(...categorizedSkills[category]);
  }
  return assignments;
}

/**
 * Expand directory references to individual skill IDs
 * If skillId is a directory prefix (like "methodology/universal"), find all skills under it
 * If skillId is a specific skill, return it unchanged
 */
function expandSkillIdIfDirectory(
  skillId: string,
  skills: Record<string, SkillDefinition>,
): string[] {
  // If exact match exists, use it
  if (skills[skillId]) {
    return [skillId];
  }

  // Try as directory prefix - find all skills whose paths start with this prefix
  // Use path as unique key to deduplicate (both frontmatter name and directory path map to same skill)
  const allSkillIds = Object.keys(skills);
  const seenPaths = new Set<string>();
  const matchingSkills: string[] = [];

  for (const id of allSkillIds) {
    const skillDef = skills[id];
    // Check if the skill's path starts with the directory prefix
    if (skillDef.path.startsWith(`src/skills/${skillId}/`)) {
      // Only add if we haven't seen this path before (deduplication)
      if (!seenPaths.has(skillDef.path)) {
        seenPaths.add(skillDef.path);
        matchingSkills.push(id);
      }
    }
  }

  if (matchingSkills.length > 0) {
    return matchingSkills;
  }

  // Return original skillId if no expansion found (will error later)
  return [skillId];
}

/**
 * Resolve a stack's skills to skill references for a specific agent
 * Handles hierarchical SkillAssignment objects with preloaded flag
 * Supports directory references (e.g., "methodology/universal") that expand to all skills under that directory
 */
export function resolveStackSkills(
  stack: StackConfig,
  agentName: string,
  skills: Record<string, SkillDefinition>,
): SkillReference[] {
  const skillRefs: SkillReference[] = [];

  // Use per-agent skills if defined (hierarchical format), otherwise fall back to all stack skills
  const agentSkillCategories = stack.agent_skills?.[agentName];
  const assignments: SkillAssignment[] = agentSkillCategories
    ? flattenAgentSkills(agentSkillCategories)
    : stack.skills;

  // Get list of all valid skill IDs in this stack (expanded to include directory contents)
  const validSkillIds = new Set<string>();
  for (const s of stack.skills) {
    const expandedIds = expandSkillIdIfDirectory(s.id, skills);
    for (const id of expandedIds) {
      validSkillIds.add(id);
    }
  }

  // Track already added skills to deduplicate
  const addedSkills = new Set<string>();

  for (const assignment of assignments) {
    const skillId = assignment.id;

    // Expand directory references to individual skills
    const expandedSkillIds = expandSkillIdIfDirectory(skillId, skills);

    for (const expandedId of expandedSkillIds) {
      // Skip duplicates
      if (addedSkills.has(expandedId)) {
        continue;
      }

      // Validate skill exists in scanned skills
      if (!skills[expandedId]) {
        throw new Error(
          `Stack "${stack.name}" references skill "${expandedId}" for agent "${agentName}" not found in scanned skills`,
        );
      }

      // Validate skill is in stack's skill list (if using per-agent skills)
      if (agentSkillCategories && !validSkillIds.has(expandedId)) {
        throw new Error(
          `Stack "${stack.name}" agent_skills for "${agentName}" includes skill "${expandedId}" not in stack's skills array`,
        );
      }

      const skillDef = skills[expandedId];
      skillRefs.push({
        id: expandedId,
        usage: `when working with ${skillDef.name.toLowerCase()}`,
        preloaded: assignment.preloaded ?? false,
      });

      addedSkills.add(expandedId);
    }
  }

  return skillRefs;
}

/**
 * Get skills for an agent, preferring explicit skills over stack skills
 */
export async function getAgentSkills(
  agentName: string,
  agentConfig: CompileAgentConfig,
  compileConfig: CompileConfig,
  skills: Record<string, SkillDefinition>,
  projectRoot: string,
): Promise<SkillReference[]> {
  // If agent has explicit skills defined, use those
  if (agentConfig.skills && agentConfig.skills.length > 0) {
    return agentConfig.skills;
  }

  // Resolve from stack
  if (compileConfig.stack) {
    console.log(
      `  Resolving skills from stack "${compileConfig.stack}" for ${agentName}`,
    );
    const stack = await loadStack(compileConfig.stack, projectRoot);
    return resolveStackSkills(stack, agentName, skills);
  }

  // No skills defined
  return [];
}

/**
 * Resolve agents by merging definitions with compile config
 */
export async function resolveAgents(
  agents: Record<string, AgentDefinition>,
  skills: Record<string, SkillDefinition>,
  compileConfig: CompileConfig,
  projectRoot: string,
): Promise<Record<string, AgentConfig>> {
  const resolved: Record<string, AgentConfig> = {};
  const agentNames = Object.keys(compileConfig.agents);

  for (const agentName of agentNames) {
    const definition = agents[agentName];
    if (!definition) {
      const availableAgents = Object.keys(agents);
      const agentList =
        availableAgents.length > 0
          ? `Available agents: ${availableAgents.slice(0, 5).join(", ")}${availableAgents.length > 5 ? ` (and ${availableAgents.length - 5} more)` : ""}`
          : "No agents found in scanned directories";
      throw new Error(
        `Agent '${agentName}' referenced in compile config but not found in scanned agents. ${agentList}. Check that src/agents/${agentName}/agent.yaml exists.`,
      );
    }

    const agentConfig = compileConfig.agents[agentName];

    // Get skills (from explicit config or stack)
    const skillRefs = await getAgentSkills(
      agentName,
      agentConfig,
      compileConfig,
      skills,
      projectRoot,
    );

    // Resolve skill references to full skill objects
    const resolvedSkills = resolveSkillReferences(skillRefs, skills);

    resolved[agentName] = {
      name: agentName,
      title: definition.title,
      description: definition.description,
      model: definition.model,
      tools: definition.tools,
      skills: resolvedSkills,
      path: definition.path,
    };
  }

  return resolved;
}

/**
 * Convert a stack config to a compile config
 */
export function stackToCompileConfig(
  stackId: string,
  stack: StackConfig,
): CompileConfig {
  const agents: Record<string, CompileAgentConfig> = {};

  for (const agentId of stack.agents) {
    agents[agentId] = {};
  }

  return {
    name: stack.name,
    description: stack.description || "",
    claude_md: "",
    stack: stackId,
    agents,
  };
}
