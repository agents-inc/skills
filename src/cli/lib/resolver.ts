import path from 'path';
import { fileExists } from '../utils/fs';
import { DIRS } from '../consts';
import { loadStack } from './loader';
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
} from '../types';

/**
 * Resolve agent template: Stack -> Default
 */
export async function resolveTemplate(
  projectRoot: string,
  stackId: string
): Promise<string> {
  // 1. Stack-specific template
  const stackTemplate = path.join(projectRoot, DIRS.stacks, stackId, 'agent.liquid');
  if (await fileExists(stackTemplate)) return stackTemplate;

  // 2. Default template
  return path.join(projectRoot, DIRS.templates, 'agent.liquid');
}

/**
 * Resolve CLAUDE.md from stack
 */
export async function resolveClaudeMd(
  projectRoot: string,
  stackId: string
): Promise<string> {
  const stackClaude = path.join(projectRoot, DIRS.stacks, stackId, 'CLAUDE.md');
  if (await fileExists(stackClaude)) return stackClaude;

  throw new Error(`No CLAUDE.md found for stack ${stackId}`);
}

/**
 * Resolve a single skill reference to a full Skill object
 */
export function resolveSkillReference(
  ref: SkillReference,
  skills: Record<string, SkillDefinition>
): Skill {
  const definition = skills[ref.id];
  if (!definition) {
    throw new Error(`Skill "${ref.id}" not found in scanned skills`);
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
  skills: Record<string, SkillDefinition>
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
  categorizedSkills: Record<string, SkillAssignment[]>
): SkillAssignment[] {
  const assignments: SkillAssignment[] = [];
  for (const category of Object.keys(categorizedSkills)) {
    assignments.push(...categorizedSkills[category]);
  }
  return assignments;
}

/**
 * Resolve a stack's skills to skill references for a specific agent
 * Handles hierarchical SkillAssignment objects with preloaded flag
 */
export function resolveStackSkills(
  stack: StackConfig,
  agentName: string,
  skills: Record<string, SkillDefinition>
): SkillReference[] {
  const skillRefs: SkillReference[] = [];

  // Use per-agent skills if defined (hierarchical format), otherwise fall back to all stack skills
  const agentSkillCategories = stack.agent_skills?.[agentName];
  const assignments: SkillAssignment[] = agentSkillCategories
    ? flattenAgentSkills(agentSkillCategories)
    : stack.skills;

  // Get list of all valid skill IDs in this stack
  const validSkillIds = getStackSkillIds(stack.skills);

  for (const assignment of assignments) {
    const skillId = assignment.id;

    // Validate skill exists in scanned skills
    if (!skills[skillId]) {
      throw new Error(
        `Stack "${stack.name}" references skill "${skillId}" for agent "${agentName}" not found in scanned skills`
      );
    }

    // Validate skill is in stack's skill list (if using per-agent skills)
    if (agentSkillCategories && !validSkillIds.includes(skillId)) {
      throw new Error(
        `Stack "${stack.name}" agent_skills for "${agentName}" includes skill "${skillId}" not in stack's skills array`
      );
    }

    const skillDef = skills[skillId];
    skillRefs.push({
      id: skillId,
      usage: `when working with ${skillDef.name.toLowerCase()}`,
      preloaded: assignment.preloaded ?? false,
    });
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
  projectRoot: string
): Promise<SkillReference[]> {
  // If agent has explicit skills defined, use those
  if (agentConfig.skills && agentConfig.skills.length > 0) {
    return agentConfig.skills;
  }

  // Resolve from stack
  if (compileConfig.stack) {
    console.log(`  Resolving skills from stack "${compileConfig.stack}" for ${agentName}`);
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
  projectRoot: string
): Promise<Record<string, AgentConfig>> {
  const resolved: Record<string, AgentConfig> = {};
  const agentNames = Object.keys(compileConfig.agents);

  for (const agentName of agentNames) {
    const definition = agents[agentName];
    if (!definition) {
      throw new Error(
        `Agent "${agentName}" in compile config but not found in scanned agents`
      );
    }

    const agentConfig = compileConfig.agents[agentName];

    // Get skills (from explicit config or stack)
    const skillRefs = await getAgentSkills(
      agentName,
      agentConfig,
      compileConfig,
      skills,
      projectRoot
    );

    // Resolve skill references to full skill objects
    const resolvedSkills = resolveSkillReferences(skillRefs, skills);

    resolved[agentName] = {
      name: agentName,
      title: definition.title,
      description: definition.description,
      model: definition.model,
      tools: definition.tools,
      core_prompts: agentConfig.core_prompts,
      ending_prompts: agentConfig.ending_prompts,
      output_format: definition.output_format,
      skills: resolvedSkills,
    };
  }

  return resolved;
}

/**
 * Convert a stack config to a compile config
 */
export function stackToCompileConfig(
  stackId: string,
  stack: StackConfig
): CompileConfig {
  const agents: Record<string, CompileAgentConfig> = {};

  for (const agentId of stack.agents) {
    agents[agentId] = {
      core_prompts: [
        'core-principles',
        'investigation-requirement',
        'write-verification',
        'anti-over-engineering',
      ],
      ending_prompts: ['context-management', 'improvement-protocol'],
    };
  }

  return {
    name: stack.name,
    description: stack.description || '',
    claude_md: '',
    stack: stackId,
    agents,
  };
}
