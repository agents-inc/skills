import path from 'path';
import { fileExists } from '../utils/fs';
import { verbose } from '../utils/logger';
import { DIRS } from '../consts';
import { loadStack } from './loader';
import type {
  AgentConfig,
  AgentDefinition,
  ProfileAgentConfig,
  ProfileConfig,
  Skill,
  SkillAssignment,
  SkillDefinition,
  SkillReference,
  StackConfig,
} from '../types';

/**
 * Resolve agent template with cascade: Profile -> Stack -> Default
 */
export async function resolveTemplate(
  projectRoot: string,
  profile: string,
  stack: string | undefined
): Promise<string> {
  // 1. Profile-specific template
  const profileTemplate = path.join(projectRoot, DIRS.profiles, profile, 'agent.liquid');
  if (await fileExists(profileTemplate)) return profileTemplate;

  // 2. Stack-specific template
  if (stack) {
    const stackTemplate = path.join(projectRoot, DIRS.stacks, stack, 'agent.liquid');
    if (await fileExists(stackTemplate)) return stackTemplate;
  }

  // 3. Default template
  return path.join(projectRoot, DIRS.templates, 'agent.liquid');
}

/**
 * Resolve CLAUDE.md with cascade: Profile -> Stack
 */
export async function resolveClaudeMd(
  projectRoot: string,
  profile: string,
  stack: string | undefined
): Promise<string> {
  // 1. Profile-specific CLAUDE.md
  const profileClaude = path.join(projectRoot, DIRS.profiles, profile, 'CLAUDE.md');
  if (await fileExists(profileClaude)) return profileClaude;

  // 2. Stack-specific CLAUDE.md
  if (stack) {
    const stackClaude = path.join(projectRoot, DIRS.stacks, stack, 'CLAUDE.md');
    if (await fileExists(stackClaude)) return stackClaude;
  }

  throw new Error(
    `No CLAUDE.md found for profile ${profile}${stack ? ` or stack ${stack}` : ''}`
  );
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
 * Resolve a stack's skills to skill references for a specific agent
 * Handles SkillAssignment objects with preloaded flag
 */
export function resolveStackSkills(
  stack: StackConfig,
  agentName: string,
  skills: Record<string, SkillDefinition>
): SkillReference[] {
  const skillRefs: SkillReference[] = [];

  // Use per-agent skills if defined, otherwise fall back to all stack skills
  const assignments: SkillAssignment[] =
    stack.agent_skills?.[agentName] ?? stack.skills;

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
    if (stack.agent_skills?.[agentName] && !validSkillIds.includes(skillId)) {
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
  profileAgentConfig: ProfileAgentConfig,
  profileConfig: ProfileConfig,
  skills: Record<string, SkillDefinition>,
  projectRoot: string
): Promise<SkillReference[]> {
  // If agent has explicit skills defined, use those
  if (profileAgentConfig.skills && profileAgentConfig.skills.length > 0) {
    return profileAgentConfig.skills;
  }

  // If profile has a stack, resolve from stack
  if (profileConfig.stack) {
    console.log(`  Resolving skills from stack "${profileConfig.stack}" for ${agentName}`);
    const stack = await loadStack(profileConfig.stack, projectRoot);
    return resolveStackSkills(stack, agentName, skills);
  }

  // No skills defined and no stack
  return [];
}

/**
 * Resolve agents by merging definitions with profile config
 */
export async function resolveAgents(
  agents: Record<string, AgentDefinition>,
  skills: Record<string, SkillDefinition>,
  profileConfig: ProfileConfig,
  projectRoot: string
): Promise<Record<string, AgentConfig>> {
  const resolved: Record<string, AgentConfig> = {};
  const agentNames = Object.keys(profileConfig.agents);

  for (const agentName of agentNames) {
    const definition = agents[agentName];
    if (!definition) {
      throw new Error(
        `Agent "${agentName}" in profile config but not found in scanned agents`
      );
    }

    const profileAgentConfig = profileConfig.agents[agentName];

    // Get skills (from explicit config or stack)
    const skillRefs = await getAgentSkills(
      agentName,
      profileAgentConfig,
      profileConfig,
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
      core_prompts: profileAgentConfig.core_prompts,
      ending_prompts: profileAgentConfig.ending_prompts,
      output_format: definition.output_format,
      skills: resolvedSkills,
    };
  }

  return resolved;
}

/**
 * Convert a stack config to a profile-like config for compilation
 */
export function stackToProfileConfig(
  stackId: string,
  stack: StackConfig
): ProfileConfig {
  const agents: Record<string, ProfileAgentConfig> = {};

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
